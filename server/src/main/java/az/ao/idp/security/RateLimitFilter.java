package az.ao.idp.security;

import az.ao.idp.config.IdpProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String RATE_KEY = "rate:global:ip:";

    private final RedisTemplate<String, Object> redisTemplate;
    private final int limit;

    public RateLimitFilter(RedisTemplate<String, Object> redisTemplate, IdpProperties idpProperties) {
        this.redisTemplate = redisTemplate;
        this.limit = idpProperties.bruteForce().ipRateLimitPerMinute() * 3;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!path.equals("/login") && !path.equals("/token")) {
            filterChain.doFilter(request, response);
            return;
        }

        String ip = getClientIp(request);
        String key = RATE_KEY + ip;

        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1) {
            redisTemplate.expire(key, Duration.ofMinutes(1));
        }
        if (count != null && count > limit) {
            response.setStatus(429);
            response.addHeader("Retry-After", "60");
            response.getWriter().write("{\"error\":\"rate_limited\",\"error_description\":\"Too many requests\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
