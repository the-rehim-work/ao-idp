package az.ao.idp.service;

import az.ao.idp.dto.request.CreateAdminRequest;
import az.ao.idp.dto.response.AdminTokenResponse;
import az.ao.idp.entity.AdminAppScope;
import az.ao.idp.entity.AdminAppScopeId;
import az.ao.idp.entity.AdminUser;
import az.ao.idp.entity.Application;
import az.ao.idp.exception.AuthenticationException;
import az.ao.idp.exception.ResourceNotFoundException;
import az.ao.idp.repository.AdminAppScopeRepository;
import az.ao.idp.repository.AdminUserRepository;
import az.ao.idp.repository.ApplicationRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AdminAuthService {

    private final AdminUserRepository adminUserRepository;
    private final ApplicationRepository applicationRepository;
    private final AdminAppScopeRepository adminAppScopeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditService auditService;

    public AdminAuthService(
            AdminUserRepository adminUserRepository,
            ApplicationRepository applicationRepository,
            AdminAppScopeRepository adminAppScopeRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuditService auditService
    ) {
        this.adminUserRepository = adminUserRepository;
        this.applicationRepository = applicationRepository;
        this.adminAppScopeRepository = adminAppScopeRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditService = auditService;
    }

    public AdminTokenResponse login(String username, String password, String ipAddress) {
        AdminUser admin = adminUserRepository.findByUsername(username)
                .orElseThrow(() -> new AuthenticationException("Invalid credentials"));

        if (!admin.isActive()) {
            throw new AuthenticationException("Account disabled");
        }
        if (!passwordEncoder.matches(password, admin.getPasswordHash())) {
            throw new AuthenticationException("Invalid credentials");
        }

        List<UUID> scopedAppIds = getScopedAppIds(admin);
        String token = jwtService.issueAdminToken(admin.getId(), username, admin.getAdminType(), admin.getDisplayName(), scopedAppIds);

        auditService.log("admin", admin.getId().toString(), "admin_login", null, null, null, ipAddress, null,
                Map.of("admin_username", username, "admin_type", admin.getAdminType(), "display_name", admin.getDisplayName()));

        return new AdminTokenResponse(token, admin.getAdminType(), admin.getDisplayName(), 1800);
    }

    @Transactional
    public AdminUser createAdmin(CreateAdminRequest request, String createdByAdminId) {
        if (adminUserRepository.existsByUsername(request.username())) {
            throw new IllegalStateException("Username already taken: " + request.username());
        }
        AdminUser admin = new AdminUser();
        admin.setUsername(request.username());
        admin.setPasswordHash(passwordEncoder.encode(request.password()));
        admin.setDisplayName(request.displayName());
        admin.setAdminType(request.adminType());
        admin.setActive(true);
        AdminUser saved = adminUserRepository.save(admin);
        auditService.log("admin", createdByAdminId, "admin_created", "admin", saved.getId().toString(), null, null, null,
                Map.of("admin_username", saved.getUsername(), "admin_type", saved.getAdminType(),
                        "display_name", saved.getDisplayName()));
        return saved;
    }

    public List<AdminUser> listAdmins() {
        return adminUserRepository.findAll();
    }

    public AdminUser getAdmin(UUID id) {
        return adminUserRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found: " + id));
    }

    public List<UUID> getAppScopes(UUID adminId) {
        return adminAppScopeRepository.findApplicationIdsByAdminUserId(adminId);
    }

    @Transactional
    public void addAppScope(UUID adminId, UUID appId) {
        AdminUser admin = getAdmin(adminId);
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found"));
        AdminAppScopeId scopeId = new AdminAppScopeId(adminId, appId);
        if (!adminAppScopeRepository.existsById(scopeId)) {
            adminAppScopeRepository.save(new AdminAppScope(admin, app));
        }
    }

    @Transactional
    public void removeAppScope(UUID adminId, UUID appId) {
        adminAppScopeRepository.deleteById_AdminUserIdAndId_ApplicationId(adminId, appId);
    }

    @Transactional
    public void deactivateAdmin(UUID adminId) {
        AdminUser admin = getAdmin(adminId);
        admin.setActive(false);
        adminUserRepository.save(admin);
        auditService.log("admin", adminId.toString(), "admin_deactivated", null, null, null, null, null,
                Map.of("admin_username", admin.getUsername()));
    }

    @Transactional
    public AdminUser activateAdmin(UUID adminId) {
        AdminUser admin = getAdmin(adminId);
        admin.setActive(true);
        AdminUser saved = adminUserRepository.save(admin);
        auditService.log("admin", adminId.toString(), "admin_activated", null, null, null, null, null,
                Map.of("admin_username", admin.getUsername()));
        return saved;
    }

    @Transactional
    public AdminUser updateAdmin(UUID adminId, String displayName, String adminType, String updatedByAdminId) {
        AdminUser admin = getAdmin(adminId);
        admin.setDisplayName(displayName);
        admin.setAdminType(adminType);
        AdminUser saved = adminUserRepository.save(admin);
        auditService.log("admin", updatedByAdminId, "admin_updated", "admin", adminId.toString(), null, null, null,
                Map.of("admin_username", admin.getUsername(), "new_type", adminType, "new_display_name", displayName));
        return saved;
    }

    @Transactional
    public void changeOwnPassword(UUID adminId, String currentPassword, String newPassword) {
        AdminUser admin = getAdmin(adminId);
        if (!passwordEncoder.matches(currentPassword, admin.getPasswordHash())) {
            throw new AuthenticationException("Current password is incorrect");
        }
        admin.setPasswordHash(passwordEncoder.encode(newPassword));
        adminUserRepository.save(admin);
        auditService.log("admin", adminId.toString(), "admin_password_changed", null, null, null, null, null,
                Map.of("admin_username", admin.getUsername()));
    }

    @Transactional
    public void resetAdminPassword(UUID adminId, String newPassword, String requestedByAdminId) {
        AdminUser admin = getAdmin(adminId);
        admin.setPasswordHash(passwordEncoder.encode(newPassword));
        adminUserRepository.save(admin);
        auditService.log("admin", requestedByAdminId, "admin_password_reset", "admin", adminId.toString(), null, null, null,
                Map.of("admin_username", admin.getUsername()));
    }

    public AdminUser getCurrentAdmin(UUID adminId) {
        return getAdmin(adminId);
    }

    private List<UUID> getScopedAppIds(AdminUser admin) {
        if ("idp_admin".equals(admin.getAdminType())) {
            return List.of();
        }
        return adminAppScopeRepository.findApplicationIdsByAdminUserId(admin.getId());
    }
}
