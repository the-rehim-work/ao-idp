package az.ao.idp.controller.admin;

import az.ao.idp.service.IdpSettingsService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/api/v1/settings")
@Tag(name = "Admin — IDP Settings", description = "Token expiry and JWT claim configuration")
@SecurityRequirement(name = "AdminBearerAuth")
@PreAuthorize("hasRole('IDP_ADMIN')")
public class AdminSettingsController {

    private final IdpSettingsService settingsService;

    public AdminSettingsController(IdpSettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAll() {
        return ResponseEntity.ok(settingsService.getAllSettings());
    }

    @GetMapping("/tokens")
    public ResponseEntity<IdpSettingsService.TokenSettings> getTokenSettings() {
        return ResponseEntity.ok(settingsService.getTokenSettings());
    }

    @PutMapping("/tokens")
    public ResponseEntity<IdpSettingsService.TokenSettings> updateTokenSettings(@RequestBody Map<String, Long> body) {
        settingsService.setTokenSettings(
                body.getOrDefault("accessTokenExpiryMinutes", 15L),
                body.getOrDefault("refreshTokenExpiryDays", 7L),
                body.getOrDefault("adminTokenExpiryMinutes", 30L)
        );
        return ResponseEntity.ok(settingsService.getTokenSettings());
    }

    @GetMapping("/claims")
    public ResponseEntity<List<IdpSettingsService.ClaimMapping>> getClaimMappings() {
        return ResponseEntity.ok(settingsService.getClaimMappings());
    }

    @PutMapping("/claims")
    public ResponseEntity<List<IdpSettingsService.ClaimMapping>> updateClaimMappings(
            @RequestBody List<IdpSettingsService.ClaimMapping> mappings) {
        settingsService.setClaimMappings(mappings);
        return ResponseEntity.ok(settingsService.getClaimMappings());
    }
}
