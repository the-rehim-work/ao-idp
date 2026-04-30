package az.ao.idp.service;

import az.ao.idp.config.IdpProperties;
import az.ao.idp.entity.AuthCode;
import az.ao.idp.entity.Session;
import az.ao.idp.repository.AuthCodeRepository;
import az.ao.idp.repository.SessionRepository;
import az.ao.idp.util.SecureRandomUtil;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
public class SessionService {

    private final SessionRepository sessionRepository;
    private final AuthCodeRepository authCodeRepository;
    private final SecureRandomUtil secureRandomUtil;
    private final Duration sessionTtl;

    public SessionService(
            SessionRepository sessionRepository,
            AuthCodeRepository authCodeRepository,
            SecureRandomUtil secureRandomUtil,
            IdpProperties idpProperties
    ) {
        this.sessionRepository = sessionRepository;
        this.authCodeRepository = authCodeRepository;
        this.secureRandomUtil = secureRandomUtil;
        this.sessionTtl = Duration.ofSeconds(idpProperties.cookie().maxAgeSeconds());
    }

    @Transactional
    public String createSession(UUID userId, String ldapUsername) {
        String sessionId = secureRandomUtil.generateSessionId();
        Session session = new Session();
        session.setId(sessionId);
        session.setUserId(userId);
        session.setLdapUsername(ldapUsername);
        session.setExpiresAt(Instant.now().plus(sessionTtl));
        sessionRepository.save(session);
        return sessionId;
    }

    @Transactional(readOnly = true)
    public SessionData getSession(String sessionId) {
        return sessionRepository.findByIdAndExpiresAtAfter(sessionId, Instant.now())
                .map(s -> new SessionData(s.getUserId(), s.getLdapUsername()))
                .orElse(null);
    }

    @Transactional
    public void invalidateSession(String sessionId) {
        sessionRepository.deleteById(sessionId);
    }

    @Transactional
    public void storeAuthCode(String code, AuthCodeData data, String codeChallenge, Duration ttl) {
        AuthCode authCode = new AuthCode();
        authCode.setCode(code);
        authCode.setUserId(data.userId());
        authCode.setClientId(data.clientId());
        authCode.setRedirectUri(data.redirectUri());
        authCode.setScope(data.scope());
        authCode.setCodeChallenge(codeChallenge);
        authCode.setExpiresAt(Instant.now().plus(ttl));
        authCodeRepository.save(authCode);
    }

    @Transactional
    public AuthCodeData consumeAuthCode(String code) {
        AuthCode authCode = authCodeRepository.findByCodeAndExpiresAtAfter(code, Instant.now())
                .orElse(null);
        if (authCode == null) return null;
        authCodeRepository.delete(authCode);
        return new AuthCodeData(
                authCode.getUserId(),
                authCode.getClientId(),
                authCode.getRedirectUri(),
                authCode.getScope(),
                authCode.getCodeChallenge()
        );
    }

    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void cleanupExpired() {
        Instant now = Instant.now();
        sessionRepository.deleteExpired(now);
        authCodeRepository.deleteExpired(now);
    }

    public record SessionData(UUID userId, String ldapUsername) {}
    public record AuthCodeData(UUID userId, String clientId, String redirectUri, String scope, String codeChallenge) {}
}
