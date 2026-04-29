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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@Service
public class OidcService {

    private final ApplicationRepository applicationRepository;
    private final UserService userService;
    private final JwtService jwtService;
    private final SessionService sessionService;
    private final RefreshTokenService refreshTokenService;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandomUtil secureRandomUtil;
    private final AuditService auditService;

    public OidcService(
            ApplicationRepository applicationRepository,
            UserService userService,
            JwtService jwtService,
            SessionService sessionService,
            RefreshTokenService refreshTokenService,
            PasswordEncoder passwordEncoder,
            SecureRandomUtil secureRandomUtil,
            AuditService auditService
    ) {
        this.applicationRepository = applicationRepository;
        this.userService = userService;
        this.jwtService = jwtService;
        this.sessionService = sessionService;
        this.refreshTokenService = refreshTokenService;
        this.passwordEncoder = passwordEncoder;
        this.secureRandomUtil = secureRandomUtil;
        this.auditService = auditService;
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

    public String generateAndStoreAuthCode(UUID userId, String clientId, String redirectUri, String scope, String codeChallenge) {
        String code = secureRandomUtil.generateAuthCode();
        sessionService.storeAuthCode(
                code,
                new SessionService.AuthCodeData(userId, clientId, redirectUri, scope, codeChallenge),
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

        return buildTokenResponse(user, app);
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

        auditService.log("user", user.getId().toString(), "token_refresh", "application", resolvedApp.getId().toString(), resolvedApp, null, null,
                Map.of("ldap_username", user.getLdapUsername(), "display_name", user.getDisplayName(),
                        "app_name", resolvedApp.getName(), "client_id", resolvedApp.getClientId()));

        return buildTokenResponse(user, resolvedApp);
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
        auditService.log("user", userId != null ? userId : "unknown", "logout", "application", clientId, null, null, null,
                clientId != null ? Map.of("client_id", clientId) : null);
    }

    public UserInfoResponse getUserInfo(UUID userId, String clientId) {
        User user = userService.getById(userId);
        return new UserInfoResponse(userId.toString(), user.getLdapUsername(), user.getEmail(), user.getDisplayName());
    }

    private TokenResponse buildTokenResponse(User user, Application app) {
        String accessToken = jwtService.issueAccessToken(
                user.getId(), app.getClientId(),
                user.getLdapUsername(), user.getEmail(), user.getDisplayName()
        );
        String newRefreshToken = refreshTokenService.issue(user.getId(), app.getClientId());
        return new TokenResponse(accessToken, "Bearer", 900, newRefreshToken, "openid profile");
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
