package az.ao.idp.service;

import az.ao.idp.config.IdpProperties;
import az.ao.idp.util.SecureRandomUtil;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class SessionService {

    private static final String SESSION_PREFIX = "session:";

    private final RedisTemplate<String, Object> redisTemplate;
    private final SecureRandomUtil secureRandomUtil;
    private final Duration sessionTtl;

    public SessionService(
            RedisTemplate<String, Object> redisTemplate,
            SecureRandomUtil secureRandomUtil,
            IdpProperties idpProperties
    ) {
        this.redisTemplate = redisTemplate;
        this.secureRandomUtil = secureRandomUtil;
        this.sessionTtl = Duration.ofSeconds(idpProperties.cookie().maxAgeSeconds());
    }

    public String createSession(UUID userId, String ldapUsername) {
        String sessionId = secureRandomUtil.generateSessionId();
        Map<String, Object> sessionData = new HashMap<>();
        sessionData.put("user_id", userId.toString());
        sessionData.put("ldap_username", ldapUsername);
        sessionData.put("created_at", System.currentTimeMillis());

        redisTemplate.opsForHash().putAll(SESSION_PREFIX + sessionId, sessionData);
        redisTemplate.expire(SESSION_PREFIX + sessionId, sessionTtl);

        return sessionId;
    }

    public SessionData getSession(String sessionId) {
        Map<Object, Object> data = redisTemplate.opsForHash().entries(SESSION_PREFIX + sessionId);
        if (data == null || data.isEmpty()) return null;

        return new SessionData(
                UUID.fromString((String) data.get("user_id")),
                (String) data.get("ldap_username")
        );
    }

    public void invalidateSession(String sessionId) {
        redisTemplate.delete(SESSION_PREFIX + sessionId);
    }

    public void storeAuthCode(String code, AuthCodeData data, String codeChallenge, Duration ttl) {
        Map<String, Object> codeData = new HashMap<>();
        codeData.put("user_id", data.userId().toString());
        codeData.put("client_id", data.clientId());
        codeData.put("redirect_uri", data.redirectUri());
        codeData.put("scope", data.scope());
        if (codeChallenge != null && !codeChallenge.isBlank()) {
            codeData.put("code_challenge", codeChallenge);
        }

        redisTemplate.opsForHash().putAll("authcode:" + code, codeData);
        redisTemplate.expire("authcode:" + code, ttl);
    }

    public AuthCodeData consumeAuthCode(String code) {
        String key = "authcode:" + code;
        Map<Object, Object> data = redisTemplate.opsForHash().entries(key);
        if (data == null || data.isEmpty()) return null;

        redisTemplate.delete(key);

        return new AuthCodeData(
                UUID.fromString((String) data.get("user_id")),
                (String) data.get("client_id"),
                (String) data.get("redirect_uri"),
                (String) data.get("scope"),
                (String) data.get("code_challenge")
        );
    }

    public record SessionData(UUID userId, String ldapUsername) {}

    public record AuthCodeData(UUID userId, String clientId, String redirectUri, String scope, String codeChallenge) {}
}
