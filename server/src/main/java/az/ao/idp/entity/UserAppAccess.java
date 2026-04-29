package az.ao.idp.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_app_access")
public class UserAppAccess {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "app_id", nullable = false)
    private UUID appId;

    @Column(name = "granted_at", nullable = false)
    private Instant grantedAt = Instant.now();

    public UserAppAccess() {}

    public UserAppAccess(UUID userId, UUID appId) {
        this.userId = userId;
        this.appId = appId;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public UUID getAppId() { return appId; }
    public Instant getGrantedAt() { return grantedAt; }
}
