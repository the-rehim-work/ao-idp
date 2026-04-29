package az.ao.idp.service;

import az.ao.idp.config.IdpProperties;
import az.ao.idp.dto.response.LdapTreeNode;
import az.ao.idp.dto.response.LdapUserResponse;
import az.ao.idp.exception.AuthenticationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ldap.core.ContextMapper;
import org.springframework.ldap.core.DirContextOperations;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.support.LdapContextSource;
import org.springframework.ldap.filter.AndFilter;
import org.springframework.ldap.filter.EqualsFilter;
import org.springframework.ldap.filter.LikeFilter;
import org.springframework.ldap.filter.OrFilter;
import org.springframework.stereotype.Service;

import javax.naming.directory.SearchControls;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class LdapService {

    private static final Logger log = LoggerFactory.getLogger(LdapService.class);

    private final LdapTemplate ldapTemplate;
    private final LdapContextSource ldapContextSource;
    private final IdpProperties.LdapProperties ldapProps;

    public LdapService(
            LdapTemplate ldapTemplate,
            LdapContextSource ldapContextSource,
            IdpProperties idpProperties
    ) {
        this.ldapTemplate = ldapTemplate;
        this.ldapContextSource = ldapContextSource;
        this.ldapProps = idpProperties.ldap();
    }

    public boolean authenticate(String username, String password) {
        try {
            String userDn = findUserDn(username);
            if (userDn == null) return false;
            ldapContextSource.getContext(userDn, password).close();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public LdapUserAttributes getUserAttributes(String username) {
        AndFilter filter = new AndFilter();
        filter.and(new EqualsFilter("objectClass", ldapProps.userObjectClass()));
        filter.and(new EqualsFilter(ldapProps.usernameAttribute(), username));

        ContextMapper<LdapUserAttributes> mapper = ctx -> {
            DirContextOperations dco = (DirContextOperations) ctx;
            String mail = dco.getStringAttribute("mail");
            String displayName = dco.getStringAttribute("displayName");
            return new LdapUserAttributes(
                    username,
                    mail,
                    displayName != null ? displayName : username,
                    dco.getNameInNamespace()
            );
        };

        List<LdapUserAttributes> results = ldapTemplate.search("", filter.encode(), mapper);
        if (results.isEmpty()) {
            throw new AuthenticationException("User not found in directory");
        }
        return results.get(0);
    }

    public List<LdapUserResponse> listUsers(String search) {
        return listUsers(null, search);
    }

    public List<LdapUserResponse> listUsers(String baseDn, String search) {
        String searchBase = (baseDn != null && !baseDn.isBlank()) ? toRelativeDn(baseDn) : "";

        AndFilter filter = new AndFilter();
        filter.and(new EqualsFilter("objectClass", ldapProps.userObjectClass()));

        if (search != null && !search.isBlank()) {
            OrFilter searchFilter = new OrFilter();
            searchFilter.or(new LikeFilter(ldapProps.usernameAttribute(), "*" + search + "*"));
            searchFilter.or(new LikeFilter("displayName", "*" + search + "*"));
            searchFilter.or(new LikeFilter("mail", "*" + search + "*"));
            filter.and(searchFilter);
        }

        ContextMapper<LdapUserResponse> mapper = ctx -> {
            DirContextOperations dco = (DirContextOperations) ctx;
            String username = dco.getStringAttribute(ldapProps.usernameAttribute());
            if (username == null) return null;
            String mail = dco.getStringAttribute("mail");
            String displayName = dco.getStringAttribute("displayName");
            String title = dco.getStringAttribute("title");
            String entryDn = dco.getNameInNamespace();
            String ou = extractOu(entryDn);
            String[] memberOf = dco.getStringAttributes("memberOf");
            List<String> groups = memberOf != null
                    ? Arrays.stream(memberOf).map(this::rdnValue).toList()
                    : Collections.emptyList();
            return new LdapUserResponse(username, mail, displayName != null ? displayName : username,
                    false, title, ou, groups);
        };

        try {
            return ldapTemplate.search(searchBase, filter.encode(), mapper)
                    .stream().filter(u -> u != null).toList();
        } catch (Exception e) {
            log.error("LDAP user search failed for baseDn={}: {}", baseDn, e.getMessage());
            return Collections.emptyList();
        }
    }

    public List<LdapOuInfo> listOus() {
        SearchControls controls = new SearchControls();
        controls.setSearchScope(SearchControls.SUBTREE_SCOPE);
        controls.setReturningAttributes(new String[]{"ou", "o", "objectClass"});

        ContextMapper<LdapOuInfo> mapper = ctx -> {
            DirContextOperations dco = (DirContextOperations) ctx;
            String dn = dco.getNameInNamespace();
            String ouName = dco.getStringAttribute("ou");
            if (ouName == null) ouName = dco.getStringAttribute("o");
            if (ouName == null) ouName = rdnValue(dn);
            String rel = toRelativeDn(dn);
            int level = rel.isEmpty() ? 0 : (int) rel.chars().filter(c -> c == ',').count() + 1;
            return new LdapOuInfo(dn, ouName != null ? ouName : "", level);
        };

        try {
            List<LdapOuInfo> flat = ldapTemplate.search("", "(objectClass=organizationalUnit)", controls, mapper);
            return sortOusHierarchically(flat);
        } catch (Exception e) {
            log.error("LDAP OU list failed: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public record LdapOuInfo(String dn, String name, int level) {}

    private List<LdapOuInfo> sortOusHierarchically(List<LdapOuInfo> flat) {
        Map<String, List<LdapOuInfo>> childrenByParent = new LinkedHashMap<>();
        for (LdapOuInfo ou : flat) {
            String parentDn = parentDnOf(ou.dn());
            childrenByParent.computeIfAbsent(parentDn, k -> new ArrayList<>()).add(ou);
        }
        childrenByParent.values().forEach(list -> list.sort(java.util.Comparator.comparing(LdapOuInfo::name)));
        List<LdapOuInfo> result = new ArrayList<>();
        String baseDn = ldapProps.baseDn();
        addChildrenRecursive(baseDn, childrenByParent, result);
        return result;
    }

    private void addChildrenRecursive(String parentDn, Map<String, List<LdapOuInfo>> childrenByParent, List<LdapOuInfo> result) {
        List<LdapOuInfo> children = childrenByParent.get(parentDn);
        if (children == null) return;
        for (LdapOuInfo child : children) {
            result.add(child);
            addChildrenRecursive(child.dn(), childrenByParent, result);
        }
    }

    private String parentDnOf(String dn) {
        int commaIdx = dn.indexOf(',');
        return commaIdx >= 0 ? dn.substring(commaIdx + 1) : "";
    }

    public List<LdapTreeNode> listLdapChildren(String parentDn, Set<String> activatedUsernames) {
        String searchBase = toRelativeDn(parentDn);

        SearchControls controls = new SearchControls();
        controls.setSearchScope(SearchControls.ONELEVEL_SCOPE);
        controls.setReturningAttributes(new String[]{
                "objectClass", "cn", "ou", "dc", "sAMAccountName", "uid",
                "displayName", "mail", "title", "memberOf", "member", "uniqueMember",
                "description", "name"
        });

        ContextMapper<LdapTreeNode> mapper = ctx -> {
            DirContextOperations dco = (DirContextOperations) ctx;
            String dn = dco.getNameInNamespace();
            String rdn = dn.contains(",") ? dn.substring(0, dn.indexOf(',')) : dn;
            String[] objectClasses = dco.getStringAttributes("objectClass");
            if (objectClasses == null) objectClasses = new String[0];
            Set<String> ocSet = new java.util.HashSet<>();
            for (String oc : objectClasses) ocSet.add(oc.toLowerCase());

            if (ocSet.contains("organizationalunit") || ocSet.contains("organization")
                    || ocSet.contains("container") || ocSet.contains("builtindomain")
                    || ocSet.contains("domain") || ocSet.contains("dcobject")) {
                String ouName = dco.getStringAttribute("ou");
                if (ouName == null) ouName = dco.getStringAttribute("o");
                if (ouName == null) ouName = dco.getStringAttribute("dc");
                if (ouName == null) ouName = rdnValue(rdn);
                return LdapTreeNode.ou(dn, rdn, ouName, true);
            }

            if (ocSet.contains("group") || ocSet.contains("groupofnames")
                    || ocSet.contains("groupofuniquenames") || ocSet.contains("posixgroup")
                    || ocSet.contains("groupofmembers")) {
                String groupName = dco.getStringAttribute("cn");
                if (groupName == null) groupName = dco.getStringAttribute("name");
                if (groupName == null) groupName = rdnValue(rdn);
                boolean hasMember = dco.getStringAttributes("member") != null
                        || dco.getStringAttributes("uniqueMember") != null
                        || dco.getStringAttribute("memberUid") != null;
                return LdapTreeNode.group(dn, rdn, groupName, hasMember);
            }

            String configuredClass = ldapProps.userObjectClass().toLowerCase();
            if (ocSet.contains(configuredClass) || ocSet.contains("person")
                    || ocSet.contains("inetorgperson") || ocSet.contains("organizationalperson")
                    || ocSet.contains("posixaccount") || ocSet.contains("shadowaccount")
                    || ocSet.contains("user")) {
                String username = dco.getStringAttribute(ldapProps.usernameAttribute());
                if (username == null) username = dco.getStringAttribute("uid");
                if (username == null) username = dco.getStringAttribute("sAMAccountName");
                if (username == null) username = rdnValue(rdn);
                String displayName = dco.getStringAttribute("displayName");
                if (displayName == null) displayName = dco.getStringAttribute("cn");
                if (displayName == null) displayName = dco.getStringAttribute("name");
                if (displayName == null) displayName = username;
                String mail = dco.getStringAttribute("mail");
                String title = dco.getStringAttribute("title");
                String[] memberOf = dco.getStringAttributes("memberOf");
                List<String> groups = memberOf != null
                        ? Arrays.stream(memberOf).map(this::rdnValue).toList()
                        : Collections.emptyList();
                boolean isActivated = username != null && activatedUsernames.contains(username);
                return LdapTreeNode.user(dn, rdn, displayName, username, mail, title, isActivated, groups);
            }

            String name = dco.getStringAttribute("cn");
            if (name == null) name = dco.getStringAttribute("name");
            if (name == null) name = rdnValue(rdn);
            return LdapTreeNode.other(dn, rdn, name);
        };

        try {
            return ldapTemplate.search(searchBase, "(objectClass=*)", controls, mapper)
                    .stream().filter(n -> n != null).toList();
        } catch (Exception e) {
            log.error("LDAP tree search failed for dn={}: {}", parentDn, e.getMessage());
            return Collections.emptyList();
        }
    }

    private String toRelativeDn(String fullDn) {
        if (fullDn == null || fullDn.isBlank()) return "";
        String baseDn = ldapProps.baseDn();
        String fullLower = fullDn.toLowerCase();
        String baseLower = baseDn.toLowerCase();
        if (fullLower.endsWith("," + baseLower)) {
            return fullDn.substring(0, fullDn.length() - baseDn.length() - 1);
        }
        if (fullLower.equals(baseLower)) {
            return "";
        }
        return fullDn;
    }

    private String rdnValue(String rdnOrDn) {
        if (rdnOrDn == null) return null;
        String first = rdnOrDn.split(",")[0].trim();
        int eq = first.indexOf('=');
        return eq >= 0 ? first.substring(eq + 1) : first;
    }

    private String extractOu(String dn) {
        if (dn == null) return null;
        for (String part : dn.split(",")) {
            String trimmed = part.trim();
            if (trimmed.regionMatches(true, 0, "OU=", 0, 3)) return trimmed.substring(3);
        }
        return null;
    }

    private String findUserDn(String username) {
        AndFilter filter = new AndFilter();
        filter.and(new EqualsFilter("objectClass", ldapProps.userObjectClass()));
        filter.and(new EqualsFilter(ldapProps.usernameAttribute(), username));

        ContextMapper<String> mapper = ctx -> ((DirContextOperations) ctx).getNameInNamespace();
        List<String> dns = ldapTemplate.search("", filter.encode(), mapper);
        return dns.isEmpty() ? null : dns.get(0);
    }

    public record LdapUserAttributes(
            String username,
            String email,
            String displayName,
            String dn
    ) {}
}
