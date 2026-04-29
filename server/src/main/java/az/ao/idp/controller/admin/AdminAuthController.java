package az.ao.idp.controller.admin;

import az.ao.idp.dto.request.AdminLoginRequest;
import az.ao.idp.dto.response.AdminTokenResponse;
import az.ao.idp.service.AdminAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/api/v1/auth")
@Tag(name = "Admin — Auth", description = "Admin authentication. Returns a short-lived JWT for use in all /admin/api/** endpoints.")
public class AdminAuthController {

    private final AdminAuthService adminAuthService;

    public AdminAuthController(AdminAuthService adminAuthService) {
        this.adminAuthService = adminAuthService;
    }

    @PostMapping("/login")
    @Operation(summary = "Admin login", description = "Authenticates with username/password and returns an admin JWT")
    public ResponseEntity<AdminTokenResponse> login(
            @Valid @RequestBody AdminLoginRequest request,
            HttpServletRequest httpRequest
    ) {
        String ip = httpRequest.getHeader("X-Forwarded-For");
        if (ip == null) ip = httpRequest.getRemoteAddr();
        return ResponseEntity.ok(adminAuthService.login(request.username(), request.password(), ip));
    }
}
