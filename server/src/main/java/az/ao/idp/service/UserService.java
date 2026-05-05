package az.ao.idp.service;

import az.ao.idp.entity.Application;
import az.ao.idp.entity.User;
import az.ao.idp.entity.UserAppAccess;
import az.ao.idp.exception.ResourceNotFoundException;
import az.ao.idp.repository.ApplicationRepository;
import az.ao.idp.repository.UserAppAccessRepository;
import az.ao.idp.repository.UserRepository;
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

    private final UserRepository userRepository;
    private final UserAppAccessRepository userAppAccessRepository;
    private final ApplicationRepository applicationRepository;
    private final AuditService auditService;

    public UserService(
            UserRepository userRepository,
            UserAppAccessRepository userAppAccessRepository,
            ApplicationRepository applicationRepository,
            AuditService auditService
    ) {
        this.userRepository = userRepository;
        this.userAppAccessRepository = userAppAccessRepository;
        this.applicationRepository = applicationRepository;
        this.auditService = auditService;
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
        auditService.log("admin", adminId, "app_access_revoked", "application", appId.toString(), null, null, null,
                Map.of("user_id", userId.toString(),
                        "user_display_name", revokedUser != null ? revokedUser.getDisplayName() : userId.toString(),
                        "user_ldap_username", revokedUser != null ? revokedUser.getLdapUsername() : "",
                        "app_id", appId.toString(), "app_name", revokedAppName));
    }

    public boolean hasAppAccess(UUID userId, UUID appId) {
        return userAppAccessRepository.existsByUserIdAndAppId(userId, appId);
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
