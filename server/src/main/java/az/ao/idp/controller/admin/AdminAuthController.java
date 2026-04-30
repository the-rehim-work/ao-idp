package az.ao.idp.controller.admin;

import az.ao.idp.dto.request.AdminLoginRequest;
import az.ao.idp.dto.request.ChangePasswordRequest;
import az.ao.idp.dto.response.AdminTokenResponse;
import az.ao.idp.entity.AdminUser;
import az.ao.idp.service.AdminAuthService;
import io.jsonwebtoken.Claims;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/admin/api/v1/auth")
@Tag(name = "Admin — Auth", description = "Admin authentication and profile management")
public class AdminAuthController {

    private final AdminAuthService adminAuthService;

    public AdminAuthController(AdminAuthService adminAuthService) {
        this.adminAuthService = adminAuthService;
    }

    @PostMapping("/login")
    @Operation(summary = "Admin login")
    public ResponseEntity<AdminTokenResponse> login(
            @Valid @RequestBody AdminLoginRequest request,
            HttpServletRequest httpRequest
    ) {
        String ip = httpRequest.getHeader("X-Forwarded-For");
        if (ip == null) ip = httpRequest.getRemoteAddr();
        return ResponseEntity.ok(adminAuthService.login(request.username(), request.password(), ip));
    }

    @GetMapping("/me")
    @Operation(summary = "Get current admin profile")
    @SecurityRequirement(name = "AdminBearerAuth")
    public ResponseEntity<AdminUser> me() {
        return ResponseEntity.ok(adminAuthService.getCurrentAdmin(getAdminId()));
    }

    @PostMapping("/change-password")
    @Operation(summary = "Change own password")
    @SecurityRequirement(name = "AdminBearerAuth")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        adminAuthService.changeOwnPassword(getAdminId(), request.currentPassword(), request.newPassword());
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
