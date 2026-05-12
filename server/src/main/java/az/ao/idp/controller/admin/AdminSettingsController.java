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

    @GetMapping("/login")
    public ResponseEntity<IdpSettingsService.LoginSettings> getLoginSettings() {
        return ResponseEntity.ok(settingsService.getLoginSettings());
    }

    @PutMapping("/login")
    public ResponseEntity<IdpSettingsService.LoginSettings> updateLoginSettings(@RequestBody Map<String, Object> body) {
        String identifierType = (String) body.get("identifierType");
        String pageTitle = (String) body.get("pageTitle");
        int logRetentionDays = body.containsKey("logRetentionDays")
                ? ((Number) body.get("logRetentionDays")).intValue() : 10;
        settingsService.setLoginSettings(identifierType, pageTitle, logRetentionDays);
        return ResponseEntity.ok(settingsService.getLoginSettings());
    }

    @GetMapping("/login/branding")
    public ResponseEntity<IdpSettingsService.LoginBranding> getLoginBranding() {
        return ResponseEntity.ok(settingsService.getLoginBranding());
    }

    @PutMapping("/login/branding")
    public ResponseEntity<IdpSettingsService.LoginBranding> updateLoginBranding(@RequestBody IdpSettingsService.LoginBranding body) {
        return ResponseEntity.ok(settingsService.setLoginBranding(body));
    }

    @GetMapping("/security")
    public ResponseEntity<IdpSettingsService.SecuritySettings> getSecurity() {
        return ResponseEntity.ok(settingsService.getSecuritySettings());
    }

    @PutMapping("/security")
    public ResponseEntity<IdpSettingsService.SecuritySettings> updateSecurity(@RequestBody Map<String, Object> body) {
        IdpSettingsService.SecuritySettings cur = settingsService.getSecuritySettings();
        IdpSettingsService.SecuritySettings next = new IdpSettingsService.SecuritySettings(
                boolField(body, "lockoutEnabled", cur.lockoutEnabled()),
                intField(body, "lockoutMaxAttempts", cur.lockoutMaxAttempts()),
                intField(body, "lockoutWindowMinutes", cur.lockoutWindowMinutes()),
                intField(body, "lockoutDurationMinutes", cur.lockoutDurationMinutes()),
                intField(body, "sessionIdleMinutes", cur.sessionIdleMinutes()),
                intField(body, "sessionAbsoluteHours", cur.sessionAbsoluteHours()),
                boolField(body, "requirePkce", cur.requirePkce()),
                boolField(body, "refreshTokenRotation", cur.refreshTokenRotation()),
                body.get("ipAllowlist") instanceof String s ? s : cur.ipAllowlist(),
                boolField(body, "forceHttps", cur.forceHttps())
        );
        return ResponseEntity.ok(settingsService.setSecuritySettings(next));
    }

    private static boolean boolField(Map<String, Object> body, String key, boolean def) {
        Object v = body.get(key);
        if (v instanceof Boolean b) return b;
        if (v instanceof String s) return Boolean.parseBoolean(s);
        return def;
    }

    private static int intField(Map<String, Object> body, String key, int def) {
        Object v = body.get(key);
        if (v instanceof Number n) return n.intValue();
        if (v instanceof String s) try { return Integer.parseInt(s); } catch (NumberFormatException ignored) {}
        return def;
    }
}
