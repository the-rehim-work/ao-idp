package az.ao.idp.service;

import az.ao.idp.dto.response.TokenResponse;
import az.ao.idp.dto.response.UserInfoResponse;
import az.ao.idp.entity.Application;
import az.ao.idp.entity.User;
import az.ao.idp.exception.InvalidClientException;
import az.ao.idp.exception.InvalidTokenException;
import az.ao.idp.exception.ResourceNotFoundException;
import az.ao.idp.repository.ApplicationRepository;
import az.ao.idp.util.SecureRandomUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class OidcService {

    private static final Logger log = LoggerFactory.getLogger(OidcService.class);

    private final ApplicationRepository applicationRepository;
    private final UserService userService;
    private final JwtService jwtService;
    private final SessionService sessionService;
    private final RefreshTokenService refreshTokenService;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandomUtil secureRandomUtil;
    private final AuditService auditService;
    private final LdapService ldapService;
    private final IdpSettingsService settingsService;

    public OidcService(
            ApplicationRepository applicationRepository,
            UserService userService,
            JwtService jwtService,
            SessionService sessionService,
            RefreshTokenService refreshTokenService,
            PasswordEncoder passwordEncoder,
            SecureRandomUtil secureRandomUtil,
            AuditService auditService,
            LdapService ldapService,
            IdpSettingsService settingsService
    ) {
        this.applicationRepository = applicationRepository;
        this.userService = userService;
        this.jwtService = jwtService;
        this.sessionService = sessionService;
        this.refreshTokenService = refreshTokenService;
        this.passwordEncoder = passwordEncoder;
        this.secureRandomUtil = secureRandomUtil;
        this.auditService = auditService;
        this.ldapService = ldapService;
        this.settingsService = settingsService;
    }

    public Application validateClient(String clientId, String clientSecret) {
        Application app = applicationRepository.findByClientId(clientId)
                .orElseThrow(() -> new InvalidClientException("Unknown client_id"));
        if (!app.isActive()) {
            throw new InvalidClientException("Application is disabled");
        }
        if (app.isPublicClient()) {
            throw new InvalidClientException("Public clients do not authenticate with client_secret");
        }
        if (!passwordEncoder.matches(clientSecret, app.getClientSecretHash())) {
            throw new InvalidClientException("Invalid client_secret");
        }
        return app;
    }

    public Application validatePublicClient(String clientId) {
        Application app = applicationRepository.findByClientId(clientId)
                .orElseThrow(() -> new InvalidClientException("Unknown client_id"));
        if (!app.isActive()) throw new InvalidClientException("Application is disabled");
        if (!app.isPublicClient()) throw new InvalidClientException("client_secret is required for confidential clients");
        return app;
    }

    public Application validateClientForAuth(String clientId, String redirectUri) {
        Application app = applicationRepository.findByClientId(clientId)
                .orElseThrow(() -> new InvalidClientException("Unknown client_id"));
        if (!app.isActive()) {
            throw new InvalidClientException("Application is disabled");
        }
        if (!Arrays.asList(app.getRedirectUris()).contains(redirectUri)) {
            throw new InvalidClientException("Invalid redirect_uri");
        }
        return app;
    }

    public String generateAndStoreAuthCode(UUID userId, String clientId, String redirectUri, String scope, String codeChallenge, String nonce) {
        String code = secureRandomUtil.generateAuthCode();
        sessionService.storeAuthCode(
                code,
                new SessionService.AuthCodeData(userId, clientId, redirectUri, scope, codeChallenge, nonce),
                codeChallenge,
                Duration.ofSeconds(60)
        );
        return code;
    }

    public TokenResponse exchangeAuthCode(String code, String clientId, String redirectUri, String clientSecret, String codeVerifier) {
        Application clientApp = applicationRepository.findByClientId(clientId)
                .orElseThrow(() -> new InvalidClientException("Unknown client: " + clientId));
        if (!clientApp.isActive()) {
            throw new InvalidClientException("Client is inactive");
        }
        SessionService.AuthCodeData codeData = sessionService.consumeAuthCode(code);
        if (codeData == null) {
            throw new InvalidTokenException("Invalid or expired authorization code");
        }
        if (!codeData.clientId().equals(clientId) || !codeData.redirectUri().equals(redirectUri)) {
            throw new InvalidTokenException("Authorization code mismatch");
        }

        String storedChallenge = codeData.codeChallenge();
        if (storedChallenge != null && !storedChallenge.isBlank()) {
            if (codeVerifier == null || codeVerifier.isBlank()) {
                throw new InvalidTokenException("code_verifier required for PKCE");
            }
            if (!computeS256Challenge(codeVerifier).equals(storedChallenge)) {
                throw new InvalidTokenException("PKCE verification failed");
            }
        } else {
            if (clientSecret == null || clientSecret.isBlank()) {
                throw new InvalidClientException("client_secret is required");
            }
            validateClient(clientId, clientSecret);
        }

        Application app = applicationRepository.findByClientId(clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found"));
        User user = userService.getById(codeData.userId());

        if (!userService.hasAppAccess(user.getId(), app.getId())) {
            throw new InvalidClientException("User is not authorized for this application");
        }

        log.info("Token issued: username={} app={} scope={}", user.getLdapUsername(), app.getName(),
                codeData.scope() != null ? codeData.scope() : "openid profile");
        auditService.log("user", user.getId().toString(), "token_exchange", "application", app.getId().toString(), app, null, null,
                Map.of("ldap_username", user.getLdapUsername(), "display_name", user.getDisplayName() != null ? user.getDisplayName() : "",
                        "app_name", app.getName(), "client_id", app.getClientId(), "scope", codeData.scope() != null ? codeData.scope() : "openid profile"));

        return buildTokenResponse(user, app, codeData.scope(), codeData.nonce());
    }

    public TokenResponse refreshAccessToken(String refreshToken, String clientId, String clientSecret) {
        Application resolvedApp = (clientSecret != null && !clientSecret.isBlank())
                ? validateClient(clientId, clientSecret)
                : validatePublicClient(clientId);

        RefreshTokenService.RefreshTokenData tokenData = refreshTokenService.validate(refreshToken);
        if (tokenData == null) {
            throw new InvalidTokenException("Invalid or expired refresh token");
        }
        if (!tokenData.clientId().equals(clientId)) {
            throw new InvalidClientException("Refresh token was not issued to this client");
        }

        refreshTokenService.consume(tokenData.tokenHash());

        User user = userService.getById(tokenData.userId());

        if (!userService.hasAppAccess(user.getId(), resolvedApp.getId())) {
            throw new InvalidTokenException("User is no longer authorized for this application");
        }

        log.info("Token refreshed: username={} app={}", user.getLdapUsername(), resolvedApp.getName());
        auditService.log("user", user.getId().toString(), "token_refresh", "application", resolvedApp.getId().toString(), resolvedApp, null, null,
                Map.of("ldap_username", user.getLdapUsername(), "display_name", user.getDisplayName(),
                        "app_name", resolvedApp.getName(), "client_id", resolvedApp.getClientId()));

        String originalScope = tokenData.scope() != null ? tokenData.scope() : "openid profile";
        return buildTokenResponse(user, resolvedApp, originalScope, null);
    }

    public void revokeToken(String token, String tokenTypeHint, String clientId, String clientSecret) {
        if (clientSecret != null && !clientSecret.isBlank()) {
            validateClient(clientId, clientSecret);
        } else {
            validatePublicClient(clientId);
        }
        if (!"access_token".equals(tokenTypeHint)) {
            try {
                refreshTokenService.revoke(token);
            } catch (Exception ignored) {}
        }
    }

    public void logout(String refreshToken, String sessionId, String clientId) {
        String userId = null;
        if (sessionId != null && !sessionId.isBlank()) {
            SessionService.SessionData session = sessionService.getSession(sessionId);
            if (session != null) userId = session.userId().toString();
            sessionService.invalidateSession(sessionId);
        }
        if (refreshToken != null && !refreshToken.isBlank()) {
            refreshTokenService.revoke(refreshToken);
        }
        log.info("User logout: userId={} app={}", userId != null ? userId : "unknown", clientId != null ? clientId : "direct");
        auditService.log("user", userId != null ? userId : "unknown", "logout", "application", clientId, null, null, null,
                clientId != null ? Map.of("client_id", clientId) : null);
    }

    public UserInfoResponse getUserInfo(UUID userId, String clientId) {
        User user = userService.getById(userId);
        return new UserInfoResponse(userId.toString(), user.getLdapUsername(), user.getEmail(), user.getDisplayName());
    }

    private TokenResponse buildTokenResponse(User user, Application app, String scope, String nonce) {
        Map<String, Object> claims = buildClaims(user);
        String grantedScope = (scope != null && !scope.isBlank()) ? scope : "openid profile";
        String accessToken = jwtService.issueAccessToken(user.getId(), app.getClientId(), claims);
        String newRefreshToken = refreshTokenService.issue(user.getId(), app.getClientId(), grantedScope);
        long expirySeconds = settingsService.getAccessTokenExpiryMinutes() * 60;
        String idToken = containsScope(grantedScope, "openid")
                ? jwtService.issueIdToken(user.getId(), app.getClientId(), claims, nonce)
                : null;
        return new TokenResponse(accessToken, "Bearer", (int) expirySeconds, newRefreshToken, grantedScope, idToken);
    }

    private static boolean containsScope(String scope, String target) {
        if (scope == null) return false;
        for (String s : scope.split("\\s+")) if (s.equalsIgnoreCase(target)) return true;
        return false;
    }

    public Map<String, Object> introspect(String token, String tokenTypeHint) {
        if (!"refresh_token".equals(tokenTypeHint)) {
            try {
                io.jsonwebtoken.Claims claims = jwtService.validateUserToken(token);
                java.util.Set<String> aud = claims.getAudience();
                if (aud != null && !aud.isEmpty()
                        && claims.getExpiration() != null && claims.getIssuedAt() != null) {
                    String audValue = aud.iterator().next();
                    return Map.of(
                            "active", true, "sub", claims.getSubject(), "iss", claims.getIssuer(),
                            "aud", audValue, "client_id", audValue, "token_type", "Bearer",
                            "exp", claims.getExpiration().toInstant().getEpochSecond(),
                            "iat", claims.getIssuedAt().toInstant().getEpochSecond()
                    );
                }
            } catch (Exception ignored) { /* fall through to refresh token check */ }
        }
        RefreshTokenService.RefreshTokenData rt = refreshTokenService.peek(token);
        if (rt != null) {
            return Map.of("active", true, "sub", rt.userId().toString(), "client_id", rt.clientId(),
                    "token_type", "refresh_token", "iss", jwtService.getIssuer());
        }
        return Map.of("active", false);
    }

    private Map<String, Object> buildClaims(User user) {
        // Use the LDAP server the user last authenticated against (stored on User entity)
        UUID ldapServerId = user.getLdapServerId();

        List<IdpSettingsService.ClaimMapping> mappings = settingsService.getClaimMappings(ldapServerId);

        // Always include base identity claims regardless of mapping config
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ldap_username", user.getLdapUsername());
        if (user.getEmail() != null && !user.getEmail().isBlank()) result.put("email", user.getEmail());
        if (user.getDisplayName() != null && !user.getDisplayName().isBlank()) result.put("display_name", user.getDisplayName());

        if (mappings.isEmpty()) {
            return result;
        }

        // Collect LDAP attribute names that need to be fetched from the directory
        Set<String> storedClaims = Set.of("ldap_username", "email", "display_name");
        List<String> extraAttrs = mappings.stream()
                .filter(m -> m.enabled() && !storedClaims.contains(m.claim()))
                .map(IdpSettingsService.ClaimMapping::ldapAttr)
                .filter(attr -> attr != null && !attr.isBlank())
                .distinct()
                .collect(Collectors.toList());

        // Fetch extra attributes from the correct LDAP server
        Map<String, String> ldapValues = extraAttrs.isEmpty()
                ? Map.of()
                : ldapService.getClaimAttributes(user.getLdapUsername(), extraAttrs, ldapServerId);

        // Apply all enabled mappings (stored claims override base values; extra come from LDAP)
        for (IdpSettingsService.ClaimMapping m : mappings) {
            if (!m.enabled()) continue;
            switch (m.claim()) {
                case "ldap_username" -> result.put("ldap_username", user.getLdapUsername());
                case "email"        -> { if (user.getEmail() != null) result.put("email", user.getEmail()); }
                case "display_name" -> { if (user.getDisplayName() != null) result.put("display_name", user.getDisplayName()); }
                default -> {
                    String val = ldapValues.get(m.ldapAttr());
                    if (val != null && !val.isBlank()) result.put(m.claim(), val);
                }
            }
        }
        return result;
    }

    public io.jsonwebtoken.Claims parseIdTokenHint(String token) {
        try {
            return jwtService.validateUserToken(token);
        } catch (Exception e) {
            return null;
        }
    }

    private String computeS256Challenge(String codeVerifier) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(codeVerifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
