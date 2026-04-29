package az.ao.idp.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
        String error,
        @JsonProperty("error_description") String errorDescription,
        Instant timestamp,
        List<String> details
) {
    public ErrorResponse(String error, String errorDescription) {
        this(error, errorDescription, Instant.now(), null);
    }
}
