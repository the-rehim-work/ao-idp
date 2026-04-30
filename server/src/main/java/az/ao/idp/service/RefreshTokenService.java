package az.ao.idp.service;

import az.ao.idp.config.IdpProperties;
import az.ao.idp.entity.RefreshToken;
import az.ao.idp.repository.RefreshTokenRepository;
import az.ao.idp.util.CryptoUtil;
import az.ao.idp.util.SecureRandomUtil;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final SecureRandomUtil secureRandomUtil;
    private final CryptoUtil cryptoUtil;
    private final Duration refreshTokenTtl;

    public RefreshTokenService(
            RefreshTokenRepository refreshTokenRepository,
            SecureRandomUtil secureRandomUtil,
            CryptoUtil cryptoUtil,
            IdpProperties idpProperties
    ) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.secureRandomUtil = secureRandomUtil;
        this.cryptoUtil = cryptoUtil;
        this.refreshTokenTtl = Duration.ofDays(idpProperties.jwt().refreshTokenExpiryDays());
    }

    @Transactional
    public String issue(UUID userId, String clientId) {
        String token = secureRandomUtil.generateRefreshToken();
        String tokenHash = cryptoUtil.sha256Hex(token);

        RefreshToken rt = new RefreshToken();
        rt.setTokenHash(tokenHash);
        rt.setUserId(userId);
        rt.setClientId(clientId);
        rt.setExpiresAt(Instant.now().plus(refreshTokenTtl));
        refreshTokenRepository.save(rt);

        return token;
    }

    @Transactional
    public RefreshTokenData validate(String token) {
        String tokenHash = cryptoUtil.sha256Hex(token);
        Optional<RefreshToken> opt = refreshTokenRepository.findById(tokenHash);
        if (opt.isEmpty()) return null;

        RefreshToken rt = opt.get();

        if (rt.isUsed()) {
            revokeAllForUser(rt.getUserId());
            return null;
        }

        if (rt.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.delete(rt);
            return null;
        }

        return new RefreshTokenData(rt.getUserId(), rt.getClientId(), tokenHash);
    }

    @Transactional
    public void consume(String tokenHash) {
        refreshTokenRepository.findById(tokenHash).ifPresent(rt -> {
            rt.setUsed(true);
            refreshTokenRepository.save(rt);
        });
    }

    @Transactional
    public void revoke(String token) {
        String tokenHash = cryptoUtil.sha256Hex(token);
        refreshTokenRepository.deleteById(tokenHash);
    }

    @Transactional
    public void revokeAllForUser(UUID userId) {
        refreshTokenRepository.deleteByUserId(userId);
    }

    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void cleanupExpired() {
        refreshTokenRepository.deleteExpired(Instant.now());
    }

    public record RefreshTokenData(UUID userId, String clientId, String tokenHash) {}
}
