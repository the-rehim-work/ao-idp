package az.ao.idp.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdateAdminRequest(
        @NotBlank String displayName,
        @NotBlank String adminType
) {}
