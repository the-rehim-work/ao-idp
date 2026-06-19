package az.ao.idp.controller;

import az.ao.idp.config.IdpProperties;
import az.ao.idp.dto.response.TokenResponse;
import az.ao.idp.dto.response.UserInfoResponse;
import az.ao.idp.entity.AppAccessMode;
import az.ao.idp.entity.AppAccessRule;
import az.ao.idp.entity.Application;
import az.ao.idp.entity.User;
import az.ao.idp.exception.InvalidTokenException;
import az.ao.idp.repository.AppAccessRuleRepository;
import az.ao.idp.repository.ApplicationRepository;
import az.ao.idp.service.*;
import az.ao.idp.service.IdpSettingsService;
import az.ao.idp.service.LdapConfigService;
import io.jsonwebtoken.Claims;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Controller
@Tag(name = "OAuth2 / OIDC", description = "Authorization Code flow with PKCE (RFC 6749, RFC 7636), token endpoint, userinfo, logout, and token revocation (RFC 7009)")
public class OidcController {

    private static final Logger log = LoggerFactory.getLogger(OidcController.class);

    private final OidcService oidcService;
    private final SessionService sessionService;
    private final LdapService ldapService;
    private final UserService userService;
    private final BruteForceService bruteForceService;
    private final AuditService auditService;
    private final IdpProperties idpProperties;
    private final ApplicationRepository applicationRepository;
    private final IdpSettingsService idpSettingsService;
    private final LdapConfigService ldapConfigService;
    private final RememberTokenService rememberTokenService;
    private final AppAccessRuleRepository appAccessRuleRepository;

    public OidcController(
            OidcService oidcService,
            SessionService sessionService,
            LdapService ldapService,
            UserService userService,
            BruteForceService bruteForceService,
            AuditService auditService,
            IdpProperties idpProperties,
            ApplicationRepository applicationRepository,
            IdpSettingsService idpSettingsService,
            LdapConfigService ldapConfigService,
            RememberTokenService rememberTokenService,
            AppAccessRuleRepository appAccessRuleRepository
    ) {
        this.oidcService = oidcService;
        this.sessionService = sessionService;
        this.ldapService = ldapService;
        this.userService = userService;
        this.bruteForceService = bruteForceService;
        this.auditService = auditService;
        this.idpProperties = idpProperties;
        this.applicationRepository = applicationRepository;
        this.idpSettingsService = idpSettingsService;
        this.ldapConfigService = ldapConfigService;
        this.rememberTokenService = rememberTokenService;
        this.appAccessRuleRepository = appAccessRuleRepository;
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
            @RequestParam(value = "nonce", required = false) String nonce,
            @RequestParam(value = "error", required = false) String error,
            @RequestParam(value = "logged_out", required = false) String loggedOut,
            @RequestParam(value = "prompt", required = false) String prompt,
            HttpServletRequest request,
            Model model
    ) {
        // Skip the session-to-admin redirect when:
        //   • logged_out=1  → user just completed an explicit IDP logout
        //   • prompt=login  → OAuth2 client requested forced re-authentication
        //   • clientId present → OAuth2 flow; authorize() already handled the session check
        String existingSession = getSessionCookie(request);
        if (existingSession != null && clientId == null && loggedOut == null && !"login".equals(prompt)) {
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
        model.addAttribute("nonce", nonce != null ? nonce : "");
        if (error != null) model.addAttribute("error", error);
        if (clientId != null) {
            applicationRepository.findByClientId(clientId)
                    .ifPresent(a -> model.addAttribute("appName", a.getName()));
        }
        String continueAsJson = getUserProfileCookie(request);
        if (continueAsJson != null) {
            try {
                String decoded = new String(Base64.getUrlDecoder().decode(continueAsJson), StandardCharsets.UTF_8);
                model.addAttribute("continueAsJson", decoded);
            } catch (Exception ignored) {}
        }
        boolean ldapActive = ldapConfigService.getActive().isPresent();
        IdpSettingsService.LoginSettings loginSettings = idpSettingsService.getLoginSettings();
        String identifierType = ldapActive ? loginSettings.identifierType() : "username";
        model.addAttribute("identifierType", identifierType);
        model.addAttribute("ldapActive", ldapActive);

        // Login page branding
        IdpSettingsService.LoginBranding branding = idpSettingsService.getLoginBranding();
        model.addAttribute("brandingPrimaryColor", nvl(branding.primaryColor(), "#5eead4"));
        model.addAttribute("brandingBgColor", nvl(branding.bgColor(), "#0a0c10"));
        model.addAttribute("brandingTextColor", nvl(branding.textColor(), "#e7ebf0"));
        model.addAttribute("brandingLogoUrl", nvl(branding.logoUrl(), ""));
        model.addAttribute("brandingWelcomeText", nvl(branding.welcomeText(), ""));
        model.addAttribute("brandingFooterText", nvl(branding.footerText(), ""));
        model.addAttribute("brandingCustomCss", nvl(branding.customCss(), ""));
        model.addAttribute("continueAsEnabled", branding.continueAsEnabled());
        model.addAttribute("brandingFontFamily", nvl(branding.fontFamily(), ""));
        model.addAttribute("promptLogin", "login".equals(prompt));
        model.addAttribute("promptValue", prompt != null ? prompt : "");
        String cookieDomain = idpProperties.cookie().domain();
        if (cookieDomain != null && cookieDomain.startsWith(".")) cookieDomain = cookieDomain.substring(1);
        model.addAttribute("cookieDomain", cookieDomain != null ? cookieDomain : "");
        return "login";
    }

    @GetMapping("/")
    public String root() {
        return "redirect:/admin/";
    }

    @GetMapping("/oauth2/authorize")
    @Operation(summary = "Authorization endpoint", description = "Initiates Authorization Code flow. Redirects to login if no active session. Supports PKCE (code_challenge / S256) and prompt=login (OIDC §3.1.2.1).")
    public String authorize(
            @RequestParam("client_id") String clientId,
            @RequestParam("redirect_uri") String redirectUri,
            @RequestParam("response_type") String responseType,
            @RequestParam("state") String state,
            @RequestParam(value = "scope", defaultValue = "openid profile roles") String scope,
            @RequestParam(value = "code_challenge", required = false) String codeChallenge,
            @RequestParam(value = "code_challenge_method", required = false) String codeChallengeMethod,
            @RequestParam(value = "nonce", required = false) String nonce,
            @RequestParam(value = "prompt", required = false) String prompt,
            HttpServletRequest request,
            HttpServletResponse response,
            Model model
    ) throws IOException {
        String sessionCookie = getSessionCookie(request);
        if (!"code".equals(responseType)) {
            return "redirect:" + redirectUri + "?error=unsupported_response_type&state=" + state;
        }

        Application app = oidcService.validateClientForAuth(clientId, redirectUri);

        // Determine effective prompt: app-level force_reauth overrides a missing prompt=login.
        String effectivePrompt = (app.isForceReauth() && !"login".equals(prompt)) ? "login" : prompt;

        // prompt=login (or force_reauth) forces re-authentication (OIDC Core §3.1.2.1) — skip auto-auth.
        if (sessionCookie != null && !"login".equals(effectivePrompt)) {
            SessionService.SessionData session = sessionService.getSession(sessionCookie);
            if (session != null) {
                User user = userService.getById(session.userId());
                if (user.isActive() && userService.hasAppAccess(user.getId(), app.getId())) {
                    String code = oidcService.generateAndStoreAuthCode(session.userId(), clientId, redirectUri, scope, codeChallenge, nonce);
                    return "redirect:" + redirectUri + "?code=" + code + "&state=" + state;
                }
            }
        }

        return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod, null, nonce, effectivePrompt);
    }

    @PostMapping("/login")
    public String login(
            @RequestParam("username") String identifier,
            @RequestParam("password") String password,
            @RequestParam(value = "identifier_mode", defaultValue = "username") String identifierMode,
            @RequestParam(value = "client_id", required = false) String clientId,
            @RequestParam(value = "redirect_uri", required = false) String redirectUri,
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "scope", defaultValue = "openid profile roles") String scope,
            @RequestParam(value = "code_challenge", required = false) String codeChallenge,
            @RequestParam(value = "code_challenge_method", required = false) String codeChallengeMethod,
            @RequestParam(value = "nonce", required = false) String nonce,
            @RequestParam(value = "prompt", required = false) String prompt,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        String ipAddress = getClientIp(request);

        try {
            bruteForceService.checkAndThrowIfLocked(identifier, ipAddress);

            boolean byEmail = "email".equals(identifierMode)
                    || ("any".equals(identifierMode) && identifier.contains("@"));

            User existingUser;
            String username;
            if (byEmail) {
                existingUser = userService.findByEmail(identifier).orElse(null);
                username = existingUser != null ? existingUser.getLdapUsername() : identifier;
            } else {
                existingUser = userService.findByLdapUsername(identifier).orElse(null);
                username = identifier;
            }
            UUID knownLdapServerId = existingUser != null ? existingUser.getLdapServerId() : null;

            LdapService.AuthResult authResult = ldapService.authenticate(username, password, knownLdapServerId);
            if (!authResult.success()) {
                bruteForceService.recordFailedAttempt(identifier, ipAddress);
                int remaining = bruteForceService.getRemainingAttempts(identifier, ipAddress);
                log.info("Login failed: username={} ip={} app={} remainingAttempts={}", username, ipAddress,
                        clientId != null ? clientId : "direct", remaining);
                auditService.log("user", username, "login_failed", null, null, null, ipAddress, request.getHeader("User-Agent"),
                        Map.of("reason", "invalid_credentials", "ldap_username", username, "remaining_attempts", remaining,
                                "app_client_id", clientId != null ? clientId : "none", "app_name", "none"));
                return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod,
                        "İstifadəçi adı və ya şifrə yanlışdır", nonce, prompt);
            }

            LdapService.LdapUserAttributes attrs = ldapService.getUserAttributes(username, authResult.ldapServerId());

            // Fetch the app once; reused for auto-enroll check, access check, and audit logging
            Application loginApp = clientId != null ? applicationRepository.findByClientId(clientId).orElse(null) : null;
            boolean accessAlreadyVerified = false;

            if (existingUser == null) {
                if (loginApp == null || !qualifiesForAutoEnroll(username, authResult.ldapServerId(), loginApp)) {
                    log.info("Login blocked: username={} ip={} reason=not_activated", username, ipAddress);
                    return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod,
                            "Hesab aktivləşdirilməyib. Administratorla əlaqə saxlayın.", nonce, prompt);
                }
                existingUser = userService.activateFromLdap(username, attrs, authResult.ldapServerId());
                accessAlreadyVerified = true; // qualifiesForAutoEnroll already confirmed access
            }

            User user = existingUser;
            userService.updateLastLogin(user.getId());
            userService.updateLdapServerId(user.getId(), authResult.ldapServerId());
            bruteForceService.recordSuccessfulAttempt(identifier, ipAddress);

            if (!accessAlreadyVerified && clientId != null && redirectUri != null && loginApp != null) {
                if (!userService.hasAppAccess(user.getId(), loginApp.getId())) {
                    log.info("Login blocked: username={} ip={} app={} reason=no_app_access", username, ipAddress, loginApp.getName());
                    auditService.log("user", user.getId().toString(), "login_failed", "application", clientId, loginApp, ipAddress, request.getHeader("User-Agent"),
                            Map.of("reason", "no_app_access", "ldap_username", username,
                                    "display_name", attrs.displayName() != null ? attrs.displayName() : username,
                                    "app_name", loginApp.getName(), "app_client_id", clientId));
                    return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod,
                            "Bu tətbiqə girişiniz yoxdur. Administratorla əlaqə saxlayın.", nonce, prompt);
                }
            }

            String loginAppName = loginApp != null ? loginApp.getName() : clientId != null ? clientId : "direct";
            log.info("Login success: username={} display='{}' ip={} app={}", username,
                    attrs.displayName() != null ? attrs.displayName() : username, ipAddress, loginAppName);
            auditService.log("user", user.getId().toString(), "login", "application", clientId, null, ipAddress, request.getHeader("User-Agent"),
                    Map.of("ldap_username", username,
                            "display_name", attrs.displayName() != null ? attrs.displayName() : username,
                            "email", attrs.email() != null ? attrs.email() : "",
                            "app_name", loginAppName,
                            "scope", scope != null ? scope : "openid profile"));

            String sessionId = sessionService.createSession(user.getId(), username);
            Cookie sessionCookie = buildSessionCookie(sessionId);
            response.addCookie(sessionCookie);

            String displayName = attrs.displayName() != null ? attrs.displayName() : username;

            // Issue remember token — stored in ao-user cookie for passwordless "continue as"
            String rememberToken = rememberTokenService.issue(user.getId(), username);

            // Build multi-account profile cookie (JSON array, up to 5 accounts)
            List<String[]> profileList = parseProfileList(getUserProfileCookie(request));
            profileList.removeIf(p -> username.equals(p[0]));
            profileList.add(0, new String[]{username, displayName, rememberToken});
            if (profileList.size() > 5) profileList = profileList.subList(0, 5);
            response.addCookie(buildProfileCookie(profileList));

            if (clientId == null || clientId.isBlank() || redirectUri == null || redirectUri.isBlank()) {
                return "redirect:/admin/";
            }

            String code = oidcService.generateAndStoreAuthCode(user.getId(), clientId, redirectUri, scope, codeChallenge, nonce);
            return "redirect:" + redirectUri + "?code=" + code + "&state=" + state;

        } catch (az.ao.idp.exception.InvalidClientException | az.ao.idp.exception.InvalidTokenException e) {
            return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod,
                    e.getMessage(), nonce, prompt);
        } catch (Exception e) {
            log.error("Login internal error: username={} ip={} error={}", identifier, ipAddress, e.getMessage(), e);
            return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod,
                    "Daxil olma zamanı xəta baş verdi. Yenidən cəhd edin.", nonce, prompt);
        }
    }

    /**
     * Passwordless "continue as" — validates a stored remember token and creates a new session
     * without requiring a password. The remember token is rotated on each use (like a refresh token).
     * Called by the login page when the user clicks a stored account that has a valid remember token.
     */
    @PostMapping("/oauth2/continue-as")
    public String continueAs(
            @RequestParam("remember_token") String rememberToken,
            @RequestParam(value = "client_id", required = false) String clientId,
            @RequestParam(value = "redirect_uri", required = false) String redirectUri,
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "scope", defaultValue = "openid profile roles") String scope,
            @RequestParam(value = "code_challenge", required = false) String codeChallenge,
            @RequestParam(value = "code_challenge_method", required = false) String codeChallengeMethod,
            @RequestParam(value = "nonce", required = false) String nonce,
            @RequestParam(value = "prompt", required = false) String prompt,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        String ipAddress = getClientIp(request);

        RememberTokenService.TokenData tokenData = rememberTokenService.validate(rememberToken);
        if (tokenData == null) {
            log.info("Continue-as failed: invalid or expired remember token ip={}", ipAddress);
            return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod,
                    "Sessiya müddəti bitib. Yenidən daxil olun.", nonce, prompt);
        }

        UUID userId = tokenData.userId();
        String username = tokenData.ldapUsername();

        User user = userService.getById(userId);
        if (!user.isActive()) {
            log.info("Continue-as blocked: username={} reason=inactive", username);
            return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod,
                    "Hesab aktiv deyil. Administratorla əlaqə saxlayın.", nonce, prompt);
        }

        if (clientId != null && redirectUri != null) {
            Application loginApp = applicationRepository.findByClientId(clientId).orElse(null);
            if (loginApp != null && !userService.hasAppAccess(user.getId(), loginApp.getId())) {
                log.info("Continue-as blocked: username={} app={} reason=no_app_access", username, clientId);
                return buildLoginRedirect(clientId, redirectUri, state, scope, codeChallenge, codeChallengeMethod,
                        "Bu tətbiqə girişiniz yoxdur. Administratorla əlaqə saxlayın.", nonce, prompt);
            }
        }

        // Rotate: invalidate used token, issue a new one
        rememberTokenService.invalidateByHash(tokenData.tokenHash());
        String newToken = rememberTokenService.issue(userId, username);

        // Update ao-user cookie with the new remember token
        List<String[]> profileList = parseProfileList(getUserProfileCookie(request));
        profileList.removeIf(p -> username.equals(p[0]));
        String displayName = user.getDisplayName() != null ? user.getDisplayName() : username;
        profileList.add(0, new String[]{username, displayName, newToken});
        if (profileList.size() > 5) profileList = profileList.subList(0, 5);
        response.addCookie(buildProfileCookie(profileList));

        // Create SSO session
        String sessionId = sessionService.createSession(userId, username);
        response.addCookie(buildSessionCookie(sessionId));
        userService.updateLastLogin(userId);

        String loginAppName = clientId != null
                ? applicationRepository.findByClientId(clientId).map(Application::getName).orElse(clientId)
                : "direct";
        log.info("Continue-as success: username={} ip={} app={}", username, ipAddress, loginAppName);
        auditService.log("user", userId.toString(), "login", "application", clientId, null, ipAddress,
                request.getHeader("User-Agent"),
                Map.of("ldap_username", username, "display_name", displayName,
                        "method", "remember_token", "app_name", loginAppName,
                        "scope", scope != null ? scope : "openid profile"));

        if (clientId == null || clientId.isBlank() || redirectUri == null || redirectUri.isBlank()) {
            return "redirect:/admin/";
        }

        String code = oidcService.generateAndStoreAuthCode(userId, clientId, redirectUri, scope, codeChallenge, nonce);
        return "redirect:" + redirectUri + "?code=" + code + "&state=" + state;
    }

    /**
     * Removes a stored account's remember token server-side and authoritatively rewrites
     * the ao-user cookie without the removed account. Called by the login page "x" button.
     * Always returns 204 to avoid leaking info about token existence.
     */
    @PostMapping(value = "/oauth2/forget-account", consumes = "application/x-www-form-urlencoded")
    @ResponseBody
    public ResponseEntity<Void> forgetAccount(
            @RequestParam(value = "remember_token", required = false) String rememberToken,
            @RequestParam(value = "username", required = false) String username,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        if (rememberToken != null && !rememberToken.isBlank()) {
            rememberTokenService.revoke(rememberToken);
        }
        if (username != null && !username.isBlank()) {
            List<String[]> profileList = parseProfileList(getUserProfileCookie(request));
            profileList.removeIf(p -> username.equals(p[0]));
            response.addCookie(buildProfileCookie(profileList));
        }
        return ResponseEntity.noContent().build();
    }

    private String buildLoginRedirect(String clientId, String redirectUri, String state, String scope,
                                       String codeChallenge, String codeChallengeMethod, String error, String nonce,
                                       String prompt) {
        StringBuilder sb = new StringBuilder("redirect:/login");
        boolean first = true;

        if (clientId != null) { sb.append("?client_id=").append(enc(clientId)); first = false; }
        if (redirectUri != null) { sb.append(first ? "?" : "&").append("redirect_uri=").append(enc(redirectUri)); first = false; }
        if (state != null) { sb.append(first ? "?" : "&").append("state=").append(enc(state)); first = false; }
        if (scope != null) { sb.append(first ? "?" : "&").append("scope=").append(enc(scope)); first = false; }
        if (codeChallenge != null && !codeChallenge.isBlank()) { sb.append(first ? "?" : "&").append("code_challenge=").append(enc(codeChallenge)); first = false; }
        if (codeChallengeMethod != null && !codeChallengeMethod.isBlank()) { sb.append(first ? "?" : "&").append("code_challenge_method=").append(enc(codeChallengeMethod)); first = false; }
        if (nonce != null && !nonce.isBlank()) { sb.append(first ? "?" : "&").append("nonce=").append(enc(nonce)); first = false; }
        if (prompt != null && !prompt.isBlank()) { sb.append(first ? "?" : "&").append("prompt=").append(enc(prompt)); first = false; }
        if (error != null) { sb.append(first ? "?" : "&").append("error=").append(enc(error)); }

        return sb.toString();
    }

    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    @PostMapping(value = "/oauth2/token", consumes = "application/x-www-form-urlencoded")
    @ResponseBody
    @Operation(summary = "Token endpoint", description = "Exchange authorization code for tokens (grant_type=authorization_code) or refresh an access token (grant_type=refresh_token). RFC 6749 §4.1.3 and §6. Supports client_secret_basic (Authorization: Basic) and client_secret_post.")
    public ResponseEntity<TokenResponse> token(
            @RequestParam("grant_type") String grantType,
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "redirect_uri", required = false) String redirectUri,
            @RequestParam(value = "client_id", required = false) String clientId,
            @RequestParam(value = "client_secret", required = false) String clientSecret,
            @RequestParam(value = "code_verifier", required = false) String codeVerifier,
            @RequestParam(value = "refresh_token", required = false) String refreshToken,
            HttpServletRequest request
    ) {
        String[] creds = resolveClientCredentials(request, clientId, clientSecret);
        String resolvedClientId = creds[0];
        String resolvedClientSecret = creds[1];
        return switch (grantType) {
            case "authorization_code" -> ResponseEntity.ok(
                    oidcService.exchangeAuthCode(code, resolvedClientId, redirectUri, resolvedClientSecret, codeVerifier)
            );
            case "refresh_token" -> ResponseEntity.ok(
                    oidcService.refreshAccessToken(refreshToken, resolvedClientId, resolvedClientSecret)
            );
            default -> throw new IllegalArgumentException("Unsupported grant_type: " + grantType);
        };
    }

    @GetMapping("/oauth2/userinfo")
    @ResponseBody
    @Operation(summary = "UserInfo endpoint", description = "Returns identity claims for the authenticated user (OIDC Core §5.3). Requires Bearer token.")
    @SecurityRequirement(name = "BearerAuth")
    public ResponseEntity<UserInfoResponse> userinfo() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getDetails() instanceof Claims claims)) {
            throw new InvalidTokenException("No valid token");
        }

        UUID userId = UUID.fromString(claims.getSubject());
        java.util.Set<String> aud = claims.getAudience();
        String clientId = (aud != null && !aud.isEmpty()) ? aud.iterator().next() : null;

        return ResponseEntity.ok(oidcService.getUserInfo(userId, clientId));
    }

    @PostMapping(value = "/oauth2/token/revoke", consumes = "application/x-www-form-urlencoded")
    @ResponseBody
    @Operation(summary = "Token revocation (RFC 7009)", description = "Revokes a refresh_token. Returns 200 even if the token is invalid (RFC 7009 §2.2). Supports client_secret_basic and client_secret_post.")
    public ResponseEntity<Void> revokeToken(
            @RequestParam("token") String token,
            @RequestParam(value = "token_type_hint", required = false) String tokenTypeHint,
            @RequestParam(value = "client_id", required = false) String clientId,
            @RequestParam(value = "client_secret", required = false) String clientSecret,
            HttpServletRequest request
    ) {
        String[] creds = resolveClientCredentials(request, clientId, clientSecret);
        oidcService.revokeToken(token, tokenTypeHint, creds[0], creds[1]);
        return ResponseEntity.ok().build();
    }

    @PostMapping(value = "/oauth2/introspect", consumes = "application/x-www-form-urlencoded")
    @ResponseBody
    @Operation(summary = "Token introspection (RFC 7662)", description = "Returns active/inactive status and metadata for an access_token or refresh_token. Client must authenticate.")
    public ResponseEntity<Map<String, Object>> introspect(
            @RequestParam("token") String token,
            @RequestParam(value = "token_type_hint", required = false) String tokenTypeHint,
            @RequestParam(value = "client_id", required = false) String clientId,
            @RequestParam(value = "client_secret", required = false) String clientSecret,
            HttpServletRequest request
    ) {
        String[] creds = resolveClientCredentials(request, clientId, clientSecret);
        try {
            if (creds[1] != null && !creds[1].isBlank()) oidcService.validateClient(creds[0], creds[1]);
            else oidcService.validatePublicClient(creds[0]);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("active", false));
        }
        return ResponseEntity.ok(oidcService.introspect(token, tokenTypeHint));
    }

    private boolean qualifiesForAutoEnroll(String username, UUID ldapServerId, Application app) {
        return switch (app.getAccessMode()) {
            case PUBLIC -> true;
            case LDAP_GROUP -> {
                List<AppAccessRule> rules = appAccessRuleRepository.findAllByAppId(app.getId())
                        .stream().filter(r -> "LDAP_GROUP".equals(r.getRuleType())).toList();
                if (rules.isEmpty()) yield false;
                List<String> groups = ldapService.getUserGroups(username, ldapServerId);
                yield rules.stream().anyMatch(rule ->
                        (rule.getLdapServerId() == null || rule.getLdapServerId().equals(ldapServerId)) &&
                        groups.stream().anyMatch(g -> g.equalsIgnoreCase(rule.getValue())));
            }
            case LDAP_OU -> {
                List<AppAccessRule> rules = appAccessRuleRepository.findAllByAppId(app.getId())
                        .stream().filter(r -> "LDAP_OU".equals(r.getRuleType())).toList();
                if (rules.isEmpty()) yield false;
                String userDn = ldapService.getUserDn(username, ldapServerId);
                if (userDn == null) yield false;
                String normalizedUserDn = normalizeDn(userDn);
                yield rules.stream().anyMatch(rule ->
                        (rule.getLdapServerId() == null || rule.getLdapServerId().equals(ldapServerId)) &&
                        normalizedUserDn.endsWith(normalizeDn(rule.getValue())));
            }
            case ASSIGNED -> false;
        };
    }

    private static String normalizeDn(String dn) {
        if (dn == null) return "";
        return dn.replaceAll("\\s*,\\s*", ",").replaceAll("\\s*=\\s*", "=").toLowerCase();
    }

    private static String[] resolveClientCredentials(HttpServletRequest request, String bodyClientId, String bodyClientSecret) {
        // client_secret_post: both credentials present in the body — use them directly
        if (bodyClientId != null && !bodyClientId.isBlank()
                && bodyClientSecret != null && !bodyClientSecret.isBlank()) {
            return new String[]{bodyClientId, bodyClientSecret};
        }
        // client_secret_basic: check Authorization header (RFC 6749 §2.3.1 — header takes precedence
        // when client sends client_id in body but secret only in the header, which many libraries do)
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.regionMatches(true, 0, "Basic ", 0, 6)) {
            try {
                String decoded = new String(Base64.getDecoder().decode(authHeader.substring(6).trim()), StandardCharsets.UTF_8);
                int colon = decoded.indexOf(':');
                if (colon >= 0) {
                    return new String[]{
                        java.net.URLDecoder.decode(decoded.substring(0, colon), StandardCharsets.UTF_8),
                        java.net.URLDecoder.decode(decoded.substring(colon + 1), StandardCharsets.UTF_8)
                    };
                }
            } catch (Exception ignored) {}
        }
        // Fall back to body values (public clients with no secret)
        return new String[]{bodyClientId, bodyClientSecret};
    }

    @PostMapping(value = "/oauth2/logout")
    @ResponseBody
    @Operation(summary = "Logout / end session (POST)", description = "Invalidates the SSO session and refresh token. Clears the session cookie. Remember tokens are preserved (Google-style: user can still click 'continue as' next visit).")
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

    @GetMapping(value = "/oauth2/logout")
    @Operation(summary = "Logout / end session (GET)", description = "RP-initiated logout via browser redirect (OIDC Session Management). Clears session cookie and redirects to post_logout_redirect_uri if provided.")
    public String logoutGet(
            @RequestParam(value = "id_token_hint", required = false) String idTokenHint,
            @RequestParam(value = "post_logout_redirect_uri", required = false) String redirectUri,
            @RequestParam(value = "client_id", required = false) String clientId,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String sessionId = getSessionCookie(request);
        oidcService.logout(null, sessionId, clientId);
        Cookie expiredCookie = buildSessionCookie("");
        expiredCookie.setMaxAge(0);
        response.addCookie(expiredCookie);
        if (redirectUri != null && !redirectUri.isBlank()) {
            // Validate against registered post-logout redirect URIs for the client
            String resolvedClientId = clientId;
            if (resolvedClientId == null && idTokenHint != null) {
                try {
                    io.jsonwebtoken.Claims claims = oidcService.parseIdTokenHint(idTokenHint);
                    if (claims != null && claims.getAudience() != null && !claims.getAudience().isEmpty()) {
                        resolvedClientId = claims.getAudience().iterator().next();
                    }
                } catch (Exception ignored) {}
            }
            if (resolvedClientId != null) {
                boolean allowed = applicationRepository.findByClientId(resolvedClientId)
                        .map(app -> app.getPostLogoutRedirectUris() != null
                                && Arrays.asList(app.getPostLogoutRedirectUris()).contains(redirectUri))
                        .orElse(false);
                if (allowed) return "redirect:" + redirectUri;
            }
        }
        return "redirect:/login?logged_out=1";
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

    private Cookie buildProfileCookie(List<String[]> profiles) {
        Cookie profileCookie = new Cookie("ao-user", buildProfileCookieValue(profiles));
        profileCookie.setHttpOnly(false);
        profileCookie.setSecure(idpProperties.issuer().startsWith("https"));
        profileCookie.setPath("/");
        profileCookie.setMaxAge(30 * 24 * 60 * 60);
        String domain = idpProperties.cookie().domain();
        if (domain != null && domain.startsWith(".")) {
            domain = domain.substring(1);
        }
        if (domain != null) profileCookie.setDomain(domain);
        return profileCookie;
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

    private String getUserProfileCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if ("ao-user".equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) return c.getValue();
        }
        return null;
    }

    /**
     * Parses the ao-user cookie into a list of [username, displayName, rememberToken?] triples.
     * rememberToken may be null for entries that don't have one (old format or accounts
     * that were not logged in during this session).
     */
    private List<String[]> parseProfileList(String cookieValue) {
        var result = new ArrayList<String[]>();
        if (cookieValue == null || cookieValue.isBlank()) return result;
        try {
            String decoded = new String(Base64.getUrlDecoder().decode(cookieValue), StandardCharsets.UTF_8).trim();
            // Match each JSON object in the array
            Pattern objPattern  = Pattern.compile("\\{[^}]+\\}");
            Pattern uPattern    = Pattern.compile("\"u\":\"((?:[^\"\\\\]|\\\\.)*)\"");
            Pattern nPattern    = Pattern.compile("\"n\":\"((?:[^\"\\\\]|\\\\.)*)\"");
            Pattern rtPattern   = Pattern.compile("\"rt\":\"([A-Za-z0-9_-]+)\"");
            Matcher objMatcher  = objPattern.matcher(decoded);
            while (objMatcher.find()) {
                String obj = objMatcher.group();
                Matcher uM = uPattern.matcher(obj);
                Matcher nM = nPattern.matcher(obj);
                if (!uM.find() || !nM.find()) continue;
                String u  = unescapeJson(uM.group(1));
                String n  = unescapeJson(nM.group(1));
                Matcher rtM = rtPattern.matcher(obj);
                String rt = rtM.find() ? rtM.group(1) : null;
                result.add(new String[]{u, n, rt});
            }
        } catch (Exception ignored) {}
        return result;
    }

    private String buildProfileCookieValue(List<String[]> profiles) {
        var sb = new StringBuilder("[");
        for (int i = 0; i < profiles.size(); i++) {
            if (i > 0) sb.append(",");
            String u  = profiles.get(i)[0];
            String n  = profiles.get(i)[1];
            String rt = profiles.get(i).length > 2 ? profiles.get(i)[2] : null;
            sb.append("{\"u\":\"").append(escapeJson(u))
              .append("\",\"n\":\"").append(escapeJson(n)).append("\"");
            if (rt != null && !rt.isBlank()) {
                sb.append(",\"rt\":\"").append(rt).append("\"");
            }
            sb.append("}");
        }
        sb.append("]");
        return Base64.getUrlEncoder().withoutPadding().encodeToString(sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static String unescapeJson(String s) {
        return s.replace("\\\"", "\"").replace("\\\\", "\\").replace("\\/", "/")
                .replace("\\n", "\n").replace("\\r", "\r").replace("\\t", "\t");
    }

    private static String nvl(String s, String fallback) {
        return (s == null || s.isBlank()) ? fallback : s;
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
