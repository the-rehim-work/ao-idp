package az.ao.idp.service;

import az.ao.idp.config.IdpProperties;
import az.ao.idp.entity.LoginAttempt;
import az.ao.idp.exception.AccountLockedException;
import az.ao.idp.repository.LoginAttemptRepository;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
public class BruteForceService {

    private static final String IP_RATE_KEY = "rate:login:ip:";

    private final LoginAttemptRepository loginAttemptRepository;
    private final RedisTemplate<String, Object> redisTemplate;
    private final IdpProperties.BruteForceProperties config;

    public BruteForceService(
            LoginAttemptRepository loginAttemptRepository,
            RedisTemplate<String, Object> redisTemplate,
            IdpProperties idpProperties
    ) {
        this.loginAttemptRepository = loginAttemptRepository;
        this.redisTemplate = redisTemplate;
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

        Long count = redisTemplate.opsForValue().increment(IP_RATE_KEY + ipAddress);
        if (count != null && count == 1) {
            redisTemplate.expire(IP_RATE_KEY + ipAddress, Duration.ofMinutes(1));
        }
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
        Object count = redisTemplate.opsForValue().get(IP_RATE_KEY + ipAddress);
        if (count instanceof Integer c && c >= config.ipRateLimitPerMinute()) {
            throw new AccountLockedException("Too many requests from this IP address");
        }
        if (count instanceof Long c && c >= config.ipRateLimitPerMinute()) {
            throw new AccountLockedException("Too many requests from this IP address");
        }
    }
}
