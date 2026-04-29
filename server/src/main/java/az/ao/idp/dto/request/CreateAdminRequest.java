package az.ao.idp.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateAdminRequest(
        @NotBlank @Size(max = 100) String username,
        @NotBlank @Size(min = 8) String password,
        @NotBlank String displayName,
        @NotBlank @Pattern(regexp = "idp_admin|app_admin") String adminType
) {}
