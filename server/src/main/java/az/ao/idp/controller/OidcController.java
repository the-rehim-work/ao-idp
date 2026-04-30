package az.ao.idp.controller;

import az.ao.idp.config.IdpProperties;
import az.ao.idp.dto.response.TokenResponse;
import az.ao.idp.dto.response.UserInfoResponse;
import az.ao.idp.entity.Application;
import az.ao.idp.entity.User;
import az.ao.idp.exception.InvalidTokenException;
import az.ao.idp.repository.ApplicationRepository;
import az.ao.idp.service.*;
import io.jsonwebtoken.Claims;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

@Controller
@Tag(name = "OAuth2 / OIDC", description = "Authorization Code flow with PKCE (RFC 6749, RFC 7636), token endpoint, userinfo, logout, and token revocation (RFC 7009)")
public class OidcController {

    private final OidcService oidcService;
    private final SessionService sessionService;
    private final LdapService ldapService;
    private final UserService userService;
    private final BruteForceService bruteForceService;
    private final AuditService auditService;
    private final IdpProperties idpProperties;
    private final ApplicationRepository applicationRepository;

    public OidcController(
            OidcService oidcService,
            SessionService sessionService,
            LdapService ldapService,
            UserService userService,
            BruteForceService bruteForceService,
            AuditService auditService,
            IdpProperties idpProperties,
            ApplicationRepository applicationRepository
    ) {
        this.oidcService = oidcService;
        this.sessionService = sessionService;
        this.ldapService = ldapService;
        this.userService = userService;
        this.bruteForceService = bruteForceService;
        this.auditService = auditService;
        this.idpProperties = idpProperties;
        this.applicationRepository = applicationRepository;
    }

    @GetMapping("/login")
    @Operation(summary = "Login page", description = "Renders the login form (HTML)")
    public String loginPage(
            @RequestParam(value = "client_id", required = false) String clientId,
            @RequestParam(value = "redirect_uri", required = false) String redirectUri,
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "scope", required = false) String scope,
            @RequestParam(value = "code_challenge", required = false) String codeChallenge,
            @RequestParam(value = "code_challenge_method", required = false) String codeChallengeMethod,
            @RequestParam(value = "error", required = false) String error,
            HttpServletRequest request,
            Model model
    ) {
        String existingSession = getSessionCookie(request);
        if (existingSession != null && clientId == null) {
            SessionService.SessionData session = sessionService.getSession(existingSession);
            if (session != null) {
                return "redirect:/admin/";
            }
        }

        if (clientId != null) model.addAttribute("clientId", clientId);
        if (redirectUri != null) model.addAttribute("redirectUri", redirectUri);
        if (state != null) model.addAttribute("state", state);
        if (scope != null) model.addAttribute("scope", scope);
        model.addAttribute("codeChallenge", codeChallenge != null ? codeChallenge : "");
        model.addAttribute("codeChallengeMethod", codeChallengeMethod != null ? codeChallengeMethod : "");
        if (error != null) model.addAttribute("error", error);
        if (clientId != null) {
            applicationRepository.findByClientId(clientId)
                    .ifPresent(a -> model.addAttribute("appName", a.getName()));
        }
        return "login";
    }

    @GetMapping("/")
    public String root() {
        return "redirect:/admin/";
    }

    @GetMapping("/authorize")
    @Operation(summary = "Authorization endpoint", description = "Initiates Authorization Code flow. Redirects to login if no active session. Supports PKCE (code_challenge / S256).")
    public String authorize(
            @RequestParam("client_id") String clientId,
            @RequestParam("redirect_uri") String redirectUri,
            @RequestParam("response_type") String responseType,
            @RequestParam("state") String state,
            @RequestParam(value = "scope", defaultValue = "openid profile roles") String scope,
            @RequestParam(value = "code_challenge", required = false) String codeChallenge,
            @RequestParam(value = "code_challenge_method", required = false) String codeChallengeMethod,
            HttpServletRequest request,
            HttpServletResponse response,
            Model model
    ) throws IOException {
        String sessionCookie = getSessionCookie(request);
        if (!"code".equals(responseType)) {
            return "redirect:" + redirectUri + "?error=unsupported_response_type&state=" + state;
        }

        Application app = oidcService.validateClientForAuth(clientId, redirectUri);

        if (sessionCookie != null) {
            SessionService.SessionData session = sessionService.getSession(sessionCookie);
            if (session != null) {
                User user = userService.getById(session.userId());
                if (user.isActive() && userService.hasAppAccess(user.getId(), app.getId())) {
                    String code = oidcService.generateAndStoreAuthCode(session.userId(), clientId, redirectUri, scope, codeChallenge);
                    return "redirect:" + redirectUri + "?code=" + code + "&state=" + state;
                }
            }
        }

        return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod, null);
    }

    @PostMapping("/login")
    public String login(
            @RequestParam("username") String username,
            @RequestParam("password") String password,
            @RequestParam(value = "client_id", required = false) String clientId,
            @RequestParam(value = "redirect_uri", required = false) String redirectUri,
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "scope", defaultValue = "openid profile roles") String scope,
            @RequestParam(value = "code_challenge", required = false) String codeChallenge,
            @RequestParam(value = "code_challenge_method", required = false) String codeChallengeMethod,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        String ipAddress = getClientIp(request);

        try {
            bruteForceService.checkAndThrowIfLocked(username, ipAddress);

            User existingUser = userService.findByLdapUsername(username).orElse(null);
            UUID knownLdapServerId = existingUser != null ? existingUser.getLdapServerId() : null;

            LdapService.AuthResult authResult = ldapService.authenticate(username, password, knownLdapServerId);
            if (!authResult.success()) {
                bruteForceService.recordFailedAttempt(username, ipAddress);
                int remaining = bruteForceService.getRemainingAttempts(username, ipAddress);
                auditService.log("user", username, "login_failed", null, null, null, ipAddress, request.getHeader("User-Agent"),
                        Map.of("reason", "invalid_credentials", "ldap_username", username, "remaining_attempts", remaining,
                                "app_client_id", clientId != null ? clientId : "none", "app_name", "none"));
                return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod,
                        "İstifadəçi adı və ya şifrə yanlışdır");
            }

            LdapService.LdapUserAttributes attrs = ldapService.getUserAttributes(username, authResult.ldapServerId());

            if (existingUser == null) {
                return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod,
                        "Hesab aktivləşdirilməyib. Administratorla əlaqə saxlayın.");
            }

            User user = existingUser;
            userService.updateLastLogin(user.getId());
            userService.updateLdapServerId(user.getId(), authResult.ldapServerId());
            bruteForceService.recordSuccessfulAttempt(username, ipAddress);

            if (clientId != null && redirectUri != null) {
                Application loginApp = applicationRepository.findByClientId(clientId).orElse(null);
                if (loginApp != null && !userService.hasAppAccess(user.getId(), loginApp.getId())) {
                    auditService.log("user", user.getId().toString(), "login_failed", "application", clientId, loginApp, ipAddress, request.getHeader("User-Agent"),
                            Map.of("reason", "no_app_access", "ldap_username", username,
                                    "display_name", attrs.displayName() != null ? attrs.displayName() : username,
                                    "app_name", loginApp.getName(), "app_client_id", clientId));
                    return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod,
                            "Bu tətbiqə girişiniz yoxdur. Administratorla əlaqə saxlayın.");
                }
            }

            String loginAppName = clientId != null
                    ? applicationRepository.findByClientId(clientId).map(Application::getName).orElse(clientId)
                    : "direct";
            auditService.log("user", user.getId().toString(), "login", "application", clientId, null, ipAddress, request.getHeader("User-Agent"),
                    Map.of("ldap_username", username,
                            "display_name", attrs.displayName() != null ? attrs.displayName() : username,
                            "email", attrs.email() != null ? attrs.email() : "",
                            "app_name", loginAppName,
                            "scope", scope != null ? scope : "openid profile"));

            String sessionId = sessionService.createSession(user.getId(), username);
            Cookie sessionCookie = buildSessionCookie(sessionId);
            response.addCookie(sessionCookie);

            String code = oidcService.generateAndStoreAuthCode(user.getId(), clientId, redirectUri, scope, codeChallenge);
            return "redirect:" + redirectUri + "?code=" + code + "&state=" + state;

        } catch (Exception e) {
            return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod,
                    e.getMessage());
        }
    }

    private String buildLoginRedirect(String clientId, String redirectUri, String state, String scope,
                                       String codeChallenge, String codeChallengeMethod, String error) {
        StringBuilder sb = new StringBuilder("redirect:/login");
        boolean first = true;

        if (clientId != null) { sb.append("?client_id=").append(enc(clientId)); first = false; }
        if (redirectUri != null) { sb.append(first ? "?" : "&").append("redirect_uri=").append(enc(redirectUri)); first = false; }
        if (state != null) { sb.append(first ? "?" : "&").append("state=").append(enc(state)); first = false; }
        if (scope != null) { sb.append(first ? "?" : "&").append("scope=").append(enc(scope)); first = false; }
        if (codeChallenge != null && !codeChallenge.isBlank()) { sb.append(first ? "?" : "&").append("code_challenge=").append(enc(codeChallenge)); first = false; }
        if (codeChallengeMethod != null && !codeChallengeMethod.isBlank()) { sb.append(first ? "?" : "&").append("code_challenge_method=").append(enc(codeChallengeMethod)); first = false; }
        if (error != null) { sb.append(first ? "?" : "&").append("error=").append(enc(error)); }

        return sb.toString();
    }

    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    @PostMapping(value = "/token", consumes = "application/x-www-form-urlencoded")
    @ResponseBody
    @Operation(summary = "Token endpoint", description = "Exchange authorization code for tokens (grant_type=authorization_code) or refresh an access token (grant_type=refresh_token). RFC 6749 §4.1.3 and §6.")
    public ResponseEntity<TokenResponse> token(
            @RequestParam("grant_type") String grantType,
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "redirect_uri", required = false) String redirectUri,
            @RequestParam("client_id") String clientId,
            @RequestParam(value = "client_secret", required = false) String clientSecret,
            @RequestParam(value = "code_verifier", required = false) String codeVerifier,
            @RequestParam(value = "refresh_token", required = false) String refreshToken
    ) {
        return switch (grantType) {
            case "authorization_code" -> ResponseEntity.ok(
                    oidcService.exchangeAuthCode(code, clientId, redirectUri, clientSecret, codeVerifier)
            );
            case "refresh_token" -> ResponseEntity.ok(
                    oidcService.refreshAccessToken(refreshToken, clientId, clientSecret)
            );
            default -> throw new IllegalArgumentException("Unsupported grant_type: " + grantType);
        };
    }

    @GetMapping("/userinfo")
    @ResponseBody
    @Operation(summary = "UserInfo endpoint", description = "Returns identity claims for the authenticated user (OIDC Core §5.3). Requires Bearer token.")
    @SecurityRequirement(name = "BearerAuth")
    public ResponseEntity<UserInfoResponse> userinfo() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getDetails() instanceof Claims claims)) {
            throw new InvalidTokenException("No valid token");
        }

        UUID userId = UUID.fromString(claims.getSubject());
        String clientId = claims.getAudience().iterator().next();

        return ResponseEntity.ok(oidcService.getUserInfo(userId, clientId));
    }

    @PostMapping(value = "/token/revoke", consumes = "application/x-www-form-urlencoded")
    @ResponseBody
    @Operation(summary = "Token revocation (RFC 7009)", description = "Revokes a refresh_token. Returns 200 even if the token is invalid (RFC 7009 §2.2). Client must authenticate.")
    public ResponseEntity<Void> revokeToken(
            @RequestParam("token") String token,
            @RequestParam(value = "token_type_hint", required = false) String tokenTypeHint,
            @RequestParam("client_id") String clientId,
            @RequestParam(value = "client_secret", required = false) String clientSecret
    ) {
        oidcService.revokeToken(token, tokenTypeHint, clientId, clientSecret);
        return ResponseEntity.ok().build();
    }

    @PostMapping(value = "/logout", consumes = "application/x-www-form-urlencoded")
    @ResponseBody
    @Operation(summary = "Logout / end session", description = "Invalidates the SSO session and refresh token. Clears the session cookie.")
    public ResponseEntity<Void> logout(
            @RequestParam(value = "refresh_token", required = false) String refreshToken,
            @RequestParam(value = "client_id", required = false) String clientId,
            @RequestParam(value = "post_logout_redirect_uri", required = false) String redirectUri,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String sessionId = getSessionCookie(request);
        oidcService.logout(refreshToken, sessionId, clientId);

        Cookie expiredCookie = buildSessionCookie("");
        expiredCookie.setMaxAge(0);
        response.addCookie(expiredCookie);

        return ResponseEntity.noContent().build();
    }

    private Cookie buildSessionCookie(String value) {
        Cookie cookie = new Cookie(idpProperties.cookie().name(), value);
        cookie.setHttpOnly(true);
        cookie.setSecure(idpProperties.issuer().startsWith("https"));
        cookie.setPath("/");
        String domain = idpProperties.cookie().domain();
        if (domain != null && domain.startsWith(".")) {
            domain = domain.substring(1);
        }
        cookie.setDomain(domain);
        cookie.setMaxAge(idpProperties.cookie().maxAgeSeconds());
        return cookie;
    }

    private String getSessionCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        String cookieName = idpProperties.cookie().name();
        for (Cookie c : cookies) {
            if (cookieName.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
