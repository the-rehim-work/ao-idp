package az.ao.idp.controller;

import az.ao.idp.dto.response.PageResponse;
import az.ao.idp.dto.response.UserDirectoryResponse;
import az.ao.idp.entity.Application;
import az.ao.idp.entity.User;
import az.ao.idp.exception.InvalidClientException;
import az.ao.idp.service.OidcService;
import az.ao.idp.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@RestController
@RequestMapping("/api/v1/apps")
@Tag(name = "Directory API", description = "App-facing user directory. Authenticate with HTTP Basic using client_id:client_secret.")
@SecurityRequirement(name = "BasicAuth")
public class UserDirectoryController {

    private final UserService userService;
    private final OidcService oidcService;

    public UserDirectoryController(UserService userService, OidcService oidcService) {
        this.userService = userService;
        this.oidcService = oidcService;
    }

    @GetMapping("/{clientId}/users")
    @Operation(summary = "List users with access", description = "Returns paginated users who have been granted access to this application")
    public ResponseEntity<PageResponse<UserDirectoryResponse>> listGrantedUsers(
            @PathVariable String clientId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Application app = authenticateClient(authHeader, clientId);
        Page<User> users = userService.getUsersForApp(app.getId(), search, page, size);
        Page<UserDirectoryResponse> mapped = users.map(u ->
                new UserDirectoryResponse(u.getId(), u.getLdapUsername(), u.getEmail(), u.getDisplayName())
        );
        return ResponseEntity.ok(new PageResponse<>(
                mapped.getContent(), page, size,
                mapped.getTotalElements(), mapped.getTotalPages(), mapped.isLast()
        ));
    }

    private Application authenticateClient(String authHeader, String clientId) {
        if (authHeader == null || !authHeader.startsWith("Basic ")) {
            throw new InvalidClientException("Authorization header with Basic credentials is required");
        }
        String decoded;
        try {
            decoded = new String(Base64.getDecoder().decode(authHeader.substring(6)), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new InvalidClientException("Invalid Base64 in Authorization header");
        }
        int colon = decoded.indexOf(':');
        if (colon < 0) throw new InvalidClientException("Invalid Basic auth format");
        String id = decoded.substring(0, colon);
        String secret = decoded.substring(colon + 1);
        if (!id.equals(clientId)) throw new InvalidClientException("client_id mismatch");
        return oidcService.validateClient(id, secret);
    }
}
