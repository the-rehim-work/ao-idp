package az.ao.idp.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "admin_app_scopes")
public class AdminAppScope {

    @EmbeddedId
    private AdminAppScopeId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("adminUserId")
    @JoinColumn(name = "admin_user_id")
    private AdminUser adminUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("applicationId")
    @JoinColumn(name = "application_id")
    private Application application;

    public AdminAppScope() {}

    public AdminAppScope(AdminUser adminUser, Application application) {
        this.adminUser = adminUser;
        this.application = application;
        this.id = new AdminAppScopeId(adminUser.getId(), application.getId());
    }

    public AdminAppScopeId getId() { return id; }
    public AdminUser getAdminUser() { return adminUser; }
    public Application getApplication() { return application; }
}
