package az.ao.idp.service;

import az.ao.idp.config.IdpProperties;
import az.ao.idp.util.CryptoUtil;
import az.ao.idp.util.SecureRandomUtil;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class RefreshTokenService {

    private static final String REFRESH_PREFIX = "refresh:";
    private static final String USER_TOKENS_PREFIX = "user_tokens:";

    private final RedisTemplate<String, Object> redisTemplate;
    private final SecureRandomUtil secureRandomUtil;
    private final CryptoUtil cryptoUtil;
    private final Duration refreshTokenTtl;

    public RefreshTokenService(
            RedisTemplate<String, Object> redisTemplate,
            SecureRandomUtil secureRandomUtil,
            CryptoUtil cryptoUtil,
            IdpProperties idpProperties
    ) {
        this.redisTemplate = redisTemplate;
        this.secureRandomUtil = secureRandomUtil;
        this.cryptoUtil = cryptoUtil;
        this.refreshTokenTtl = Duration.ofDays(idpProperties.jwt().refreshTokenExpiryDays());
    }

    public String issue(UUID userId, String clientId) {
        String token = secureRandomUtil.generateRefreshToken();
        String tokenHash = cryptoUtil.sha256Hex(token);
        String key = REFRESH_PREFIX + tokenHash;

        Map<String, Object> data = new HashMap<>();
        data.put("user_id", userId.toString());
        data.put("client_id", clientId);
        data.put("used", false);
        data.put("issued_at", System.currentTimeMillis());

        redisTemplate.opsForHash().putAll(key, data);
        redisTemplate.expire(key, refreshTokenTtl);

        redisTemplate.opsForSet().add(USER_TOKENS_PREFIX + userId, tokenHash);

        return token;
    }

    public RefreshTokenData validate(String token) {
        String tokenHash = cryptoUtil.sha256Hex(token);
        String key = REFRESH_PREFIX + tokenHash;

        Map<Object, Object> data = redisTemplate.opsForHash().entries(key);
        if (data == null || data.isEmpty()) return null;

        Boolean used = (Boolean) data.get("used");
        if (Boolean.TRUE.equals(used)) {
            UUID userId = UUID.fromString((String) data.get("user_id"));
            revokeAllForUser(userId);
            return null;
        }

        return new RefreshTokenData(
                UUID.fromString((String) data.get("user_id")),
                (String) data.get("client_id"),
                tokenHash
        );
    }

    public void consume(String tokenHash) {
        redisTemplate.opsForHash().put(REFRESH_PREFIX + tokenHash, "used", true);
    }

    public void revoke(String token) {
        String tokenHash = cryptoUtil.sha256Hex(token);
        redisTemplate.delete(REFRESH_PREFIX + tokenHash);
    }

    public void revokeAllForUser(UUID userId) {
        String userKey = USER_TOKENS_PREFIX + userId;
        var tokenHashes = redisTemplate.opsForSet().members(userKey);
        if (tokenHashes != null) {
            tokenHashes.forEach(hash -> redisTemplate.delete(REFRESH_PREFIX + hash));
        }
        redisTemplate.delete(userKey);
    }

    public record RefreshTokenData(UUID userId, String clientId, String tokenHash) {}
}
