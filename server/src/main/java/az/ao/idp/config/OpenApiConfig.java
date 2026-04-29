package az.ao.idp.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("AO IDP — Identity Provider API")
                        .description("""
                                OAuth 2.0 / OpenID Connect Identity Provider for *.ao.az applications.

                                **OIDC endpoints** (`/authorize`, `/token`, `/userinfo`, `/logout`, `/token/revoke`) implement RFC 6749, RFC 7636 (PKCE), RFC 7009, and OpenID Connect Core 1.0.

                                **Admin API** (`/admin/api/v1/**`) requires an `AdminBearerAuth` token obtained from `POST /admin/api/v1/auth/login`.

                                **Directory API** (`/api/v1/apps/{clientId}/users`) uses HTTP Basic auth with `client_id:client_secret`.
                                """)
                        .version("1.0.0"))
                .components(new Components()
                        .addSecuritySchemes("BearerAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("User access token issued by /token endpoint"))
                        .addSecuritySchemes("AdminBearerAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Admin token issued by /admin/api/v1/auth/login"))
                        .addSecuritySchemes("BasicAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("basic")
                                .description("client_id:client_secret for the Directory API")));
    }
}
