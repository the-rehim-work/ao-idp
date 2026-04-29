package az.ao.idp.service;

import az.ao.idp.dto.request.CreateAppRequest;
import az.ao.idp.dto.response.AppResponse;
import az.ao.idp.entity.Application;
import az.ao.idp.exception.ResourceNotFoundException;
import az.ao.idp.repository.ApplicationRepository;
import az.ao.idp.repository.UserAppAccessRepository;
import az.ao.idp.util.SecureRandomUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final UserAppAccessRepository userAppAccessRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandomUtil secureRandomUtil;
    private final AuditService auditService;

    public ApplicationService(
            ApplicationRepository applicationRepository,
            UserAppAccessRepository userAppAccessRepository,
            PasswordEncoder passwordEncoder,
            SecureRandomUtil secureRandomUtil,
            AuditService auditService
    ) {
        this.applicationRepository = applicationRepository;
        this.userAppAccessRepository = userAppAccessRepository;
        this.passwordEncoder = passwordEncoder;
        this.secureRandomUtil = secureRandomUtil;
        this.auditService = auditService;
    }

    public List<Application> listAll() {
        return applicationRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<Application> listActive() {
        return applicationRepository.findAllByActiveTrueOrderByCreatedAtDesc();
    }

    public Application getById(UUID id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found: " + id));
    }

    public Application getByClientId(String clientId) {
        return applicationRepository.findByClientId(clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found for client_id: " + clientId));
    }

    @Transactional
    public AppResponse create(CreateAppRequest request, String adminId) {
        if (applicationRepository.existsBySlug(request.slug())) {
            throw new IllegalStateException("Slug already in use: " + request.slug());
        }

        String rawClientId = secureRandomUtil.generateClientId();
        String rawClientSecret = request.publicClient() ? null : secureRandomUtil.generateClientSecret();

        Application app = new Application();
        app.setName(request.name());
        app.setSlug(request.slug());
        app.setClientId(rawClientId);
        app.setPublicClient(request.publicClient());
        if (rawClientSecret != null) {
            app.setClientSecretHash(passwordEncoder.encode(rawClientSecret));
        }
        app.setRedirectUris(request.redirectUris().toArray(new String[0]));
        if (request.allowedOrigins() != null) {
            app.setAllowedOrigins(request.allowedOrigins().toArray(new String[0]));
        }
        app.setActive(true);

        Application saved = applicationRepository.save(app);
        auditService.log("admin", adminId, "app_registered", "application", saved.getId().toString(), saved, null, null,
                Map.of(
                        "app_name", saved.getName(),
                        "client_id", rawClientId,
                        "slug", saved.getSlug(),
                        "type", saved.isPublicClient() ? "public" : "confidential",
                        "redirect_uris", Arrays.toString(saved.getRedirectUris())
                ));

        return toResponse(saved, rawClientSecret);
    }

    @Transactional
    public Application update(UUID id, CreateAppRequest request, String adminId) {
        Application app = getById(id);
        app.setName(request.name());
        app.setRedirectUris(request.redirectUris().toArray(new String[0]));
        if (request.allowedOrigins() != null) {
            app.setAllowedOrigins(request.allowedOrigins().toArray(new String[0]));
        }
        auditService.log("admin", adminId, "app_updated", "application", id.toString(), app, null, null,
                Map.of(
                        "app_name", request.name(),
                        "slug", app.getSlug(),
                        "client_id", app.getClientId(),
                        "type", app.isPublicClient() ? "public" : "confidential",
                        "redirect_uris", request.redirectUris().toString()
                ));
        return applicationRepository.save(app);
    }

    @Transactional
    public Application deactivate(UUID id, String adminId) {
        Application app = getById(id);
        if (!app.isActive()) {
            throw new IllegalStateException("Application is already inactive: " + id);
        }
        app.setActive(false);
        Application saved = applicationRepository.save(app);
        long affectedUsers = userAppAccessRepository.countByAppId(id);
        auditService.log("admin", adminId, "app_deactivated", "application", id.toString(), saved, null, null,
                Map.of(
                        "app_name", app.getName(),
                        "client_id", app.getClientId(),
                        "slug", app.getSlug(),
                        "affected_users", affectedUsers
                ));
        return saved;
    }

    @Transactional
    public Application activate(UUID id, String adminId) {
        Application app = getById(id);
        if (app.isActive()) {
            throw new IllegalStateException("Application is already active: " + id);
        }
        app.setActive(true);
        Application saved = applicationRepository.save(app);
        auditService.log("admin", adminId, "app_activated", "application", id.toString(), saved, null, null,
                Map.of(
                        "app_name", app.getName(),
                        "client_id", app.getClientId(),
                        "slug", app.getSlug()
                ));
        return saved;
    }

    @Transactional
    public void delete(UUID id, String adminId) {
        Application app = getById(id);
        long affectedUsers = userAppAccessRepository.countByAppId(id);
        userAppAccessRepository.deleteByAppId(id);
        auditService.log("admin", adminId, "app_deleted", "application", id.toString(), null, null, null,
                Map.of(
                        "app_name", app.getName(),
                        "client_id", app.getClientId(),
                        "slug", app.getSlug(),
                        "was_active", app.isActive(),
                        "revoked_user_access_count", affectedUsers
                ));
        applicationRepository.delete(app);
    }

    public AppResponse toResponse(Application app, String plainClientSecret) {
        return new AppResponse(
                app.getId(), app.getName(), app.getSlug(), app.getClientId(),
                plainClientSecret,
                app.getRedirectUris() != null ? Arrays.asList(app.getRedirectUris()) : List.of(),
                app.getAllowedOrigins() != null ? Arrays.asList(app.getAllowedOrigins()) : List.of(),
                app.isActive(), app.isPublicClient(), app.getCreatedAt()
        );
    }

    public AppResponse toResponse(Application app) {
        return toResponse(app, null);
    }
}
