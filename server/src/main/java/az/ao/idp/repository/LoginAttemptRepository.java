package az.ao.idp.repository;

import az.ao.idp.entity.LoginAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, UUID> {

    @Query("SELECT COUNT(a) FROM LoginAttempt a WHERE a.username = :username AND a.success = false AND a.attemptedAt >= :since")
    long countFailedAttemptsByUsername(@Param("username") String username, @Param("since") Instant since);

    @Query("SELECT COUNT(a) FROM LoginAttempt a WHERE a.ipAddress = :ip AND a.attemptedAt >= :since")
    long countAttemptsByIpSince(@Param("ip") String ip, @Param("since") Instant since);

    long countBySuccessTrue();

    long countBySuccessFalse();

    long countBySuccessTrueAndAttemptedAtGreaterThanEqual(Instant since);

    long countBySuccessFalseAndAttemptedAtGreaterThanEqual(Instant since);

    @Query("SELECT FUNCTION('DATE', a.attemptedAt), a.success, COUNT(a) FROM LoginAttempt a WHERE a.attemptedAt >= :since GROUP BY FUNCTION('DATE', a.attemptedAt), a.success ORDER BY FUNCTION('DATE', a.attemptedAt)")
    List<Object[]> countByDayAndSuccess(@Param("since") Instant since);
}
