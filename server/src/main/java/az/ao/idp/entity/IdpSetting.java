package az.ao.idp.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "idp_settings")
public class IdpSetting {

    @Id
    @Column(name = "key")
    private String key;

    @Column(name = "value", nullable = false, columnDefinition = "TEXT")
    private String value;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public IdpSetting() {}

    public IdpSetting(String key, String value) {
        this.key = key;
        this.value = value;
    }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; this.updatedAt = Instant.now(); }
    public Instant getUpdatedAt() { return updatedAt; }
}
