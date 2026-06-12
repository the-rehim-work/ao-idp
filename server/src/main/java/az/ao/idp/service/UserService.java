package az.ao.idp.service;

import az.ao.idp.entity.AppAccessRule;
import az.ao.idp.entity.Application;
import az.ao.idp.entity.User;
import az.ao.idp.entity.UserAppAccess;
import az.ao.idp.exception.ResourceNotFoundException;
import az.ao.idp.repository.AppAccessRuleRepository;
import az.ao.idp.repository.ApplicationRepository;
import az.ao.idp.repository.UserAppAccessRepository;
import az.ao.idp.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final UserAppAccessRepository userAppAccessRepository;
    private final ApplicationRepository applicationRepository;
    private final AppAccessRuleRepository appAccessRuleRepository;
    private final AuditService auditService;
    private final LdapService ldapService;

    public UserService(
            UserRepository userRepository,
            UserAppAccessRepository userAppAccessRepository,
            ApplicationRepository applicationRepository,
            AppAccessRuleRepository appAccessRuleRepository,
            AuditService auditService,
            LdapService ldapService
    ) {
        this.userRepository = userRepository;
        this.userAppAccessRepository = userAppAccessRepository;
        this.applicationRepository = applicationRepository;
        this.appAccessRuleRepository = appAccessRuleRepository;
        this.auditService = auditService;
        this.ldapService = ldapService;
    }

    public User getById(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }

    public User getByLdapUsername(String ldapUsername) {
        return userRepository.findByLdapUsername(ldapUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + ldapUsername));
    }

    public Optional<User> findByLdapUsername(String ldapUsername) {
        return userRepository.findByLdapUsername(ldapUsername);
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email);
    }

    @Transactional
    public User activateFromLdap(String ldapUsername, LdapService.LdapUserAttributes attrs, UUID ldapServerId) {
        return userRepository.findByLdapUsername(ldapUsername).orElseGet(() -> {
            User u = new User();
            u.setLdapUsername(ldapUsername);
            u.setDisplayName(attrs.displayName() != null ? attrs.displayName() : ldapUsername);
            u.setEmail(attrs.email());
            u.setLdapServerId(ldapServerId);
            u.setActive(true);
            User saved = userRepository.save(u);
            log.info("User auto-enrolled: ldapUsername={} ldapServerId={}", ldapUsername, ldapServerId);
            return saved;
        });
    }

    @Transactional
    public User activateUser(String ldapUsername, String email, String displayName, String adminId) {
        if (userRepository.existsByLdapUsername(ldapUsername)) {
            throw new IllegalStateException("User already activated: " + ldapUsername);
        }
        User user = new User();
        user.setLdapUsername(ldapUsername);
        user.setEmail(email);
        user.setDisplayName(displayName);
        user.setActive(true);
        User saved = userRepository.save(user);
        log.info("User activated: ldapUsername={} email={} by admin={}", ldapUsername, email, adminId);
        auditService.log("admin", adminId, "user_activated", "user", saved.getId().toString(), null, null, null,
                Map.of("user_id", saved.getId().toString(), "ldap_username", ldapUsername,
                        "display_name", displayName != null ? displayName : ldapUsername,
                        "email", email != null ? email : ""));
        return saved;
    }

    @Transactional
    public void grantAppAccess(UUID userId, UUID appId, String adminId) {
        if (!userAppAccessRepository.existsByUserIdAndAppId(userId, appId)) {
            userAppAccessRepository.save(new UserAppAccess(userId, appId));
            String grantedAppName = applicationRepository.findById(appId).map(Application::getName).orElse(appId.toString());
            User grantedUser = userRepository.findById(userId).orElse(null);
            log.info("App access granted: userId={} app={} by admin={}", userId, grantedAppName, adminId);
            auditService.log("admin", adminId, "app_access_granted", "application", appId.toString(), null, null, null,
                    Map.of("user_id", userId.toString(),
                            "user_display_name", grantedUser != null ? grantedUser.getDisplayName() : userId.toString(),
                            "user_ldap_username", grantedUser != null ? grantedUser.getLdapUsername() : "",
                            "app_id", appId.toString(), "app_name", grantedAppName));
        }
    }

    @Transactional
    public void revokeAppAccess(UUID userId, UUID appId, String adminId) {
        userAppAccessRepository.deleteByUserIdAndAppId(userId, appId);
        String revokedAppName = applicationRepository.findById(appId).map(Application::getName).orElse(appId.toString());
        User revokedUser = userRepository.findById(userId).orElse(null);
        log.info("App access revoked: userId={} app={} by admin={}", userId, revokedAppName, adminId);
        auditService.log("admin", adminId, "app_access_revoked", "application", appId.toString(), null, null, null,
                Map.of("user_id", userId.toString(),
                        "user_display_name", revokedUser != null ? revokedUser.getDisplayName() : userId.toString(),
                        "user_ldap_username", revokedUser != null ? revokedUser.getLdapUsername() : "",
                        "app_id", appId.toString(), "app_name", revokedAppName));
    }

    public boolean hasAppAccess(UUID userId, UUID appId) {
        if (userAppAccessRepository.existsByUserIdAndAppId(userId, appId)) return true;

        Application app = applicationRepository.findById(appId).orElse(null);
        if (app == null) return false;

        return switch (app.getAccessMode()) {
            case ASSIGNED -> false;
            case PUBLIC -> true;
            case LDAP_GROUP -> checkGroupAccess(userId, app);
            case LDAP_OU -> checkOuAccess(userId, app);
        };
    }

    private boolean checkGroupAccess(UUID userId, Application app) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getLdapUsername() == null) return false;
        List<AppAccessRule> rules = appAccessRuleRepository.findAllByAppId(app.getId()).stream()
                .filter(r -> "LDAP_GROUP".equals(r.getRuleType())).toList();
        if (rules.isEmpty()) return false;

        List<String> groups = null;
        for (AppAccessRule rule : rules) {
            if (rule.getLdapServerId() != null && !rule.getLdapServerId().equals(user.getLdapServerId())) continue;
            if (groups == null) groups = ldapService.getUserGroups(user.getLdapUsername(), user.getLdapServerId());
            if (groups.stream().anyMatch(g -> g.equalsIgnoreCase(rule.getValue()))) return true;
        }
        return false;
    }

    private boolean checkOuAccess(UUID userId, Application app) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getLdapUsername() == null) return false;
        List<AppAccessRule> rules = appAccessRuleRepository.findAllByAppId(app.getId()).stream()
                .filter(r -> "LDAP_OU".equals(r.getRuleType())).toList();
        if (rules.isEmpty()) return false;

        String userDn = ldapService.getUserDn(user.getLdapUsername(), user.getLdapServerId());
        if (userDn == null) return false;
        String normalizedUserDn = normalizeDn(userDn);
        for (AppAccessRule rule : rules) {
            if (rule.getLdapServerId() != null && !rule.getLdapServerId().equals(user.getLdapServerId())) continue;
            if (normalizedUserDn.endsWith(normalizeDn(rule.getValue()))) return true;
        }
        return false;
    }

    private static String normalizeDn(String dn) {
        if (dn == null) return "";
        return dn.replaceAll("\\s*,\\s*", ",").replaceAll("\\s*=\\s*", "=").toLowerCase();
    }

    public record AppAccessView(UUID appId, String appName, String clientId, Instant grantedAt) {}

    public List<AppAccessView> getUserAppAccess(UUID userId) {
        List<UserAppAccess> accesses = userAppAccessRepository.findAllByUserId(userId);
        List<UUID> appIds = accesses.stream().map(UserAppAccess::getAppId).toList();
        Map<UUID, Application> appsById = applicationRepository.findAllById(appIds).stream()
                .collect(Collectors.toMap(Application::getId, a -> a));
        return accesses.stream()
                .map(a -> {
                    Application app = appsById.get(a.getAppId());
                    return new AppAccessView(
                            a.getAppId(),
                            app != null ? app.getName() : "unknown",
                            app != null ? app.getClientId() : "unknown",
                            a.getGrantedAt()
                    );
                })
                .toList();
    }

    @Transactional
    public void deactivate(UUID userId, String adminId) {
        User user = getById(userId);
        user.setActive(false);
        userRepository.save(user);
        log.info("User deactivated: ldapUsername={} by admin={}", user.getLdapUsername(), adminId);
        auditService.log("admin", adminId, "user_deactivated", "user", userId.toString(), null, null, null,
                Map.of("user_id", userId.toString(), "ldap_username", user.getLdapUsername(),
                        "display_name", user.getDisplayName()));
    }

    @Transactional
    public void updateLastLogin(UUID userId) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setLastLoginAt(Instant.now());
            userRepository.save(user);
        });
    }

    @Transactional
    public void updateLdapServerId(UUID userId, UUID ldapServerId) {
        userRepository.findById(userId).ifPresent(user -> {
            if (!Objects.equals(user.getLdapServerId(), ldapServerId)) {
                user.setLdapServerId(ldapServerId);
                userRepository.save(user);
            }
        });
    }

    public Page<User> searchUsers(String search, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        if (search == null || search.isBlank()) {
            return userRepository.findAllByActiveTrue(pageable);
        }
        return userRepository.searchActiveUsers(search.trim(), pageable);
    }

    public boolean userExistsByLdapUsername(String ldapUsername) {
        return userRepository.existsByLdapUsername(ldapUsername);
    }

    public Set<String> getAllActivatedLdapUsernames() {
        return userRepository.findAllByActiveTrue(Pageable.unpaged()).stream()
                .map(u -> u.getLdapUsername().toLowerCase())
                .collect(Collectors.toSet());
    }

    public Page<User> getUsersForApp(UUID appId, String search, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        if (search == null || search.isBlank()) {
            return userRepository.findActiveUsersByAppId(appId, pageable);
        }
        return userRepository.searchActiveUsersByAppId(appId, search.trim(), pageable);
    }
}
