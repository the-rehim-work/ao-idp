package az.ao.idp.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_access_rules")
public class AppAccessRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "app_id", nullable = false)
    private UUID appId;

    @Column(name = "rule_type", nullable = false, length = 20)
    private String ruleType;

    @Column(name = "value", nullable = false, length = 500)
    private String value;

    @Column(name = "ldap_server_id")
    private UUID ldapServerId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public AppAccessRule() {}

    public AppAccessRule(UUID appId, String ruleType, String value, UUID ldapServerId) {
        this.appId = appId;
        this.ruleType = ruleType;
        this.value = value;
        this.ldapServerId = ldapServerId;
    }

    public UUID getId() { return id; }
    public UUID getAppId() { return appId; }
    public void setAppId(UUID appId) { this.appId = appId; }
    public String getRuleType() { return ruleType; }
    public void setRuleType(String ruleType) { this.ruleType = ruleType; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public UUID getLdapServerId() { return ldapServerId; }
    public void setLdapServerId(UUID ldapServerId) { this.ldapServerId = ldapServerId; }
    public Instant getCreatedAt() { return createdAt; }
}
