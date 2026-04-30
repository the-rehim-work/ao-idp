package az.ao.idp.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ldap_server_config")
public class LdapServerConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String url;

    @Column(name = "base_dn", nullable = false)
    private String baseDn;

    @Column(name = "service_account_dn", nullable = false)
    private String serviceAccountDn;

    @Column(name = "service_account_password", nullable = false)
    private String serviceAccountPassword;

    @Column(name = "username_attribute", nullable = false)
    private String usernameAttribute = "sAMAccountName";

    @Column(name = "user_object_class", nullable = false)
    private String userObjectClass = "user";

    @Column(name = "additional_user_filter")
    private String additionalUserFilter;

    @Column(name = "claim_mappings", columnDefinition = "TEXT")
    private String claimMappings;

    @Column(name = "priority", nullable = false)
    private int priority = 0;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public LdapServerConfig() {}

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getBaseDn() { return baseDn; }
    public void setBaseDn(String baseDn) { this.baseDn = baseDn; }
    public String getServiceAccountDn() { return serviceAccountDn; }
    public void setServiceAccountDn(String serviceAccountDn) { this.serviceAccountDn = serviceAccountDn; }
    public String getServiceAccountPassword() { return serviceAccountPassword; }
    public void setServiceAccountPassword(String serviceAccountPassword) { this.serviceAccountPassword = serviceAccountPassword; }
    public String getUsernameAttribute() { return usernameAttribute; }
    public void setUsernameAttribute(String usernameAttribute) { this.usernameAttribute = usernameAttribute; }
    public String getUserObjectClass() { return userObjectClass; }
    public void setUserObjectClass(String userObjectClass) { this.userObjectClass = userObjectClass; }
    public String getAdditionalUserFilter() { return additionalUserFilter; }
    public void setAdditionalUserFilter(String additionalUserFilter) { this.additionalUserFilter = additionalUserFilter; }
    public String getClaimMappings() { return claimMappings; }
    public void setClaimMappings(String claimMappings) { this.claimMappings = claimMappings; }
    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
