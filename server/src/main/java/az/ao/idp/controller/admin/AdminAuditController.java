package az.ao.idp.controller.admin;

import az.ao.idp.dto.response.AuditLogResponse;
import az.ao.idp.dto.response.PageResponse;
import az.ao.idp.service.AuditService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/api/v1/audit-logs")
@Tag(name = "Admin — Audit Logs", description = "Searchable audit log of all admin and auth events")
@SecurityRequirement(name = "AdminBearerAuth")
public class AdminAuditController {

    private final AuditService auditService;

    public AdminAuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping("/event-types")
    public ResponseEntity<List<String>> getEventTypes() {
        return ResponseEntity.ok(auditService.getDistinctActions());
    }

    @GetMapping
    public ResponseEntity<PageResponse<AuditLogResponse>> search(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String actorId,
            @RequestParam(required = false) UUID appId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        Page<AuditLogResponse> logs = auditService.search(action, actorId, appId, from, to, page, size);
        return ResponseEntity.ok(new PageResponse<>(
                logs.getContent(), page, size, logs.getTotalElements(), logs.getTotalPages(), logs.isLast()
        ));
    }
}
