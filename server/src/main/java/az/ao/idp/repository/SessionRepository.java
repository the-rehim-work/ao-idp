package az.ao.idp.repository;

import az.ao.idp.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, String> {
    Optional<Session> findByIdAndExpiresAtAfter(String id, Instant now);

    long countByExpiresAtAfter(Instant now);

    @Modifying
    @Query("DELETE FROM Session s WHERE s.expiresAt < :now")
    void deleteExpired(Instant now);

    @Modifying
    @Query("DELETE FROM Session s WHERE s.userId = :userId")
    void deleteByUserId(UUID userId);
}
