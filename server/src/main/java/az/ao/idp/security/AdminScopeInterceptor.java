package az.ao.idp.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class AdminScopeInterceptor implements HandlerInterceptor {

    private static final Pattern APP_ID_PATTERN = Pattern.compile("/apps/([0-9a-f-]{36})");

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Not authenticated");
            return false;
        }

        Claims claims = (Claims) auth.getDetails();
        if (claims == null) return true;

        String adminType = claims.get("admin_type", String.class);
        if ("idp_admin".equals(adminType)) return true;

        String path = request.getRequestURI();
        Matcher matcher = APP_ID_PATTERN.matcher(path);
        if (!matcher.find()) return true;

        String appId = matcher.group(1);
        List<String> scopedAppIds = claims.get("scoped_app_ids", List.class);
        if (scopedAppIds == null || !scopedAppIds.contains(appId)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Not authorized for this application");
            return false;
        }
        return true;
    }
}
