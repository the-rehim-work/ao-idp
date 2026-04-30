package az.ao.idp.security;

import az.ao.idp.config.IdpProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final int limit;
    private final ConcurrentHashMap<String, long[]> ipWindowMap = new ConcurrentHashMap<>();

    public RateLimitFilter(IdpProperties idpProperties) {
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
        long now = System.currentTimeMillis();

        long[] window = ipWindowMap.compute(ip, (k, existing) -> {
            if (existing == null || now - existing[1] > 60_000) {
                return new long[]{1, now};
            }
            existing[0]++;
            return existing;
        });

        if (window[0] > limit) {
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
