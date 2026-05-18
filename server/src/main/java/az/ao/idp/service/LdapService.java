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

import javax.naming.NamingEnumeration;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
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

    /** Detected directory flavor — drives which LDAP attribute names / search filters are used. */
    public enum DirectoryType { ACTIVE_DIRECTORY, OPENLDAP, UNKNOWN }

    /** Cached per-config directory type detection (avoids re-querying RootDSE on every call). */
    private final Map<UUID, DirectoryType> typeCache = new ConcurrentHashMap<>();

    private record LdapProps(String usernameAttribute, String emailAttribute, String userObjectClass,
                              String baseDn, String additionalFilter, DirectoryType type) {}

    private LdapProps propsFrom(LdapServerConfig config) {
        return new LdapProps(
                config.getUsernameAttribute(),
                config.getEmailAttribute() != null && !config.getEmailAttribute().isBlank()
                        ? config.getEmailAttribute() : "mail",
                config.getUserObjectClass(),
                config.getBaseDn(),
                config.getAdditionalUserFilter(),
                detectDirectoryType(config)
        );
    }

    /**
     * Detect whether the connected directory is Active Directory or OpenLDAP.
     * Order of checks:
     *   1. Config hints — userObjectClass=user / usernameAttribute=sAMAccountName  → AD
     *   2. Config hints — userObjectClass=inetOrgPerson|posixAccount / usernameAttribute=uid → OpenLDAP
     *   3. RootDSE lookup — presence of `forestFunctionality` / `domainFunctionality` attributes → AD
     *   4. Base entry objectClass — `domain` → AD; `dcObject`/`organization` → OpenLDAP
     * Cached per config UUID until LdapServerConfig.updatedAt changes (cache key invalidation is handled by forConfig).
     */
    private DirectoryType detectDirectoryType(LdapServerConfig config) {
        DirectoryType cached = typeCache.get(config.getId());
        if (cached != null) return cached;

        DirectoryType detected = detectFromConfigHints(config);
        if (detected == DirectoryType.UNKNOWN) {
            detected = detectFromServer(config);
        }
        typeCache.put(config.getId(), detected);
        log.info("LDAP directory type for '{}': {}", config.getName(), detected);
        return detected;
    }

    private DirectoryType detectFromConfigHints(LdapServerConfig config) {
        String uoc = config.getUserObjectClass() == null ? "" : config.getUserObjectClass().toLowerCase();
        String ua  = config.getUsernameAttribute() == null ? "" : config.getUsernameAttribute().toLowerCase();
        if (uoc.equals("user") || ua.equals("samaccountname")) return DirectoryType.ACTIVE_DIRECTORY;
        if (uoc.equals("inetorgperson") || uoc.equals("posixaccount") || ua.equals("uid"))
            return DirectoryType.OPENLDAP;
        return DirectoryType.UNKNOWN;
    }

    private DirectoryType detectFromServer(LdapServerConfig config) {
        try {
            LdapTemplate template = forConfig(config).template();
            // Try RootDSE — AD exposes forestFunctionality/domainFunctionality
            SearchControls sc = new SearchControls();
            sc.setSearchScope(SearchControls.OBJECT_SCOPE);
            sc.setReturningAttributes(new String[]{"forestFunctionality", "domainFunctionality", "vendorName", "namingContexts"});
            ContextMapper<DirectoryType> rootMapper = ctx -> {
                DirContextOperations dco = (DirContextOperations) ctx;
                if (dco.getStringAttribute("forestFunctionality") != null
                        || dco.getStringAttribute("domainFunctionality") != null) {
                    return DirectoryType.ACTIVE_DIRECTORY;
                }
                String vendor = dco.getStringAttribute("vendorName");
                if (vendor != null && vendor.toLowerCase().contains("389 directory")) return DirectoryType.OPENLDAP;
                return DirectoryType.UNKNOWN;
            };
            // RootDSE is at DN "" with OBJECT_SCOPE — must use absolute search bypassing baseDn
            try {
                List<DirectoryType> rdseResults = template.search("", "(objectClass=*)", sc, rootMapper);
                for (DirectoryType t : rdseResults) if (t != DirectoryType.UNKNOWN) return t;
            } catch (Exception ignored) { /* fall through */ }

            // Look at base DN objectClass
            try {
                DirContextOperations baseCtx = template.lookupContext("");
                String[] ocs = baseCtx.getStringAttributes("objectClass");
                if (ocs != null) {
                    Set<String> ocSet = new HashSet<>();
                    for (String oc : ocs) ocSet.add(oc.toLowerCase());
                    if (ocSet.contains("domain") || ocSet.contains("domaindns")) return DirectoryType.ACTIVE_DIRECTORY;
                    if (ocSet.contains("dcobject") || ocSet.contains("organization") || ocSet.contains("organizationalunit"))
                        return DirectoryType.OPENLDAP;
                }
            } catch (Exception ignored) { /* fall through */ }
        } catch (Exception e) {
            log.debug("Directory type auto-detect failed for {}: {}", config.getName(), e.getMessage());
        }
        return DirectoryType.UNKNOWN;
    }


    private CachedLdap forConfig(LdapServerConfig config) {
        CachedLdap existing = cache.get(config.getId());
        if (existing != null && existing.builtAt().equals(config.getUpdatedAt())) return existing;
        LdapContextSource source = LdapConfigService.buildContextSource(
                config.getUrl(), config.getBaseDn(), config.getServiceAccountDn(), config.getServiceAccountPassword()
        );
        LdapTemplate ldapTemplate = new LdapTemplate(source);
        ldapTemplate.setIgnorePartialResultException(true);
        CachedLdap entry = new CachedLdap(config.getUpdatedAt(), source, ldapTemplate);
        cache.put(config.getId(), entry);
        // Config changed → invalidate directory-type detection cache so it's re-resolved
        typeCache.remove(config.getId());
        return entry;
    }

    private LdapServerConfig primaryConfig() {
        return ldapConfigService.getActive()
                .orElseThrow(() -> new IllegalStateException("No active LDAP server configured"));
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
            log.info("LDAP auth success: username={} server={}", username, config.getName());
            return new AuthResult(true, config.getId());
        } catch (Exception e) {
            log.info("LDAP auth failed: username={} server={} reason={}", username, config.getName(), e.getMessage());
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
            String email = dco.getStringAttribute(props.emailAttribute());
            if (email == null && !"mail".equalsIgnoreCase(props.emailAttribute())) {
                email = dco.getStringAttribute("mail");
            }
            return new LdapUserAttributes(resolved, email, display, dco.getNameInNamespace());
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
        if (ldapAttrs == null || ldapAttrs.isEmpty()) return Map.of();
        LdapServerConfig config = ldapServerId != null
                ? ldapConfigService.get(ldapServerId)
                : primaryConfig();
        LdapProps props = propsFrom(config);
        CachedLdap ldap = forConfig(config);

        // Use the same broad objectClass filter as authenticate() so mixed-class entries are found
        OrFilter ocFilter = new OrFilter();
        ocFilter.or(new EqualsFilter("objectClass", props.userObjectClass()));
        for (String oc : PERSON_CLASSES) ocFilter.or(new EqualsFilter("objectClass", oc));

        // Try configured username attribute first, then fall back to common alternatives
        OrFilter unFilter = new OrFilter();
        unFilter.or(new EqualsFilter(props.usernameAttribute(), username));
        for (String attr : USERNAME_ATTRS) {
            if (!attr.equalsIgnoreCase(props.usernameAttribute())) {
                unFilter.or(new EqualsFilter(attr, username));
            }
        }

        AndFilter filter = new AndFilter();
        filter.and(ocFilter);
        filter.and(unFilter);
        if (props.additionalFilter() != null && !props.additionalFilter().isBlank()) {
            filter.and(new HardcodedFilter(props.additionalFilter()));
        }

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

        try {
            List<Map<String, String>> results = ldap.template().search("", filter.encode(), controls, mapper);
            return results.isEmpty() ? Map.of() : results.get(0);
        } catch (Exception e) {
            log.warn("getClaimAttributes failed for user={} server={}: {}", username,
                    config.getName(), e.getMessage());
            return Map.of();
        }
    }

    /** Fetch all LDAP attributes for a specific DN entry. */
    public Map<String, Object> getEntryAttributes(UUID configId, String dn) {
        LdapServerConfig config = configId != null ? ldapConfigService.get(configId) : primaryConfig();
        LdapProps props = propsFrom(config);
        LdapTemplate template = forConfig(config).template();
        String relativeDn = toRelativeDn(dn, props.baseDn());
        try {
            DirContextOperations dco = template.lookupContext(relativeDn.isEmpty() ? dn : relativeDn);
            Attributes jndiAttrs = dco.getAttributes();
            Map<String, Object> result = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
            NamingEnumeration<? extends Attribute> en = jndiAttrs.getAll();
            while (en.hasMore()) {
                Attribute attr = en.next();
                String id = attr.getID();
                if (id.equalsIgnoreCase("userPassword") || id.equalsIgnoreCase("unicodePwd")) continue; // never expose
                if (attr.size() == 1) {
                    Object v = attr.get();
                    result.put(id, v instanceof byte[] ? "[binary]" : (v != null ? v.toString() : ""));
                } else {
                    List<String> vals = new ArrayList<>();
                    for (int i = 0; i < attr.size(); i++) {
                        Object v = attr.get(i);
                        vals.add(v instanceof byte[] ? "[binary]" : (v != null ? v.toString() : ""));
                    }
                    result.put(id, vals);
                }
            }
            return result;
        } catch (Exception e) {
            log.error("Failed to get entry attributes for dn={}: {}", dn, e.getMessage());
            return Map.of();
        }
    }

    public List<LdapUserResponse> listUsers(String search) {
        return listUsers(null, search);
    }

    public List<LdapUserResponse> listUsers(String baseDn, String search) {
        LdapServerConfig config = primaryConfig();
        return listUsersForConfig(config, baseDn, search);
    }

    public List<LdapUserResponse> listUsersFromAllActive(String search) {
        return listUsersFromAllActive(search, null);
    }

    public List<LdapUserResponse> listUsersFromAllActive(String search, String attr) {
        return listUsersFromAllActive(search, attr, 500);
    }

    public List<LdapUserResponse> listUsersFromAllActive(String search, String attr, int limit) {
        List<LdapServerConfig> active = ldapConfigService.getActiveAll();
        if (active.isEmpty()) throw new IllegalStateException("No active LDAP server configured");

        List<LdapUserResponse> all = new ArrayList<>();
        Set<String> seenUsernames = new HashSet<>();
        for (LdapServerConfig config : active) {
            try {
                List<LdapUserResponse> users = listUsersForConfig(config, null, search, attr, limit);
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
        return listUsersForConfig(config, baseDn, search, null, 500);
    }

    private List<LdapUserResponse> listUsersForConfig(LdapServerConfig config, String baseDn, String search, String attr) {
        return listUsersForConfig(config, baseDn, search, attr, 500);
    }

    private static final Set<String> BASIC_SEARCH_ATTRS = Set.of("name", "username", "email", "title", "all");

    private List<LdapUserResponse> listUsersForConfig(LdapServerConfig config, String baseDn, String search, String attr, int limit) {
        LdapProps props = propsFrom(config);
        LdapTemplate template = forConfig(config).template();
        String searchBase = (baseDn != null && !baseDn.isBlank()) ? toRelativeDn(baseDn, props.baseDn()) : "";

        // ObjectClass filter — narrow to the detected directory type so we don't pull in computer accounts (AD)
        // or service entries with overlapping classes (OpenLDAP)
        OrFilter ocFilter = buildUserObjectClassFilter(props);

        AndFilter filter = new AndFilter();
        filter.and(ocFilter);

        // AD-specific: exclude computer accounts which inherit objectClass=user
        if (props.type() == DirectoryType.ACTIVE_DIRECTORY) {
            filter.and(new HardcodedFilter("(!(objectClass=computer))"));
        }

        String emailAttr = props.emailAttribute();

        if (search != null && !search.isBlank()) {
            if (attr != null && !attr.isBlank() && !BASIC_SEARCH_ATTRS.contains(attr)) {
                // Specific LDAP attribute search
                filter.and(new LikeFilter(attr, "*" + search + "*"));
            } else if ("username".equals(attr)) {
                // Match either configured attr or the other directory's username attr — handles mixed deployments
                OrFilter unF = new OrFilter();
                unF.or(new LikeFilter(props.usernameAttribute(), "*" + search + "*"));
                for (String a : USERNAME_ATTRS) {
                    if (!a.equalsIgnoreCase(props.usernameAttribute())) unF.or(new LikeFilter(a, "*" + search + "*"));
                }
                filter.and(unF);
            } else if ("email".equals(attr)) {
                filter.and(new LikeFilter(emailAttr, "*" + search + "*"));
            } else if ("name".equals(attr)) {
                OrFilter nameFilter = new OrFilter();
                nameFilter.or(new LikeFilter("displayName", "*" + search + "*"));
                nameFilter.or(new LikeFilter("cn", "*" + search + "*"));
                filter.and(nameFilter);
            } else if ("title".equals(attr)) {
                filter.and(new LikeFilter("title", "*" + search + "*"));
            } else {
                // Default: search across common fields including both AD and OpenLDAP username attrs
                OrFilter searchFilter = new OrFilter();
                searchFilter.or(new LikeFilter(props.usernameAttribute(), "*" + search + "*"));
                for (String a : USERNAME_ATTRS) {
                    if (!a.equalsIgnoreCase(props.usernameAttribute())) searchFilter.or(new LikeFilter(a, "*" + search + "*"));
                }
                searchFilter.or(new LikeFilter("displayName", "*" + search + "*"));
                searchFilter.or(new LikeFilter("cn", "*" + search + "*"));
                searchFilter.or(new LikeFilter(emailAttr, "*" + search + "*"));
                filter.and(searchFilter);
            }
        }

        if (props.additionalFilter() != null && !props.additionalFilter().isBlank()) {
            filter.and(new HardcodedFilter(props.additionalFilter()));
        }

        ContextMapper<LdapUserResponse> mapper = ctx -> {
            DirContextOperations dco = (DirContextOperations) ctx;
            // username: try configured attribute, then fall back across schemas
            String username = dco.getStringAttribute(props.usernameAttribute());
            if (username == null) username = dco.getStringAttribute("uid");
            if (username == null) username = dco.getStringAttribute("sAMAccountName");
            if (username == null) username = dco.getStringAttribute("cn");
            if (username == null) return null;

            // displayName → cn fallback
            String displayName = dco.getStringAttribute("displayName");
            if (displayName == null) displayName = dco.getStringAttribute("cn");
            if (displayName == null) displayName = username;

            // email — use configured attribute first, then mail as a universal fallback
            String email = dco.getStringAttribute(emailAttr);
            if (email == null && !"mail".equalsIgnoreCase(emailAttr)) email = dco.getStringAttribute("mail");

            // groups
            List<String> groups = resolveGroups(dco, template, props, username);

            return new LdapUserResponse(username, email,
                    displayName, false,
                    dco.getStringAttribute("title"),
                    extractOu(dco.getNameInNamespace()), groups, null);
        };

        SearchControls sc = new SearchControls();
        sc.setSearchScope(SearchControls.SUBTREE_SCOPE);
        if (limit > 0) sc.setCountLimit(limit);

        try {
            return template.search(searchBase, filter.encode(), sc, mapper)
                    .stream().filter(u -> u != null).toList();
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            if (msg.toLowerCase().contains("sizelimit") || msg.toLowerCase().contains("size limit")) {
                log.debug("LDAP size limit ({}) reached for config={}", limit, config.getName());
            } else {
                log.error("LDAP user search failed for config={} baseDn={}: {}", config.getName(), baseDn, msg);
            }
            return Collections.emptyList();
        }
    }

    /**
     * Build the objectClass filter for user entries. Active Directory uses `user`; OpenLDAP uses
     * `inetOrgPerson` / `posixAccount`. UNKNOWN falls back to the broad union.
     */
    private OrFilter buildUserObjectClassFilter(LdapProps props) {
        OrFilter f = new OrFilter();
        if (props.type() == DirectoryType.ACTIVE_DIRECTORY) {
            f.or(new EqualsFilter("objectClass", "user"));
            if (props.userObjectClass() != null && !props.userObjectClass().isBlank()
                    && !"user".equalsIgnoreCase(props.userObjectClass())) {
                f.or(new EqualsFilter("objectClass", props.userObjectClass()));
            }
        } else if (props.type() == DirectoryType.OPENLDAP) {
            f.or(new EqualsFilter("objectClass", "inetOrgPerson"));
            f.or(new EqualsFilter("objectClass", "posixAccount"));
            f.or(new EqualsFilter("objectClass", "person"));
            if (props.userObjectClass() != null && !props.userObjectClass().isBlank()) {
                f.or(new EqualsFilter("objectClass", props.userObjectClass()));
            }
        } else {
            // UNKNOWN — broadest filter
            if (props.userObjectClass() != null && !props.userObjectClass().isBlank()) {
                f.or(new EqualsFilter("objectClass", props.userObjectClass()));
            }
            for (String oc : PERSON_CLASSES) f.or(new EqualsFilter("objectClass", oc));
        }
        return f;
    }

    /**
     * Resolve a user's group memberships.
     * • AD: read memberOf directly from the user entry.
     * • OpenLDAP: memberOf is not present unless the memberOf overlay is enabled, so do a reverse
     *   group search filtering by (member=<userDN>) (groupOfNames / groupOfUniqueNames) or
     *   (memberUid=<username>) (posixGroup).
     */
    private List<String> resolveGroups(DirContextOperations userCtx, LdapTemplate template,
                                       LdapProps props, String username) {
        // memberOf — works on AD and on OpenLDAP with the memberOf overlay
        String[] memberOf = userCtx.getStringAttributes("memberOf");
        if (memberOf != null && memberOf.length > 0) {
            return Arrays.stream(memberOf).map(this::rdnValue).filter(Objects::nonNull).toList();
        }

        // OpenLDAP fallback — reverse-search groups for this user
        if (props.type() == DirectoryType.OPENLDAP || props.type() == DirectoryType.UNKNOWN) {
            try {
                String userDn = userCtx.getNameInNamespace();
                SearchControls gsc = new SearchControls();
                gsc.setSearchScope(SearchControls.SUBTREE_SCOPE);
                gsc.setReturningAttributes(new String[]{"cn"});

                AndFilter gFilter = new AndFilter();
                OrFilter gOc = new OrFilter();
                gOc.or(new EqualsFilter("objectClass", "groupOfNames"));
                gOc.or(new EqualsFilter("objectClass", "groupOfUniqueNames"));
                gOc.or(new EqualsFilter("objectClass", "posixGroup"));
                gOc.or(new EqualsFilter("objectClass", "groupOfMembers"));
                gFilter.and(gOc);

                OrFilter mFilter = new OrFilter();
                mFilter.or(new EqualsFilter("member", userDn));
                mFilter.or(new EqualsFilter("uniqueMember", userDn));
                if (username != null) mFilter.or(new EqualsFilter("memberUid", username));
                gFilter.and(mFilter);

                ContextMapper<String> nameMapper = ctx -> {
                    DirContextOperations dco = (DirContextOperations) ctx;
                    String cn = dco.getStringAttribute("cn");
                    return cn != null ? cn : rdnValue(dco.getNameInNamespace());
                };
                List<String> found = template.search("", gFilter.encode(), gsc, nameMapper);
                return found.stream().filter(Objects::nonNull).distinct().toList();
            } catch (Exception e) {
                log.debug("OpenLDAP group reverse lookup failed for {}: {}", username, e.getMessage());
            }
        }

        return Collections.emptyList();
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

    private static final String[] TREE_ATTRS = {
            "objectClass", "cn", "ou", "dc", "sAMAccountName", "uid",
            "displayName", "mail", "title", "memberOf", "member", "uniqueMember",
            "memberUid", "description", "name"
    };
    private static final Set<String> GROUP_CLASSES = Set.of(
            "group", "groupofnames", "groupofuniquenames", "posixgroup", "groupofmembers"
    );
    private static final Set<String> OU_CLASSES = Set.of(
            "organizationalunit", "organization", "container", "builtindomain", "domain", "dcobject"
    );
    private static final Set<String> USER_CLASSES = Set.of(
            "person", "inetorgperson", "organizationalperson", "posixaccount", "user"
    );

    public List<LdapTreeNode> listLdapChildren(UUID configId, String parentDn, Set<String> activatedUsernames) {
        Set<String> normalizedActivated = activatedUsernames.stream()
                .map(String::toLowerCase).collect(java.util.stream.Collectors.toSet());
        LdapServerConfig config = configId != null ? ldapConfigService.get(configId) : primaryConfig();
        LdapProps props = propsFrom(config);
        LdapTemplate template = forConfig(config).template();
        String searchBase = toRelativeDn(parentDn, props.baseDn());

        // If expanding a specific node, check if it's a group → load by member refs
        if (!searchBase.isEmpty()) {
            try {
                DirContextOperations parentCtx = template.lookupContext(searchBase);
                String[] parentOcs = parentCtx.getStringAttributes("objectClass");
                if (parentOcs != null) {
                    Set<String> ocSet = new HashSet<>();
                    for (String oc : parentOcs) ocSet.add(oc.toLowerCase());
                    if (ocSet.stream().anyMatch(GROUP_CLASSES::contains)) {
                        return loadGroupMembers(parentCtx, template, props, normalizedActivated);
                    }
                }
            } catch (Exception e) {
                log.debug("Could not check parent type at '{}': {}", searchBase, e.getMessage());
            }
        }

        SearchControls controls = new SearchControls();
        controls.setSearchScope(SearchControls.ONELEVEL_SCOPE);
        controls.setReturningAttributes(TREE_ATTRS);

        ContextMapper<LdapTreeNode> mapper = ctx -> mapDcoToNode(
                (DirContextOperations) ctx, props, normalizedActivated);

        try {
            List<LdapTreeNode> results = template.search(searchBase, "(objectClass=*)", controls, mapper)
                    .stream().filter(n -> n != null).toList();

            // Some LDAP servers return nothing with ONELEVEL_SCOPE at root — fall back to SUBTREE direct children
            if (results.isEmpty() && searchBase.isEmpty()) {
                log.debug("ONELEVEL_SCOPE returned empty at root, trying SUBTREE fallback for baseDn={}", props.baseDn());
                SearchControls subtreeControls = new SearchControls();
                subtreeControls.setSearchScope(SearchControls.SUBTREE_SCOPE);
                subtreeControls.setReturningAttributes(TREE_ATTRS);
                List<LdapTreeNode> all = template.search(searchBase, "(objectClass=*)", subtreeControls, mapper)
                        .stream().filter(n -> n != null).toList();
                String baseDnLower = props.baseDn().toLowerCase();
                return all.stream()
                        .filter(n -> {
                            String parent = parentDnOf(n.dn());
                            return parent.equalsIgnoreCase(baseDnLower) || parent.toLowerCase().equals(baseDnLower);
                        })
                        .toList();
            }
            return results;
        } catch (Exception e) {
            String context = parentDn != null ? parentDn : "(root)";
            log.error("LDAP tree search failed for dn={}: {}", context, e.getMessage());
            throw new RuntimeException("LDAP directory search failed: " + e.getMessage(), e);
        }
    }

    private List<LdapTreeNode> loadGroupMembers(DirContextOperations groupCtx, LdapTemplate template,
                                                LdapProps props, Set<String> normalizedActivated) {
        List<LdapTreeNode> members = new ArrayList<>();
        Set<String> seenDns = new HashSet<>();

        // DN-based membership (group, groupOfNames, groupOfUniqueNames)
        for (String attr : List.of("member", "uniqueMember")) {
            String[] memberDns = groupCtx.getStringAttributes(attr);
            if (memberDns == null) continue;
            for (String memberDn : memberDns) {
                if (memberDn == null || memberDn.isBlank() || !seenDns.add(memberDn.toLowerCase())) continue;
                // Skip RFC placeholder for empty groups
                String rdnPart = memberDn.split(",")[0].trim().toLowerCase();
                if (rdnPart.equals("cn=empty") || rdnPart.equals("cn=dummy")) continue;
                try {
                    String relDn = toRelativeDn(memberDn, props.baseDn());
                    DirContextOperations memberCtx = template.lookupContext(
                            relDn.isEmpty() ? memberDn : relDn);
                    LdapTreeNode node = mapDcoToNode(memberCtx, props, normalizedActivated);
                    if (node != null) members.add(node);
                } catch (Exception e) {
                    log.debug("Could not lookup group member '{}': {}", memberDn, e.getMessage());
                }
            }
        }

        // UID-based membership (posixGroup memberUid)
        String[] memberUids = groupCtx.getStringAttributes("memberUid");
        if (memberUids != null) {
            SearchControls sc = new SearchControls();
            sc.setSearchScope(SearchControls.SUBTREE_SCOPE);
            sc.setReturningAttributes(TREE_ATTRS);
            for (String uid : memberUids) {
                if (uid == null || uid.isBlank()) continue;
                try {
                    ContextMapper<LdapTreeNode> uidMapper =
                            ctx -> mapDcoToNode((DirContextOperations) ctx, props, normalizedActivated);
                    List<LdapTreeNode> found = template.search("",
                            "(&(objectClass=*)(|(uid=" + uid + ")(sAMAccountName=" + uid + ")))",
                            sc, uidMapper);
                    for (LdapTreeNode n : found) {
                        if (n != null && seenDns.add(n.dn().toLowerCase())) members.add(n);
                    }
                } catch (Exception e) {
                    log.debug("Could not lookup posixGroup memberUid '{}': {}", uid, e.getMessage());
                }
            }
        }

        return members;
    }

    private LdapTreeNode mapDcoToNode(DirContextOperations dco, LdapProps props, Set<String> normalizedActivated) {
        try {
            String dn = dco.getNameInNamespace();
            String rdn = dn.contains(",") ? dn.substring(0, dn.indexOf(',')) : dn;
            String[] objectClasses = dco.getStringAttributes("objectClass");
            if (objectClasses == null) objectClasses = new String[0];
            Set<String> ocSet = new HashSet<>();
            for (String oc : objectClasses) ocSet.add(oc.toLowerCase());

            if (ocSet.stream().anyMatch(OU_CLASSES::contains)) {
                String name = dco.getStringAttribute("ou");
                if (name == null) name = dco.getStringAttribute("o");
                if (name == null) name = dco.getStringAttribute("dc");
                if (name == null) name = rdnValue(rdn);
                return LdapTreeNode.ou(dn, rdn, name, true);
            }

            if (ocSet.stream().anyMatch(GROUP_CLASSES::contains)) {
                String name = dco.getStringAttribute("cn");
                if (name == null) name = dco.getStringAttribute("name");
                if (name == null) name = rdnValue(rdn);
                boolean hasMembers = dco.getStringAttributes("member") != null
                        || dco.getStringAttributes("uniqueMember") != null
                        || dco.getStringAttributes("memberUid") != null;
                return LdapTreeNode.group(dn, rdn, name, hasMembers);
            }

            String configuredClass = props.userObjectClass().toLowerCase();
            if (ocSet.contains(configuredClass) || ocSet.stream().anyMatch(USER_CLASSES::contains)) {
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
                boolean isActivated = username != null && normalizedActivated.contains(username.toLowerCase());
                return LdapTreeNode.user(dn, rdn, displayName, username,
                        dco.getStringAttribute("mail"), dco.getStringAttribute("title"), isActivated, groups);
            }

            String name = dco.getStringAttribute("cn");
            if (name == null) name = dco.getStringAttribute("name");
            if (name == null) name = rdnValue(rdn);
            return LdapTreeNode.other(dn, rdn, name);
        } catch (Exception e) {
            log.debug("Failed to map LDAP entry: {}", e.getMessage());
            return null;
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
