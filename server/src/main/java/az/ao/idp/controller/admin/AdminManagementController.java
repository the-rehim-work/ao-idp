package az.ao.idp.controller.admin;

import az.ao.idp.dto.request.CreateAdminRequest;
import az.ao.idp.entity.AdminUser;
import az.ao.idp.service.AdminAuthService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/api/v1/admins")
@Tag(name = "Admin — Management", description = "Admin user management and per-app scope assignments (idp_admin only)")
@SecurityRequirement(name = "AdminBearerAuth")
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
                .body(adminAuthService.createAdmin(request, getAdminId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AdminUser> get(@PathVariable UUID id) {
        return ResponseEntity.ok(adminAuthService.getAdmin(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        adminAuthService.deactivateAdmin(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/app-scopes")
    public ResponseEntity<Void> addScope(
            @PathVariable UUID id,
            @RequestBody java.util.Map<String, String> body
    ) {
        UUID appId = UUID.fromString(body.get("application_id"));
        adminAuthService.addAppScope(id, appId);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{id}/app-scopes/{appId}")
    public ResponseEntity<Void> removeScope(@PathVariable UUID id, @PathVariable UUID appId) {
        adminAuthService.removeAppScope(id, appId);
        return ResponseEntity.noContent().build();
    }

    private String getAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "unknown";
    }
}
