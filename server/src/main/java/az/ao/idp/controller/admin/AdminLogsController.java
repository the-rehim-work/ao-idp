package az.ao.idp.controller.admin;

import az.ao.idp.dto.response.AuditLogResponse;
import az.ao.idp.dto.response.PageResponse;
import az.ao.idp.entity.AuditLog;
import az.ao.idp.repository.AuditLogRepository;
import az.ao.idp.service.AppLogBuffer;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/api/v1/logs")
@Tag(name = "Admin — Logs", description = "Application log stream and audit log search")
@SecurityRequirement(name = "AdminBearerAuth")
public class AdminLogsController {

    private final AppLogBuffer appLogBuffer;
    private final AuditLogRepository auditLogRepository;

    public AdminLogsController(AppLogBuffer appLogBuffer, AuditLogRepository auditLogRepository) {
        this.appLogBuffer = appLogBuffer;
        this.auditLogRepository = auditLogRepository;
    }

    @GetMapping("/app")
    public ResponseEntity<List<AppLogBuffer.LogEntry>> appLogs(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String level,
            @RequestParam(defaultValue = "200") int limit
    ) {
        int safeLimit = Math.min(Math.max(limit, 1), 2000);
        return ResponseEntity.ok(appLogBuffer.getEntries(search, level, safeLimit));
    }

    @GetMapping("/audit")
    public ResponseEntity<PageResponse<AuditLogResponse>> auditLogs(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String actorType,
            @RequestParam(required = false) Integer days,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        Specification<AuditLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("actorId")), pattern),
                        cb.like(cb.lower(root.get("action")), pattern),
                        cb.like(cb.lower(root.get("targetId")), pattern)
                ));
            }
            if (action != null && !action.isBlank()) {
                predicates.add(cb.equal(root.get("action"), action));
            }
            if (actorType != null && !actorType.isBlank()) {
                predicates.add(cb.equal(root.get("actorType"), actorType));
            }
            if (days != null && days > 0) {
                predicates.add(cb.greaterThan(root.get("createdAt"), Instant.now().minus(days, ChronoUnit.DAYS)));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<AuditLog> result = auditLogRepository.findAll(spec,
                PageRequest.of(page, Math.min(size, 100), Sort.by("createdAt").descending()));

        List<AuditLogResponse> content = result.getContent().stream()
                .map(AuditLogResponse::from)
                .toList();

        return ResponseEntity.ok(new PageResponse<>(
                content, page, size, result.getTotalElements(), result.getTotalPages(), result.isLast()
        ));
    }

    @GetMapping("/audit/actions")
    public ResponseEntity<List<String>> auditActions() {
        return ResponseEntity.ok(auditLogRepository.findDistinctActions());
    }
}
