package az.ao.idp.controller.admin;

import az.ao.idp.repository.*;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/admin/api/v1/stats")
@Tag(name = "Admin — Stats", description = "Dashboard metrics: user counts, login activity, active sessions")
@SecurityRequirement(name = "AdminBearerAuth")
public class AdminStatsController {

    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final AuditLogRepository auditLogRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final SessionRepository sessionRepository;

    public AdminStatsController(
            UserRepository userRepository,
            ApplicationRepository applicationRepository,
            AuditLogRepository auditLogRepository,
            LoginAttemptRepository loginAttemptRepository,
            SessionRepository sessionRepository
    ) {
        this.userRepository = userRepository;
        this.applicationRepository = applicationRepository;
        this.auditLogRepository = auditLogRepository;
        this.loginAttemptRepository = loginAttemptRepository;
        this.sessionRepository = sessionRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getStats() {
        Instant now = Instant.now();
        Instant today = now.truncatedTo(ChronoUnit.DAYS);
        Instant week = now.minus(7, ChronoUnit.DAYS);
        Instant month = now.minus(30, ChronoUnit.DAYS);

        Map<String, Object> stats = new LinkedHashMap<>();

        stats.put("total_users", userRepository.countByActiveTrue());
        stats.put("total_apps", applicationRepository.countByActiveTrue());

        stats.put("logins_today", loginAttemptRepository.countBySuccessTrueAndAttemptedAtGreaterThanEqual(today));
        stats.put("logins_week", loginAttemptRepository.countBySuccessTrueAndAttemptedAtGreaterThanEqual(week));
        stats.put("failed_today", loginAttemptRepository.countBySuccessFalseAndAttemptedAtGreaterThanEqual(today));
        stats.put("failed_week", loginAttemptRepository.countBySuccessFalseAndAttemptedAtGreaterThanEqual(week));
        stats.put("total_logins", loginAttemptRepository.countBySuccessTrue());
        stats.put("total_failed", loginAttemptRepository.countBySuccessFalse());

        stats.put("users_active_today", userRepository.countByActiveTrueAndLastLoginAtGreaterThanEqual(today));
        stats.put("users_active_week", userRepository.countByActiveTrueAndLastLoginAtGreaterThanEqual(week));

        stats.put("events_today", auditLogRepository.countByCreatedAtGreaterThanEqual(today));
        stats.put("events_month", auditLogRepository.countByCreatedAtGreaterThanEqual(month));

        stats.put("active_sessions", sessionRepository.countByExpiresAtAfter(now));

        List<Object[]> eventBreakdown = auditLogRepository.countByActionSince(week);
        List<Map<String, Object>> breakdown = new ArrayList<>();
        for (Object[] row : eventBreakdown) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("action", row[0]);
            entry.put("count", row[1]);
            breakdown.add(entry);
        }
        stats.put("event_breakdown", breakdown);

        List<Object[]> loginChart = loginAttemptRepository.countByDayAndSuccess(week);
        List<Map<String, Object>> chart = new ArrayList<>();
        for (Object[] row : loginChart) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("date", row[0] != null ? row[0].toString() : "");
            entry.put("success", row[1]);
            entry.put("count", row[2]);
            chart.add(entry);
        }
        stats.put("login_chart", chart);

        return ResponseEntity.ok(stats);
    }
}
