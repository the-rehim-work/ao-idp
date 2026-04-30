package az.ao.idp.controller.admin;

import az.ao.idp.dto.request.LdapConfigRequest;
import az.ao.idp.entity.LdapServerConfig;
import az.ao.idp.service.LdapConfigService;
import az.ao.idp.service.LdapService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin/api/v1/settings/ldap")
@Tag(name = "Admin — LDAP Settings", description = "LDAP server configuration management")
@SecurityRequirement(name = "AdminBearerAuth")
@PreAuthorize("hasRole('IDP_ADMIN')")
public class AdminLdapConfigController {

    private static final Map<String, String> LDAP_NOT_CONFIGURED =
            Map.of("error", "ldap_not_configured", "message", "No active LDAP server configured.");

    private final LdapConfigService ldapConfigService;
    private final LdapService ldapService;

    public AdminLdapConfigController(LdapConfigService ldapConfigService, LdapService ldapService) {
        this.ldapConfigService = ldapConfigService;
        this.ldapService = ldapService;
    }

    @GetMapping
    public ResponseEntity<List<LdapServerConfig>> list() {
        return ResponseEntity.ok(ldapConfigService.list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<LdapServerConfig> get(@PathVariable UUID id) {
        return ResponseEntity.ok(ldapConfigService.get(id));
    }

    @PostMapping
    public ResponseEntity<LdapServerConfig> create(@Valid @RequestBody LdapConfigRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ldapConfigService.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<LdapServerConfig> update(@PathVariable UUID id, @Valid @RequestBody LdapConfigRequest request) {
        return ResponseEntity.ok(ldapConfigService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        ldapConfigService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/activate")
    public ResponseEntity<LdapServerConfig> activate(@PathVariable UUID id) {
        return ResponseEntity.ok(ldapConfigService.setActive(id));
    }

    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<LdapServerConfig> deactivate(@PathVariable UUID id) {
        return ResponseEntity.ok(ldapConfigService.setInactive(id));
    }

    @PostMapping("/test")
    public ResponseEntity<Map<String, Object>> testConnection(@Valid @RequestBody LdapConfigRequest request) {
        return ResponseEntity.ok(ldapConfigService.testConnection(request));
    }

    @PostMapping("/{id}/test")
    public ResponseEntity<Map<String, Object>> testExistingConnection(@PathVariable UUID id) {
        return ResponseEntity.ok(ldapConfigService.testConnectionById(id));
    }

    @GetMapping("/attributes")
    public ResponseEntity<?> availableAttributes() {
        if (!ldapConfigService.isConfigured()) return ResponseEntity.status(503).body(LDAP_NOT_CONFIGURED);
        return ResponseEntity.ok(ldapService.getAvailableAttributes());
    }

    @GetMapping("/{id}/attributes")
    public ResponseEntity<Map<String, String>> attributesById(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(ldapService.getAvailableAttributes(id));
        } catch (Exception e) {
            return ResponseEntity.status(503).build();
        }
    }

    @PostMapping("/attributes")
    public ResponseEntity<Map<String, String>> attributesFromConfig(@Valid @RequestBody LdapConfigRequest request) {
        try {
            Map<String, String> attrs = ldapService.getAvailableAttributesForRequest(
                    request.url(), request.baseDn(),
                    request.serviceAccountDn(), request.serviceAccountPassword(),
                    request.userObjectClass()
            );
            return ResponseEntity.ok(attrs);
        } catch (Exception e) {
            return ResponseEntity.status(503).build();
        }
    }
}
