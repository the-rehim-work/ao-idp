package az.ao.idp.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record LdapTreeNode(
        String dn,
        String rdn,
        String type,
        String name,
        @JsonProperty("ldap_username") String ldapUsername,
        String email,
        String title,
        @JsonProperty("has_children") boolean hasChildren,
        @JsonProperty("is_activated") boolean activated,
        List<String> groups,
        List<LdapTreeNode> children
) {
    public static LdapTreeNode ou(String dn, String rdn, String name, boolean hasChildren) {
        return new LdapTreeNode(dn, rdn, "ou", name, null, null, null, hasChildren, false, null, null);
    }

    public static LdapTreeNode user(String dn, String rdn, String name, String username,
                                    String email, String title, boolean activated, List<String> groups) {
        return new LdapTreeNode(dn, rdn, "user", name, username, email, title, false, activated, groups, null);
    }

    public static LdapTreeNode group(String dn, String rdn, String name, boolean hasChildren) {
        return new LdapTreeNode(dn, rdn, "group", name, null, null, null, hasChildren, false, null, null);
    }

    public static LdapTreeNode other(String dn, String rdn, String name) {
        return new LdapTreeNode(dn, rdn, "other", name, null, null, null, false, false, null, null);
    }
}
