package az.ao.idp.controller.admin;

import az.ao.idp.dto.request.ChangePasswordRequest;
import az.ao.idp.dto.request.CreateAdminRequest;
import az.ao.idp.dto.request.UpdateAdminRequest;
import az.ao.idp.entity.AdminUser;
import az.ao.idp.service.AdminAuthService;
import io.jsonwebtoken.Claims;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin/api/v1/admins")
@Tag(name = "Admin — Management", description = "Admin user management (idp_admin only)")
@SecurityRequirement(name = "AdminBearerAuth")
@PreAuthorize("hasRole('IDP_ADMIN')")
public class AdminManagementController {

    private final AdminAuthService adminAuthService;

    public AdminManagementController(AdminAuthService adminAuthService) {
        this.adminAuthService = adminAuthService;
    }

    @GetMapping
    public ResponseEntity<List<AdminUser>> list() {
        return ResponseEntity.ok(adminAuthService.listAdmins());
    }

    @PostMapping
    public ResponseEntity<AdminUser> create(@Valid @RequestBody CreateAdminRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adminAuthService.createAdmin(request, getAdminId().toString()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AdminUser> get(@PathVariable UUID id) {
        return ResponseEntity.ok(adminAuthService.getAdmin(id));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<AdminUser> update(@PathVariable UUID id, @Valid @RequestBody UpdateAdminRequest request) {
        return ResponseEntity.ok(adminAuthService.updateAdmin(id, request.displayName(), request.adminType(), getAdminId().toString()));
    }

    @PatchMapping("/{id}/activate")
    public ResponseEntity<AdminUser> activate(@PathVariable UUID id) {
        return ResponseEntity.ok(adminAuthService.activateAdmin(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        adminAuthService.deactivateAdmin(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/password")
    public ResponseEntity<Void> resetPassword(@PathVariable UUID id, @Valid @RequestBody ChangePasswordRequest request) {
        adminAuthService.resetAdminPassword(id, request.newPassword(), getAdminId().toString());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/app-scopes")
    public ResponseEntity<List<UUID>> getScopes(@PathVariable UUID id) {
        return ResponseEntity.ok(adminAuthService.getAppScopes(id));
    }

    @PostMapping("/{id}/app-scopes")
    public ResponseEntity<Void> addScope(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        adminAuthService.addAppScope(id, UUID.fromString(body.get("application_id")));
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{id}/app-scopes/{appId}")
    public ResponseEntity<Void> removeScope(@PathVariable UUID id, @PathVariable UUID appId) {
        adminAuthService.removeAppScope(id, appId);
        return ResponseEntity.noContent().build();
    }

    private UUID getAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getDetails() instanceof Claims claims) {
            return UUID.fromString(claims.getSubject());
        }
        return UUID.fromString(auth.getName());
    }
}
