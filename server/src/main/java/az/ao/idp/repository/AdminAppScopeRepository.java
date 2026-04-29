package az.ao.idp.repository;

import az.ao.idp.entity.AdminAppScope;
import az.ao.idp.entity.AdminAppScopeId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AdminAppScopeRepository extends JpaRepository<AdminAppScope, AdminAppScopeId> {

    @Query("SELECT s.application.id FROM AdminAppScope s WHERE s.adminUser.id = :adminId")
    List<UUID> findApplicationIdsByAdminUserId(@Param("adminId") UUID adminId);

    void deleteById_AdminUserIdAndId_ApplicationId(UUID adminUserId, UUID applicationId);
}
