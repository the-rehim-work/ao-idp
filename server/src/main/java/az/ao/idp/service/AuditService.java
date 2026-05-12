package az.ao.idp.service;

import az.ao.idp.dto.response.AuditLogResponse;
import az.ao.idp.entity.Application;
import az.ao.idp.entity.AuditLog;
import az.ao.idp.repository.ApplicationRepository;
import az.ao.idp.repository.AuditLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final ApplicationRepository applicationRepository;

    public AuditService(AuditLogRepository auditLogRepository, ApplicationRepository applicationRepository) {
        this.auditLogRepository = auditLogRepository;
        this.applicationRepository = applicationRepository;
    }

    @Async
    public void log(
            String actorType,
            String actorId,
            String action,
            String targetType,
            String targetId,
            Application application,
            String ipAddress,
            String userAgent,
            Map<String, Object> details
    ) {
        AuditLog entry = new AuditLog();
        entry.setActorType(actorType);
        entry.setActorId(actorId);
        entry.setAction(action);
        entry.setTargetType(targetType);
        entry.setTargetId(targetId);
        entry.setIpAddress(ipAddress);
        entry.setUserAgent(userAgent);
        entry.setDetails(details);

        // Verify the application still exists before creating the FK reference (async race condition)
        if (application != null && applicationRepository.existsById(application.getId())) {
            entry.setApplication(application);
        }

        auditLogRepository.save(entry);
    }

    public List<String> getDistinctActions() {
        return auditLogRepository.findDistinctActions();
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> search(
            String action, String actorId, UUID appId,
            Instant from, Instant to, int page, int size
    ) {
        Specification<AuditLog> spec = Specification.where(null);

        if (action != null && !action.isBlank()) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("action"), action));
        }
        if (actorId != null && !actorId.isBlank()) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("actorId"), actorId));
        }
        if (appId != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("application").get("id"), appId));
        }
        if (from != null) {
            spec = spec.and((root, q, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), from));
        }
        if (to != null) {
            spec = spec.and((root, q, cb) -> cb.lessThanOrEqualTo(root.get("createdAt"), to));
        }

        return auditLogRepository.findAll(spec,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(AuditLogResponse::from);
    }
}
