package az.ao.idp.service;

import az.ao.idp.entity.RememberToken;
import az.ao.idp.repository.RememberTokenRepository;
import az.ao.idp.util.CryptoUtil;
import az.ao.idp.util.SecureRandomUtil;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
public class RememberTokenService {

    private static final Duration TTL = Duration.ofDays(30);

    private final RememberTokenRepository repository;
    private final SecureRandomUtil secureRandomUtil;
    private final CryptoUtil cryptoUtil;

    public RememberTokenService(
            RememberTokenRepository repository,
            SecureRandomUtil secureRandomUtil,
            CryptoUtil cryptoUtil
    ) {
        this.repository = repository;
        this.secureRandomUtil = secureRandomUtil;
        this.cryptoUtil = cryptoUtil;
    }

    @Transactional
    public String issue(UUID userId, String ldapUsername) {
        String token = secureRandomUtil.generateRememberToken();
        String tokenHash = cryptoUtil.sha256Hex(token);
        RememberToken rt = new RememberToken();
        rt.setTokenHash(tokenHash);
        rt.setUserId(userId);
        rt.setLdapUsername(ldapUsername);
        rt.setExpiresAt(Instant.now().plus(TTL));
        repository.save(rt);
        return token;
    }

    @Transactional(readOnly = true)
    public TokenData validate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return null;
        String tokenHash = cryptoUtil.sha256Hex(rawToken);
        return repository.findById(tokenHash)
                .filter(rt -> rt.getExpiresAt().isAfter(Instant.now()))
                .map(rt -> new TokenData(rt.getUserId(), rt.getLdapUsername(), tokenHash))
                .orElse(null);
    }

    @Transactional
    public void invalidateByHash(String tokenHash) {
        repository.deleteById(tokenHash);
    }

    @Transactional
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        repository.deleteById(cryptoUtil.sha256Hex(rawToken));
    }

    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void cleanupExpired() {
        repository.deleteExpired(Instant.now());
    }

    public record TokenData(UUID userId, String ldapUsername, String tokenHash) {}
}
