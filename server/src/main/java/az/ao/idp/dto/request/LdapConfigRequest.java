package az.ao.idp.dto.request;

import jakarta.validation.constraints.NotBlank;

public record LdapConfigRequest(
        @NotBlank String name,
        @NotBlank String url,
        @NotBlank String baseDn,
        @NotBlank String serviceAccountDn,
        String serviceAccountPassword,
        @NotBlank String userObjectClass,
        String usernameAttribute,
        String additionalUserFilter,
        String claimMappings,
        Integer priority
) {}
