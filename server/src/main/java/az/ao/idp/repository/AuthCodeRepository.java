package az.ao.idp.repository;

import az.ao.idp.entity.AuthCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;

public interface AuthCodeRepository extends JpaRepository<AuthCode, String> {
    Optional<AuthCode> findByCodeAndExpiresAtAfter(String code, Instant now);

    @Modifying
    @Query("DELETE FROM AuthCode a WHERE a.expiresAt < :now")
    void deleteExpired(Instant now);
}
