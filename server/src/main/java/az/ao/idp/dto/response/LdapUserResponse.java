package az.ao.idp.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record LdapUserResponse(
        @JsonProperty("ldap_username") String ldapUsername,
        String email,
        @JsonProperty("display_name") String displayName,
        @JsonProperty("is_activated") boolean activated,
        String title,
        String ou,
        List<String> groups
) {}
