package az.ao.idp.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

public record UserInfoResponse(
        String sub,
        @JsonProperty("ldap_username") String ldapUsername,
        String email,
        @JsonProperty("display_name") String displayName
) {}
