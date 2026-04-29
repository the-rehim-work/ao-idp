package az.ao.idp.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "applications")
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "slug", nullable = false, unique = true, length = 100)
    private String slug;

    @Column(name = "client_id", nullable = false, unique = true, length = 255)
    private String clientId;

    @Column(name = "client_secret_hash", length = 255)
    private String clientSecretHash;

    @Column(name = "is_public", nullable = false)
    private boolean publicClient = false;

    @Column(name = "redirect_uris", nullable = false, columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] redirectUris;

    @Column(name = "allowed_origins", columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] allowedOrigins;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Application() {}

    public UUID getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
    @JsonIgnore
    public String getClientSecretHash() { return clientSecretHash; }
    public void setClientSecretHash(String clientSecretHash) { this.clientSecretHash = clientSecretHash; }
    public String[] getRedirectUris() { return redirectUris; }
    public void setRedirectUris(String[] redirectUris) { this.redirectUris = redirectUris; }
    public String[] getAllowedOrigins() { return allowedOrigins; }
    public void setAllowedOrigins(String[] allowedOrigins) { this.allowedOrigins = allowedOrigins; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isPublicClient() { return publicClient; }
    public void setPublicClient(boolean publicClient) { this.publicClient = publicClient; }
    public Instant getCreatedAt() { return createdAt; }
}
