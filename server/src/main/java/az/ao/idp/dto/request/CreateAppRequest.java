package az.ao.idp.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import java.util.List;

public record CreateAppRequest(
        @NotBlank String name,
        @NotBlank @Pattern(regexp = "^[a-z0-9-]+$", message = "Slug must be lowercase alphanumeric with hyphens") String slug,
        @JsonProperty("redirect_uris") @NotEmpty List<String> redirectUris,
        @JsonProperty("allowed_origins") List<String> allowedOrigins,
        @JsonProperty("is_public_client") boolean publicClient
) {}
