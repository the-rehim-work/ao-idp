package az.ao.idp.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.UUID;

public record UserDirectoryResponse(
        UUID id,
        @JsonProperty("ldap_username") String ldapUsername,
        String email,
        @JsonProperty("display_name") String displayName
) {}
