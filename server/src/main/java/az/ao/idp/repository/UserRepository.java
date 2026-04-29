package az.ao.idp.repository;

import az.ao.idp.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByLdapUsername(String ldapUsername);

    boolean existsByLdapUsername(String ldapUsername);

    long countByActiveTrue();

    long countByActiveTrueAndLastLoginAtGreaterThanEqual(Instant since);

    Page<User> findAllByActiveTrue(Pageable pageable);

    @Query("SELECT u FROM User u WHERE u.active = true AND " +
           "(LOWER(u.ldapUsername) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(u.displayName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<User> searchActiveUsers(@Param("search") String search, Pageable pageable);

    @Query("SELECT u FROM User u, UserAppAccess a " +
           "WHERE a.userId = u.id AND a.appId = :appId AND u.active = true")
    Page<User> findActiveUsersByAppId(@Param("appId") UUID appId, Pageable pageable);

    @Query("SELECT u FROM User u, UserAppAccess a " +
           "WHERE a.userId = u.id AND a.appId = :appId AND u.active = true AND " +
           "(LOWER(u.ldapUsername) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(u.displayName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<User> searchActiveUsersByAppId(@Param("appId") UUID appId, @Param("search") String search, Pageable pageable);
}
