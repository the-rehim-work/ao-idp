package az.ao.idp.repository;

import az.ao.idp.entity.RememberToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.UUID;

public interface RememberTokenRepository extends JpaRepository<RememberToken, String> {

    @Modifying
    @Query("DELETE FROM RememberToken rt WHERE rt.userId = :userId")
    void deleteByUserId(UUID userId);

    @Modifying
    @Query("DELETE FROM RememberToken rt WHERE rt.expiresAt < :now")
    void deleteExpired(Instant now);
}
