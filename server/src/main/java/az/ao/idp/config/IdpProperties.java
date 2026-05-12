package az.ao.idp.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ao.idp")
public record IdpProperties(
        String issuer,
        JwtProperties jwt,
        BruteForceProperties bruteForce,
        CookieProperties cookie
) {

    public record JwtProperties(
            long accessTokenExpiryMinutes,
            long refreshTokenExpiryDays,
            long adminTokenExpiryMinutes,
            String rsaKeyPath
    ) {}

    public record BruteForceProperties(
            int maxAttempts,
            int lockoutDurationMinutes,
            int ipRateLimitPerMinute
    ) {}

    public record CookieProperties(
            String domain,
            String name,
            int maxAgeSeconds
    ) {}
}
