package az.ao.idp.service;

import az.ao.idp.entity.IdpSetting;
import az.ao.idp.repository.IdpSettingRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class IdpSettingsService {

    public record ClaimMapping(String claim, String ldapAttr, String description, boolean enabled) {}

    public record TokenSettings(long accessTokenExpiryMinutes, long refreshTokenExpiryDays, long adminTokenExpiryMinutes) {}

    private static final String KEY_ACCESS_EXPIRY = "access_token_expiry_minutes";
    private static final String KEY_REFRESH_EXPIRY = "refresh_token_expiry_days";
    private static final String KEY_ADMIN_EXPIRY = "admin_token_expiry_minutes";
    private static final String KEY_CLAIM_MAPPINGS = "jwt_claim_mappings";

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

    public Map<String, Object> getAllSettings() {
        return Map.of(
                "tokenSettings", getTokenSettings(),
                "claimMappings", getClaimMappings()
        );
    }
}
