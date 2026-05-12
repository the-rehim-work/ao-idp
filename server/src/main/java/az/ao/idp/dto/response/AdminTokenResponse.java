package az.ao.idp.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record AdminTokenResponse(
        @JsonProperty("access_token") String accessToken,
        @JsonProperty("admin_type") String adminType,
        @JsonProperty("display_name") String displayName,
        @JsonProperty("expires_in") long expiresIn,
        @JsonProperty("permissions") List<String> permissions
) {}
