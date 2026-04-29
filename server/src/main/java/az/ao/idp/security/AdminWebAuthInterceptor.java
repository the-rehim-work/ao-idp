package az.ao.idp.security;

import az.ao.idp.service.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Cookie;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AdminWebAuthInterceptor implements HandlerInterceptor {

    public static final String ADMIN_AUTH_COOKIE = "ao-admin-web";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String uri = request.getRequestURI();
        if (!uri.startsWith("/admin-thymeleaf") || uri.startsWith("/admin-thymeleaf/api/") || "/admin-thymeleaf/login".equals(uri)) {
            return true;
        }

        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (!ADMIN_AUTH_COOKIE.equals(cookie.getName())) continue;
                if (cookie.getValue() == null || cookie.getValue().isBlank()) break;
                try {
                    Claims claims = jwtService.validateAdminToken(cookie.getValue());
                    String adminType = claims.get("admin_type", String.class);
                    if (adminType != null && !adminType.isBlank()) {
                        return true;
                    }
                } catch (Exception ignored) {
                }
            }
        }

        response.sendRedirect("/admin/login");
        return false;
    }

    private final JwtService jwtService;

    public AdminWebAuthInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;
    }
}
