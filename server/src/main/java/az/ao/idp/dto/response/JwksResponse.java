package az.ao.idp.dto.response;

import java.util.List;

public record JwksResponse(List<JwkKey> keys) {

    public record JwkKey(
            String kty,
            String use,
            String alg,
            String kid,
            String n,
            String e
    ) {}
}
