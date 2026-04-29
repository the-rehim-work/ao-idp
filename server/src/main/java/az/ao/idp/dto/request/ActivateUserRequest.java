package az.ao.idp.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public record ActivateUserRequest(
        @JsonProperty("ldap_username") @NotBlank String ldapUsername
) {}
