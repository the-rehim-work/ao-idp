package az.ao.idp.service;

import az.ao.idp.config.IdpProperties;
import az.ao.idp.entity.LoginAttempt;
import az.ao.idp.exception.AccountLockedException;
import az.ao.idp.repository.LoginAttemptRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class BruteForceService {

    private final LoginAttemptRepository loginAttemptRepository;
    private final IdpProperties.BruteForceProperties config;

    private final ConcurrentHashMap<String, long[]> ipWindowMap = new ConcurrentHashMap<>();

    public BruteForceService(
            LoginAttemptRepository loginAttemptRepository,
            IdpProperties idpProperties
    ) {
        this.loginAttemptRepository = loginAttemptRepository;
        this.config = idpProperties.bruteForce();
    }

    public void checkAndThrowIfLocked(String username, String ipAddress) {
        checkIpRateLimit(ipAddress);
        checkUsernameLockout(username);
    }

    public void recordFailedAttempt(String username, String ipAddress) {
        LoginAttempt attempt = new LoginAttempt();
        attempt.setUsername(username);
        attempt.setIpAddress(ipAddress);
        attempt.setSuccess(false);
        loginAttemptRepository.save(attempt);
        incrementIpWindow(ipAddress);
    }

    public void recordSuccessfulAttempt(String username, String ipAddress) {
        LoginAttempt attempt = new LoginAttempt();
        attempt.setUsername(username);
        attempt.setIpAddress(ipAddress);
        attempt.setSuccess(true);
        loginAttemptRepository.save(attempt);
    }

    public int getRemainingAttempts(String username, String ipAddress) {
        Instant since = Instant.now().minus(Duration.ofMinutes(config.lockoutDurationMinutes()));
        long failed = loginAttemptRepository.countFailedAttemptsByUsername(username, since);
        return (int) Math.max(0, config.maxAttempts() - failed);
    }

    private void checkUsernameLockout(String username) {
        Instant since = Instant.now().minus(Duration.ofMinutes(config.lockoutDurationMinutes()));
        long failedCount = loginAttemptRepository.countFailedAttemptsByUsername(username, since);
        if (failedCount >= config.maxAttempts()) {
            throw new AccountLockedException(
                    "Account temporarily locked. Too many failed attempts. Try again in "
                            + config.lockoutDurationMinutes() + " minutes."
            );
        }
    }

    private void checkIpRateLimit(String ipAddress) {
        long[] window = ipWindowMap.get(ipAddress);
        if (window == null) return;
        long now = System.currentTimeMillis();
        if (now - window[1] > 60_000) return;
        if (window[0] >= config.ipRateLimitPerMinute()) {
            throw new AccountLockedException("Too many requests from this IP address");
        }
    }

    private void incrementIpWindow(String ipAddress) {
        long now = System.currentTimeMillis();
        ipWindowMap.compute(ipAddress, (k, existing) -> {
            if (existing == null || now - existing[1] > 60_000) {
                return new long[]{1, now};
            }
            existing[0]++;
            return existing;
        });
    }
}
