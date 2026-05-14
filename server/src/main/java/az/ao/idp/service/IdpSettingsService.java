package az.ao.idp.service;

import az.ao.idp.entity.IdpSetting;
import az.ao.idp.repository.IdpSettingRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.Map;

@Service
public class IdpSettingsService {

    public record ClaimMapping(String claim, String ldapAttr, String description, boolean enabled) {}

    public record TokenSettings(long accessTokenExpiryMinutes, long refreshTokenExpiryDays, long adminTokenExpiryMinutes) {}

    private static final String KEY_ACCESS_EXPIRY = "access_token_expiry_minutes";
    private static final String KEY_REFRESH_EXPIRY = "refresh_token_expiry_days";
    private static final String KEY_ADMIN_EXPIRY = "admin_token_expiry_minutes";
    private static final String KEY_CLAIM_MAPPINGS = "jwt_claim_mappings";
    private static final String KEY_LOGIN_IDENTIFIER_TYPE = "login_identifier_type";
    private static final String KEY_LOGIN_PAGE_TITLE = "login_page_title";
    private static final String KEY_LOG_RETENTION_DAYS = "log_retention_days";

    // OAuth2 / OIDC login page branding
    private static final String KEY_LOGIN_LOGO_URL = "login_logo_url";
    private static final String KEY_LOGIN_PRIMARY_COLOR = "login_primary_color";
    private static final String KEY_LOGIN_BG_COLOR = "login_bg_color";
    private static final String KEY_LOGIN_TEXT_COLOR = "login_text_color";
    private static final String KEY_LOGIN_WELCOME = "login_welcome_text";
    private static final String KEY_LOGIN_FOOTER = "login_footer_text";
    private static final String KEY_LOGIN_CUSTOM_CSS = "login_custom_css";

    // Security settings keys
    private static final String KEY_LOCKOUT_ENABLED = "sec_lockout_enabled";
    private static final String KEY_LOCKOUT_MAX_ATTEMPTS = "sec_lockout_max_attempts";
    private static final String KEY_LOCKOUT_WINDOW_MINUTES = "sec_lockout_window_minutes";
    private static final String KEY_LOCKOUT_DURATION_MINUTES = "sec_lockout_duration_minutes";
    private static final String KEY_SESSION_IDLE_MINUTES = "sec_session_idle_minutes";
    private static final String KEY_SESSION_ABSOLUTE_HOURS = "sec_session_absolute_hours";
    private static final String KEY_REQUIRE_PKCE = "sec_require_pkce";
    private static final String KEY_REFRESH_TOKEN_ROTATION = "sec_refresh_token_rotation";
    private static final String KEY_IP_ALLOWLIST = "sec_ip_allowlist";
    private static final String KEY_FORCE_HTTPS = "sec_force_https";

    private final IdpSettingRepository repository;
    private final ObjectMapper objectMapper;
    private final LdapConfigService ldapConfigService;

    public IdpSettingsService(IdpSettingRepository repository, ObjectMapper objectMapper, LdapConfigService ldapConfigService) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.ldapConfigService = ldapConfigService;
    }

    public String get(String key) {
        return repository.findById(key).map(IdpSetting::getValue).orElse(null);
    }

    @Transactional
    public void set(String key, String value) {
        IdpSetting setting = repository.findById(key).orElse(new IdpSetting(key, value));
        setting.setValue(value);
        repository.save(setting);
    }

    public long getAccessTokenExpiryMinutes() {
        String val = get(KEY_ACCESS_EXPIRY);
        return val != null ? Long.parseLong(val) : 15L;
    }

    public long getRefreshTokenExpiryDays() {
        String val = get(KEY_REFRESH_EXPIRY);
        return val != null ? Long.parseLong(val) : 7L;
    }

    public long getAdminTokenExpiryMinutes() {
        String val = get(KEY_ADMIN_EXPIRY);
        return val != null ? Long.parseLong(val) : 30L;
    }

    public TokenSettings getTokenSettings() {
        return new TokenSettings(getAccessTokenExpiryMinutes(), getRefreshTokenExpiryDays(), getAdminTokenExpiryMinutes());
    }

    @Transactional
    public void setTokenSettings(long accessMinutes, long refreshDays, long adminMinutes) {
        set(KEY_ACCESS_EXPIRY, String.valueOf(accessMinutes));
        set(KEY_REFRESH_EXPIRY, String.valueOf(refreshDays));
        set(KEY_ADMIN_EXPIRY, String.valueOf(adminMinutes));
    }

    public List<ClaimMapping> getClaimMappings() {
        return getClaimMappings(null);
    }

    /**
     * Returns claim mappings for a specific LDAP server (by id), falling back to the
     * active server's mappings, then to the global idp_setting key.
     */
    public List<ClaimMapping> getClaimMappings(java.util.UUID ldapServerId) {
        // 1. Try the specific server the user authenticated against
        if (ldapServerId != null) {
            try {
                String json = ldapConfigService.get(ldapServerId).getClaimMappings();
                if (json != null && !json.isBlank()) {
                    return objectMapper.readValue(json, new TypeReference<List<ClaimMapping>>() {});
                }
            } catch (Exception ignored) {}
        }
        // 2. Fall back to first active server's mappings
        String json = ldapConfigService.getActive()
                .map(az.ao.idp.entity.LdapServerConfig::getClaimMappings)
                .filter(s -> s != null && !s.isBlank())
                .orElseGet(() -> get(KEY_CLAIM_MAPPINGS));
        if (json == null) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<ClaimMapping>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    @Transactional
    public void setClaimMappings(List<ClaimMapping> mappings) {
        try {
            String json = objectMapper.writeValueAsString(mappings);
            ldapConfigService.getActive().ifPresentOrElse(
                    active -> ldapConfigService.saveClaimMappings(active.getId(), json),
                    () -> set(KEY_CLAIM_MAPPINGS, json)
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize claim mappings", e);
        }
    }

    public record LoginSettings(String identifierType, String pageTitle, int logRetentionDays,
                                String usernameAttribute, String emailAttribute) {}

    public LoginSettings getLoginSettings() {
        String type = get(KEY_LOGIN_IDENTIFIER_TYPE);
        String title = get(KEY_LOGIN_PAGE_TITLE);
        String retention = get(KEY_LOG_RETENTION_DAYS);
        var activeLdap = ldapConfigService.getActive();
        String usernameAttr = activeLdap.map(az.ao.idp.entity.LdapServerConfig::getUsernameAttribute).orElse("sAMAccountName");
        String emailAttr    = activeLdap.map(az.ao.idp.entity.LdapServerConfig::getEmailAttribute).orElse("mail");
        return new LoginSettings(
                type != null ? type : "any",
                title != null ? title : "AO ID",
                retention != null ? Integer.parseInt(retention) : 10,
                usernameAttr,
                emailAttr
        );
    }

    @Transactional
    public void setLoginSettings(String identifierType, String pageTitle, int logRetentionDays) {
        if (identifierType != null) set(KEY_LOGIN_IDENTIFIER_TYPE, identifierType);
        if (pageTitle != null) set(KEY_LOGIN_PAGE_TITLE, pageTitle);
        set(KEY_LOG_RETENTION_DAYS, String.valueOf(logRetentionDays));
    }

    public int getLogRetentionDays() {
        String val = get(KEY_LOG_RETENTION_DAYS);
        return val != null ? Integer.parseInt(val) : 10;
    }

    public record LoginBranding(
            String logoUrl,
            String primaryColor,
            String bgColor,
            String textColor,
            String welcomeText,
            String footerText,
            String customCss
    ) {}

    public LoginBranding getLoginBranding() {
        return new LoginBranding(
                getOrDefault(KEY_LOGIN_LOGO_URL, ""),
                getOrDefault(KEY_LOGIN_PRIMARY_COLOR, "#5eead4"),
                getOrDefault(KEY_LOGIN_BG_COLOR, "#0a0c10"),
                getOrDefault(KEY_LOGIN_TEXT_COLOR, "#e7ebf0"),
                getOrDefault(KEY_LOGIN_WELCOME, ""),
                getOrDefault(KEY_LOGIN_FOOTER, ""),
                getOrDefault(KEY_LOGIN_CUSTOM_CSS, "")
        );
    }

    @Transactional
    public LoginBranding setLoginBranding(LoginBranding b) {
        set(KEY_LOGIN_LOGO_URL, b.logoUrl() == null ? "" : b.logoUrl().trim());
        set(KEY_LOGIN_PRIMARY_COLOR, b.primaryColor() == null ? "#5eead4" : b.primaryColor());
        set(KEY_LOGIN_BG_COLOR, b.bgColor() == null ? "#0a0c10" : b.bgColor());
        set(KEY_LOGIN_TEXT_COLOR, b.textColor() == null ? "#e7ebf0" : b.textColor());
        set(KEY_LOGIN_WELCOME, b.welcomeText() == null ? "" : b.welcomeText());
        set(KEY_LOGIN_FOOTER, b.footerText() == null ? "" : b.footerText());
        set(KEY_LOGIN_CUSTOM_CSS, b.customCss() == null ? "" : b.customCss());
        return getLoginBranding();
    }

    public record SecuritySettings(
            boolean lockoutEnabled,
            int lockoutMaxAttempts,
            int lockoutWindowMinutes,
            int lockoutDurationMinutes,
            int sessionIdleMinutes,
            int sessionAbsoluteHours,
            boolean requirePkce,
            boolean refreshTokenRotation,
            String ipAllowlist,
            boolean forceHttps
    ) {}

    private String getOrDefault(String key, String def) {
        String v = get(key);
        return v == null ? def : v;
    }

    public SecuritySettings getSecuritySettings() {
        return new SecuritySettings(
                Boolean.parseBoolean(getOrDefault(KEY_LOCKOUT_ENABLED, "true")),
                Integer.parseInt(getOrDefault(KEY_LOCKOUT_MAX_ATTEMPTS, "5")),
                Integer.parseInt(getOrDefault(KEY_LOCKOUT_WINDOW_MINUTES, "15")),
                Integer.parseInt(getOrDefault(KEY_LOCKOUT_DURATION_MINUTES, "30")),
                Integer.parseInt(getOrDefault(KEY_SESSION_IDLE_MINUTES, "30")),
                Integer.parseInt(getOrDefault(KEY_SESSION_ABSOLUTE_HOURS, "12")),
                Boolean.parseBoolean(getOrDefault(KEY_REQUIRE_PKCE, "true")),
                Boolean.parseBoolean(getOrDefault(KEY_REFRESH_TOKEN_ROTATION, "false")),
                getOrDefault(KEY_IP_ALLOWLIST, ""),
                Boolean.parseBoolean(getOrDefault(KEY_FORCE_HTTPS, "false"))
        );
    }

    @Transactional
    public SecuritySettings setSecuritySettings(SecuritySettings s) {
        set(KEY_LOCKOUT_ENABLED, String.valueOf(s.lockoutEnabled()));
        set(KEY_LOCKOUT_MAX_ATTEMPTS, String.valueOf(Math.max(1, Math.min(20, s.lockoutMaxAttempts()))));
        set(KEY_LOCKOUT_WINDOW_MINUTES, String.valueOf(Math.max(1, Math.min(1440, s.lockoutWindowMinutes()))));
        set(KEY_LOCKOUT_DURATION_MINUTES, String.valueOf(Math.max(1, Math.min(1440, s.lockoutDurationMinutes()))));
        set(KEY_SESSION_IDLE_MINUTES, String.valueOf(Math.max(1, Math.min(1440, s.sessionIdleMinutes()))));
        set(KEY_SESSION_ABSOLUTE_HOURS, String.valueOf(Math.max(1, Math.min(720, s.sessionAbsoluteHours()))));
        set(KEY_REQUIRE_PKCE, String.valueOf(s.requirePkce()));
        set(KEY_REFRESH_TOKEN_ROTATION, String.valueOf(s.refreshTokenRotation()));
        set(KEY_IP_ALLOWLIST, s.ipAllowlist() == null ? "" : s.ipAllowlist().trim());
        set(KEY_FORCE_HTTPS, String.valueOf(s.forceHttps()));
        return getSecuritySettings();
    }

    public Map<String, Object> getAllSettings() {
        return Map.of(
                "tokenSettings", getTokenSettings(),
                "claimMappings", getClaimMappings(),
                "loginSettings", getLoginSettings(),
                "securitySettings", getSecuritySettings()
        );
    }
}
