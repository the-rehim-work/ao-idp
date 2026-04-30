package az.ao.idp.service;

import az.ao.idp.config.IdpProperties;
import az.ao.idp.dto.response.LdapTreeNode;
import az.ao.idp.dto.response.LdapUserResponse;
import az.ao.idp.entity.LdapServerConfig;
import az.ao.idp.exception.AuthenticationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ldap.core.ContextMapper;
import org.springframework.ldap.core.DirContextOperations;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.support.LdapContextSource;
import org.springframework.ldap.filter.AndFilter;
import org.springframework.ldap.filter.EqualsFilter;
import org.springframework.ldap.filter.HardcodedFilter;
import org.springframework.ldap.filter.LikeFilter;
import org.springframework.ldap.filter.OrFilter;
import org.springframework.stereotype.Service;

import javax.naming.directory.SearchControls;
import java.time.Instant;
import java.util.*;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LdapService {

    private static final Logger log = LoggerFactory.getLogger(LdapService.class);

    private final LdapConfigService ldapConfigService;
    private final IdpProperties idpProperties;

    private record CachedLdap(Instant builtAt, LdapContextSource source, LdapTemplate template) {}
    private final Map<UUID, CachedLdap> cache = new ConcurrentHashMap<>();

    public LdapService(LdapConfigService ldapConfigService, IdpProperties idpProperties) {
        this.ldapConfigService = ldapConfigService;
        this.idpProperties = idpProperties;
    }

    public record AuthResult(boolean success, UUID ldapServerId) {
        public static AuthResult failure() { return new AuthResult(false, null); }
    }

    private static final String[] PERSON_CLASSES = {"inetOrgPerson", "person", "posixAccount", "organizationalPerson", "user"};
    private static final String[] USERNAME_ATTRS  = {"uid", "sAMAccountName", "cn"};

    private record LdapProps(String usernameAttribute, String userObjectClass, String baseDn, String additionalFilter) {}

    private LdapProps propsFrom(LdapServerConfig config) {
        return new LdapProps(config.getUsernameAttribute(), config.getUserObjectClass(), config.getBaseDn(), config.getAdditionalUserFilter());
    }

    private LdapProps fallbackProps() {
        return new LdapProps(
                idpProperties.ldap().usernameAttribute(),
                idpProperties.ldap().userObjectClass(),
                idpProperties.ldap().baseDn(),
                null
        );
    }

    private CachedLdap forConfig(LdapServerConfig config) {
        CachedLdap existing = cache.get(config.getId());
        if (existing != null && existing.builtAt().equals(config.getUpdatedAt())) return existing;
        LdapContextSource source = LdapConfigService.buildContextSource(
                config.getUrl(), config.getBaseDn(), config.getServiceAccountDn(), config.getServiceAccountPassword()
        );
        CachedLdap entry = new CachedLdap(config.getUpdatedAt(), source, new LdapTemplate(source));
        cache.put(config.getId(), entry);
        return entry;
    }

    private LdapServerConfig primaryConfig() {
        return ldapConfigService.getActive()
                .orElseThrow(() -> new IllegalStateException("No active LDAP server configured"));
    }

    private LdapTemplate primaryTemplate() {
        return forConfig(primaryConfig()).template();
    }

    private LdapProps primaryProps() {
        return ldapConfigService.getActive()
                .map(this::propsFrom)
                .orElseGet(this::fallbackProps);
    }

    public AuthResult authenticate(String username, String password, UUID knownLdapServerId) {
        List<LdapServerConfig> active = ldapConfigService.getActiveAll();
        if (active.isEmpty()) return AuthResult.failure();

        if (knownLdapServerId != null) {
            Optional<LdapServerConfig> known = active.stream()
                    .filter(c -> c.getId().equals(knownLdapServerId)).findFirst();
            if (known.isPresent()) {
                AuthResult r = tryAuth(username, password, known.get());
                if (r.success()) return r;
            }
        }

        for (LdapServerConfig config : active) {
            if (config.getId().equals(knownLdapServerId)) continue;
            AuthResult r = tryAuth(username, password, config);
            if (r.success()) return r;
        }
        return AuthResult.failure();
    }

    public boolean authenticate(String username, String password) {
        return authenticate(username, password, null).success();
    }

    private AuthResult tryAuth(String username, String password, LdapServerConfig config) {
        try {
            CachedLdap ldap = forConfig(config);
            LdapProps props = propsFrom(config);
            String userDn = findUserDnWith(username, props, ldap.template());
            if (userDn == null) return AuthResult.failure();
            ldap.source().getContext(userDn, password).close();
            return new AuthResult(true, config.getId());
        } catch (Exception e) {
            log.debug("Auth failed against LDAP [{}]: {}", config.getName(), e.getMessage());
            return AuthResult.failure();
        }
    }

    public LdapUserAttributes getUserAttributes(String username) {
        return getUserAttributes(username, null);
    }

    public LdapUserAttributes getUserAttributes(String username, UUID ldapServerId) {
        LdapServerConfig config = ldapServerId != null
                ? ldapConfigService.get(ldapServerId)
                : primaryConfig();
        LdapProps props = propsFrom(config);
        CachedLdap ldap = forConfig(config);
        LdapUserAttributes attrs = fetchUserAttributes(username, props, ldap);
        if (attrs == null) throw new AuthenticationException("User not found in directory");
        return attrs;
    }

    private LdapUserAttributes fetchUserAttributes(String username, LdapProps props, CachedLdap ldap) {
        OrFilter ocFilter = new OrFilter();
        ocFilter.or(new EqualsFilter("objectClass", props.userObjectClass()));
        for (String oc : PERSON_CLASSES) ocFilter.or(new EqualsFilter("objectClass", oc));

        OrFilter unFilter = new OrFilter();
        unFilter.or(new EqualsFilter(props.usernameAttribute(), username));
        for (String attr : USERNAME_ATTRS) {
            if (!attr.equalsIgnoreCase(props.usernameAttribute())) unFilter.or(new EqualsFilter(attr, username));
        }

        AndFilter filter = new AndFilter();
        filter.and(ocFilter);
        filter.and(unFilter);

        ContextMapper<LdapUserAttributes> mapper = ctx -> {
            DirContextOperations dco = (DirContextOperations) ctx;
            String resolved = firstNonNull(
                    dco.getStringAttribute(props.usernameAttribute()),
                    dco.getStringAttribute("uid"),
                    dco.getStringAttribute("sAMAccountName"),
                    username);
            String display = Optional.ofNullable(dco.getStringAttribute("displayName"))
                    .or(() -> Optional.ofNullable(dco.getStringAttribute("cn")))
                    .orElse(resolved);
            return new LdapUserAttributes(resolved, dco.getStringAttribute("mail"), display, dco.getNameInNamespace());
        };

        List<LdapUserAttributes> results = ldap.template().search("", filter.encode(), mapper);
        return results.isEmpty() ? null : results.get(0);
    }

    private static String firstNonNull(String... vals) {
        for (String v : vals) if (v != null) return v;
        return null;
    }

    public LdapUserAttributes getUserAttributesFromAny(String username) {
        List<LdapServerConfig> active = ldapConfigService.getActiveAll();
        for (LdapServerConfig config : active) {
            try {
                LdapProps props = propsFrom(config);
                CachedLdap ldap = forConfig(config);
                LdapUserAttributes attrs = fetchUserAttributes(username, props, ldap);
                if (attrs != null) return attrs;
            } catch (Exception e) {
                log.debug("getUserAttributes failed on LDAP [{}]: {}", config.getName(), e.getMessage());
            }
        }
        throw new IllegalStateException("User not found in any active LDAP server: " + username);
    }

    public Map<String, String> getClaimAttributes(String username, List<String> ldapAttrs) {
        return getClaimAttributes(username, ldapAttrs, null);
    }

    public Map<String, String> getClaimAttributes(String username, List<String> ldapAttrs, UUID ldapServerId) {
        if (ldapAttrs.isEmpty()) return Map.of();
        LdapServerConfig config = ldapServerId != null
                ? ldapConfigService.get(ldapServerId)
                : primaryConfig();
        LdapProps props = propsFrom(config);
        CachedLdap ldap = forConfig(config);

        AndFilter filter = new AndFilter();
        filter.and(new EqualsFilter("objectClass", props.userObjectClass()));
        filter.and(new EqualsFilter(props.usernameAttribute(), username));

        SearchControls controls = new SearchControls();
        controls.setSearchScope(SearchControls.SUBTREE_SCOPE);
        controls.setReturningAttributes(ldapAttrs.toArray(new String[0]));

        ContextMapper<Map<String, String>> mapper = ctx -> {
            DirContextOperations dco = (DirContextOperations) ctx;
            Map<String, String> result = new LinkedHashMap<>();
            for (String attr : ldapAttrs) {
                String val = dco.getStringAttribute(attr);
                if (val != null) result.put(attr, val);
            }
            return result;
        };

        List<Map<String, String>> results = ldap.template().search("", filter.encode(), controls, mapper);
        return results.isEmpty() ? Map.of() : results.get(0);
    }

    public List<LdapUserResponse> listUsers(String search) {
        return listUsers(null, search);
    }

    public List<LdapUserResponse> listUsers(String baseDn, String search) {
        LdapServerConfig config = primaryConfig();
        return listUsersForConfig(config, baseDn, search);
    }

    public List<LdapUserResponse> listUsersFromAllActive(String search) {
        List<LdapServerConfig> active = ldapConfigService.getActiveAll();
        if (active.isEmpty()) throw new IllegalStateException("No active LDAP server configured");

        List<LdapUserResponse> all = new ArrayList<>();
        Set<String> seenUsernames = new HashSet<>();
        for (LdapServerConfig config : active) {
            try {
                List<LdapUserResponse> users = listUsersForConfig(config, null, search);
                for (LdapUserResponse u : users) {
                    if (seenUsernames.add(u.ldapUsername())) {
                        all.add(new LdapUserResponse(u.ldapUsername(), u.email(), u.displayName(),
                                u.activated(), u.title(), u.ou(), u.groups(), config.getName()));
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to list users from LDAP [{}]: {}", config.getName(), e.getMessage());
            }
        }
        return all;
    }

    private List<LdapUserResponse> listUsersForConfig(LdapServerConfig config, String baseDn, String search) {
        LdapProps props = propsFrom(config);
        LdapTemplate template = forConfig(config).template();
        String searchBase = (baseDn != null && !baseDn.isBlank()) ? toRelativeDn(baseDn, props.baseDn()) : "";

        AndFilter filter = new AndFilter();
        filter.and(new EqualsFilter("objectClass", props.userObjectClass()));

        if (search != null && !search.isBlank()) {
            OrFilter searchFilter = new OrFilter();
            searchFilter.or(new LikeFilter(props.usernameAttribute(), "*" + search + "*"));
            searchFilter.or(new LikeFilter("displayName", "*" + search + "*"));
            searchFilter.or(new LikeFilter("mail", "*" + search + "*"));
            filter.and(searchFilter);
        }

        if (props.additionalFilter() != null && !props.additionalFilter().isBlank()) {
            filter.and(new HardcodedFilter(props.additionalFilter()));
        }

        ContextMapper<LdapUserResponse> mapper = ctx -> {
            DirContextOperations dco = (DirContextOperations) ctx;
            String username = dco.getStringAttribute(props.usernameAttribute());
            if (username == null) return null;
            String displayName = dco.getStringAttribute("displayName");
            String[] memberOf = dco.getStringAttributes("memberOf");
            List<String> groups = memberOf != null
                    ? Arrays.stream(memberOf).map(this::rdnValue).toList()
                    : Collections.emptyList();
            return new LdapUserResponse(username, dco.getStringAttribute("mail"),
                    displayName != null ? displayName : username, false,
                    dco.getStringAttribute("title"), extractOu(dco.getNameInNamespace()), groups, null);
        };

        try {
            return template.search(searchBase, filter.encode(), mapper)
                    .stream().filter(u -> u != null).toList();
        } catch (Exception e) {
            log.error("LDAP user search failed for config={} baseDn={}: {}", config.getName(), baseDn, e.getMessage());
            return Collections.emptyList();
        }
    }

    public List<LdapOuInfo> listOus() {
        LdapServerConfig config = primaryConfig();
        LdapProps props = propsFrom(config);
        LdapTemplate template = forConfig(config).template();

        SearchControls controls = new SearchControls();
        controls.setSearchScope(SearchControls.SUBTREE_SCOPE);
        controls.setReturningAttributes(new String[]{"ou", "o", "objectClass"});

        ContextMapper<LdapOuInfo> mapper = ctx -> {
            DirContextOperations dco = (DirContextOperations) ctx;
            String dn = dco.getNameInNamespace();
            String ouName = dco.getStringAttribute("ou");
            if (ouName == null) ouName = dco.getStringAttribute("o");
            if (ouName == null) ouName = rdnValue(dn);
            String rel = toRelativeDn(dn, props.baseDn());
            int level = rel.isEmpty() ? 0 : (int) rel.chars().filter(c -> c == ',').count() + 1;
            return new LdapOuInfo(dn, ouName != null ? ouName : "", level);
        };

        try {
            List<LdapOuInfo> flat = template.search("", "(objectClass=organizationalUnit)", controls, mapper);
            return sortOusHierarchically(flat, props.baseDn());
        } catch (Exception e) {
            log.error("LDAP OU list failed: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public record LdapOuInfo(String dn, String name, int level) {}

    public Map<String, String> getAvailableAttributes() {
        return getAvailableAttributes(null);
    }

    public Map<String, String> getAvailableAttributesForRequest(String url, String baseDn, String userDn, String password, String userObjectClass) {
        LdapContextSource source = LdapConfigService.buildContextSource(url, baseDn, userDn, password);
        LdapTemplate template = new LdapTemplate(source);
        return fetchAvailableAttributes(template, userObjectClass);
    }

    public Map<String, String> getAvailableAttributes(UUID ldapServerId) {
        LdapServerConfig config = ldapServerId != null
                ? ldapConfigService.get(ldapServerId)
                : primaryConfig();
        LdapProps props = propsFrom(config);
        LdapTemplate template = forConfig(config).template();
        return fetchAvailableAttributes(template, props.userObjectClass());
    }

    private Map<String, String> fetchAvailableAttributes(LdapTemplate template, String userObjectClass) {
        SearchControls controls = new SearchControls();
        controls.setSearchScope(SearchControls.SUBTREE_SCOPE);
        controls.setCountLimit(1);

        ContextMapper<Map<String, String>> mapper = ctx -> {
            Map<String, String> attrs = new TreeMap<>();
            try {
                if (ctx instanceof javax.naming.directory.DirContext dc) {
                    javax.naming.directory.Attributes jAttrs = dc.getAttributes("");
                    javax.naming.NamingEnumeration<? extends javax.naming.directory.Attribute> all = jAttrs.getAll();
                    while (all.hasMore()) {
                        javax.naming.directory.Attribute attr = all.next();
                        Object val = attr.get();
                        if (val instanceof String s) {
                            attrs.put(attr.getID(), s);
                        } else if (val instanceof byte[]) {
                            attrs.put(attr.getID(), "[binary]");
                        } else if (val != null) {
                            attrs.put(attr.getID(), val.toString());
                        }
                    }
                    all.close();
                }
            } catch (Exception ignored) {}
            return attrs;
        };

        String ocClause = userObjectClass != null && !userObjectClass.isBlank()
                ? "(objectClass=" + userObjectClass + ")"
                : "";
        String ocFilter = "(|(objectClass=inetOrgPerson)(objectClass=person)(objectClass=posixAccount)(objectClass=user)" + ocClause + ")";
        try {
            List<Map<String, String>> results = template.search("", ocFilter, controls, mapper);
            return results.isEmpty() ? Map.of() : results.get(0);
        } catch (Exception e) {
            log.error("Failed to fetch LDAP available attributes: {}", e.getMessage());
            return Map.of();
        }
    }

    public List<LdapTreeNode> listLdapChildren(String parentDn, Set<String> activatedUsernames) {
        return listLdapChildren(null, parentDn, activatedUsernames);
    }

    public List<LdapTreeNode> listLdapChildren(UUID configId, String parentDn, Set<String> activatedUsernames) {
        LdapServerConfig config = configId != null ? ldapConfigService.get(configId) : primaryConfig();
        LdapProps props = propsFrom(config);
        LdapTemplate template = forConfig(config).template();
        String searchBase = toRelativeDn(parentDn, props.baseDn());

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
            Set<String> ocSet = new HashSet<>();
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

            String configuredClass = props.userObjectClass().toLowerCase();
            if (ocSet.contains(configuredClass) || ocSet.contains("person")
                    || ocSet.contains("inetorgperson") || ocSet.contains("organizationalperson")
                    || ocSet.contains("posixaccount") || ocSet.contains("user")) {
                String username = dco.getStringAttribute(props.usernameAttribute());
                if (username == null) username = dco.getStringAttribute("uid");
                if (username == null) username = dco.getStringAttribute("sAMAccountName");
                if (username == null) username = rdnValue(rdn);
                String displayName = dco.getStringAttribute("displayName");
                if (displayName == null) displayName = dco.getStringAttribute("cn");
                if (displayName == null) displayName = username;
                String[] memberOf = dco.getStringAttributes("memberOf");
                List<String> groups = memberOf != null
                        ? Arrays.stream(memberOf).map(this::rdnValue).toList()
                        : Collections.emptyList();
                boolean isActivated = username != null && activatedUsernames.contains(username);
                return LdapTreeNode.user(dn, rdn, displayName, username,
                        dco.getStringAttribute("mail"), dco.getStringAttribute("title"), isActivated, groups);
            }

            String name = dco.getStringAttribute("cn");
            if (name == null) name = dco.getStringAttribute("name");
            if (name == null) name = rdnValue(rdn);
            return LdapTreeNode.other(dn, rdn, name);
        };

        try {
            return template.search(searchBase, "(objectClass=*)", controls, mapper)
                    .stream().filter(n -> n != null).toList();
        } catch (Exception e) {
            log.error("LDAP tree search failed for dn={}: {}", parentDn, e.getMessage());
            return Collections.emptyList();
        }
    }

    private List<LdapOuInfo> sortOusHierarchically(List<LdapOuInfo> flat, String baseDn) {
        Map<String, List<LdapOuInfo>> childrenByParent = new LinkedHashMap<>();
        for (LdapOuInfo ou : flat) {
            childrenByParent.computeIfAbsent(parentDnOf(ou.dn()), k -> new ArrayList<>()).add(ou);
        }
        childrenByParent.values().forEach(list -> list.sort(Comparator.comparing(LdapOuInfo::name)));
        List<LdapOuInfo> result = new ArrayList<>();
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

    private String toRelativeDn(String fullDn, String baseDn) {
        if (fullDn == null || fullDn.isBlank()) return "";
        String fullLower = fullDn.toLowerCase();
        String baseLower = baseDn.toLowerCase();
        if (fullLower.endsWith("," + baseLower)) return fullDn.substring(0, fullDn.length() - baseDn.length() - 1);
        if (fullLower.equals(baseLower)) return "";
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

    private String findUserDnWith(String username, LdapProps props, LdapTemplate template) {
        OrFilter ocFilter = new OrFilter();
        ocFilter.or(new EqualsFilter("objectClass", props.userObjectClass()));
        for (String oc : PERSON_CLASSES) ocFilter.or(new EqualsFilter("objectClass", oc));

        OrFilter unFilter = new OrFilter();
        unFilter.or(new EqualsFilter(props.usernameAttribute(), username));
        for (String attr : USERNAME_ATTRS) {
            if (!attr.equalsIgnoreCase(props.usernameAttribute())) unFilter.or(new EqualsFilter(attr, username));
        }

        AndFilter filter = new AndFilter();
        filter.and(ocFilter);
        filter.and(unFilter);

        ContextMapper<String> mapper = ctx -> ((DirContextOperations) ctx).getNameInNamespace();
        List<String> dns = template.search("", filter.encode(), mapper);
        return dns.isEmpty() ? null : dns.get(0);
    }

    public record LdapUserAttributes(String username, String email, String displayName, String dn) {}
}
