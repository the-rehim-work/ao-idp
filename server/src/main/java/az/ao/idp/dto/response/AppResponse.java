package az.ao.idp.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AppResponse(
        UUID id,
        String name,
        String slug,
        @JsonProperty("client_id") String clientId,
        @JsonProperty("client_secret") String clientSecret,
        @JsonProperty("redirect_uris") List<String> redirectUris,
        @JsonProperty("allowed_origins") List<String> allowedOrigins,
        @JsonProperty("is_active") boolean active,
        @JsonProperty("is_public_client") boolean publicClient,
        @JsonProperty("created_at") Instant createdAt
) {}
