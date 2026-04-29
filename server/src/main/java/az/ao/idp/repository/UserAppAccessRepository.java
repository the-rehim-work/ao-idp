package az.ao.idp.repository;

import az.ao.idp.entity.UserAppAccess;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface UserAppAccessRepository extends JpaRepository<UserAppAccess, UUID> {
    boolean existsByUserIdAndAppId(UUID userId, UUID appId);
    List<UserAppAccess> findAllByUserId(UUID userId);
    List<UserAppAccess> findAllByAppId(UUID appId);
    long countByAppId(UUID appId);
    void deleteByAppId(UUID appId);
    void deleteByUserIdAndAppId(UUID userId, UUID appId);
}
