package az.ao.idp.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record UpdateAdminRequest(
        @NotBlank String displayName,
        @NotBlank String adminType,
        List<String> permissions
) {}
