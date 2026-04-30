package az.ao.idp.dto.request;

import jakarta.validation.constraints.NotBlank;

public record LdapConfigRequest(
        @NotBlank String name,
        @NotBlank String url,
        @NotBlank String baseDn,
        @NotBlank String serviceAccountDn,
        String serviceAccountPassword,
        @NotBlank String usernameAttribute,
        @NotBlank String userObjectClass,
        String additionalUserFilter,
        String claimMappings,
        Integer priority
) {}
