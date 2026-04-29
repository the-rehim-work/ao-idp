package az.ao.idp.controller;

import az.ao.idp.config.IdpProperties;
import az.ao.idp.dto.response.JwksResponse;
import az.ao.idp.dto.response.OidcDiscoveryResponse;
import az.ao.idp.service.JwtService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@Tag(name = "OIDC Discovery", description = "OpenID Connect discovery and JWKS endpoints (RFC 7517, OIDC Core §4)")
public class JwksController {

    private final JwtService jwtService;
    private final String issuer;

    public JwksController(JwtService jwtService, IdpProperties idpProperties) {
        this.jwtService = jwtService;
        this.issuer = idpProperties.issuer();
    }

    @GetMapping("/jwks")
    @Operation(summary = "JSON Web Key Set", description = "Returns the public RSA keys used to verify JWTs (RFC 7517)")
    public ResponseEntity<JwksResponse> jwks() {
        return ResponseEntity.ok(jwtService.buildJwks());
    }

    @GetMapping("/.well-known/openid-configuration")
    @Operation(summary = "OpenID Connect discovery document", description = "OIDC Provider Metadata per OpenID Connect Discovery 1.0")
    public ResponseEntity<OidcDiscoveryResponse> discovery() {
        return ResponseEntity.ok(new OidcDiscoveryResponse(
                issuer,
                issuer + "/authorize",
                issuer + "/token",
                issuer + "/userinfo",
                issuer + "/jwks",
                issuer + "/logout",
                issuer + "/token/revoke",
                List.of("code"),
                List.of("public"),
                List.of("RS256"),
                List.of("openid", "profile"),
                List.of("client_secret_post", "none"),
                List.of("authorization_code", "refresh_token"),
                List.of("S256")
        ));
    }
}
