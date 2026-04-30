package az.ao.idp.controller.admin;

import az.ao.idp.dto.request.ActivateUserRequest;
import az.ao.idp.dto.response.LdapTreeNode;
import az.ao.idp.dto.response.LdapUserResponse;
import az.ao.idp.dto.response.PageResponse;
import az.ao.idp.entity.User;
import az.ao.idp.service.LdapConfigService;
import az.ao.idp.service.LdapService;
import az.ao.idp.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin/api/v1")
@Tag(name = "Admin — Users", description = "User activation, deactivation, LDAP browser, and per-app access management")
@SecurityRequirement(name = "AdminBearerAuth")
public class AdminUserController {

    private static final Map<String, String> LDAP_NOT_CONFIGURED =
            Map.of("error", "ldap_not_configured", "message", "No active LDAP server configured. Go to Settings → LDAP to add one.");

    private final UserService userService;
    private final LdapService ldapService;
    private final LdapConfigService ldapConfigService;

    public AdminUserController(UserService userService, LdapService ldapService, LdapConfigService ldapConfigService) {
        this.userService = userService;
        this.ldapService = ldapService;
        this.ldapConfigService = ldapConfigService;
    }

    @GetMapping("/ldap/tree")
    public ResponseEntity<?> ldapTree(@RequestParam(required = false) String dn, @RequestParam(required = false) UUID configId) {
        if (!ldapConfigService.isConfigured()) return ResponseEntity.status(503).body(LDAP_NOT_CONFIGURED);
        return ResponseEntity.ok(ldapService.listLdapChildren(configId, dn, userService.getAllActivatedLdapUsernames()));
    }

    @GetMapping("/ldap/ous")
    public ResponseEntity<?> ldapOus() {
        if (!ldapConfigService.isConfigured()) return ResponseEntity.status(503).body(LDAP_NOT_CONFIGURED);
        return ResponseEntity.ok(ldapService.listOus());
    }

    @GetMapping("/ldap/users")
    public ResponseEntity<?> ldapUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String dn) {
        if (!ldapConfigService.isConfigured()) return ResponseEntity.status(503).body(LDAP_NOT_CONFIGURED);
        return ResponseEntity.ok(ldapService.listUsersFromAllActive(search).stream().map(u ->
                new LdapUserResponse(u.ldapUsername(), u.email(), u.displayName(),
                        userService.userExistsByLdapUsername(u.ldapUsername()),
                        u.title(), u.ou(), u.groups(), u.ldapServerName())
        ).toList());
    }

    @GetMapping("/users")
    public ResponseEntity<PageResponse<User>> listUsers(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Page<User> users = userService.searchUsers(search, page, size);
        return ResponseEntity.ok(new PageResponse<>(
                users.getContent(), page, size, users.getTotalElements(), users.getTotalPages(), users.isLast()
        ));
    }

    @PostMapping("/users")
    public ResponseEntity<User> activate(@Valid @RequestBody ActivateUserRequest request) {
        LdapService.LdapUserAttributes attrs = ldapService.getUserAttributesFromAny(request.ldapUsername());
        User user = userService.activateUser(attrs.username(), attrs.email(), attrs.displayName(), getAdminId());
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<User> get(@PathVariable UUID id) {
        return ResponseEntity.ok(userService.getById(id));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        userService.deactivate(id, getAdminId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/{id}/app-access")
    public ResponseEntity<List<UserService.AppAccessView>> getUserAppAccess(@PathVariable UUID id) {
        return ResponseEntity.ok(userService.getUserAppAccess(id));
    }

    @GetMapping("/apps/{appId}/users")
    public ResponseEntity<PageResponse<User>> listUsersForApp(
            @PathVariable UUID appId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Page<User> users = userService.getUsersForApp(appId, search, page, size);
        return ResponseEntity.ok(new PageResponse<>(
                users.getContent(), page, size, users.getTotalElements(), users.getTotalPages(), users.isLast()
        ));
    }

    @PostMapping("/apps/{appId}/users/{ldapUsername}/activate")
    public ResponseEntity<User> activateForApp(
            @PathVariable UUID appId,
            @PathVariable String ldapUsername
    ) {
        if (!ldapConfigService.isConfigured()) return ResponseEntity.status(503).build();
        LdapService.LdapUserAttributes attrs = ldapService.getUserAttributesFromAny(ldapUsername);
        User user = userService.userExistsByLdapUsername(ldapUsername)
                ? userService.getByLdapUsername(ldapUsername)
                : userService.activateUser(attrs.username(), attrs.email(), attrs.displayName(), getAdminId());
        userService.grantAppAccess(user.getId(), appId, getAdminId());
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    @DeleteMapping("/apps/{appId}/users/{userId}/access")
    public ResponseEntity<Void> revokeAppAccess(
            @PathVariable UUID appId,
            @PathVariable UUID userId
    ) {
        userService.revokeAppAccess(userId, appId, getAdminId());
        return ResponseEntity.noContent().build();
    }

    private String getAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "unknown";
    }
}
