package az.ao.idp.dto.request;

public record TokenRequest(
        String grantType,
        String code,
        String redirectUri,
        String clientId,
        String clientSecret,
        String refreshToken
) {}
