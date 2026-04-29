package az.ao.idp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Embeddable
public class AdminAppScopeId implements Serializable {

    @Column(name = "admin_user_id")
    private UUID adminUserId;

    @Column(name = "application_id")
    private UUID applicationId;

    public AdminAppScopeId() {}

    public AdminAppScopeId(UUID adminUserId, UUID applicationId) {
        this.adminUserId = adminUserId;
        this.applicationId = applicationId;
    }

    public UUID getAdminUserId() { return adminUserId; }
    public UUID getApplicationId() { return applicationId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof AdminAppScopeId that)) return false;
        return Objects.equals(adminUserId, that.adminUserId) && Objects.equals(applicationId, that.applicationId);
    }

    @Override
    public int hashCode() { return Objects.hash(adminUserId, applicationId); }
}
