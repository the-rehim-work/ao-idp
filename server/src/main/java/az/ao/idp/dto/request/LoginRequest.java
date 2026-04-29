package az.ao.idp.dto.request;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank String username,
        @NotBlank String password,
        String clientId,
        String redirectUri,
        String state,
        String scope
) {}
