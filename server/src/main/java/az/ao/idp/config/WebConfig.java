package az.ao.idp.config;

import az.ao.idp.security.AdminScopeInterceptor;
import az.ao.idp.security.AdminWebAuthInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AdminScopeInterceptor adminScopeInterceptor;
    private final AdminWebAuthInterceptor adminWebAuthInterceptor;

    public WebConfig(
            AdminScopeInterceptor adminScopeInterceptor,
            AdminWebAuthInterceptor adminWebAuthInterceptor
    ) {
        this.adminScopeInterceptor = adminScopeInterceptor;
        this.adminWebAuthInterceptor = adminWebAuthInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(adminScopeInterceptor)
                .addPathPatterns("/admin/api/v1/apps/**", "/admin/api/v1/users/**");

        registry.addInterceptor(adminWebAuthInterceptor)
                .addPathPatterns("/admin-thymeleaf/**")
                .excludePathPatterns("/admin-thymeleaf/login", "/admin/api/**");
    }
}
