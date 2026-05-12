package az.ao.idp.service;

import az.ao.idp.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class LogRetentionScheduler {

    private static final Logger log = LoggerFactory.getLogger(LogRetentionScheduler.class);

    private final AuditLogRepository auditLogRepository;
    private final IdpSettingsService settingsService;

    public LogRetentionScheduler(AuditLogRepository auditLogRepository, IdpSettingsService settingsService) {
        this.auditLogRepository = auditLogRepository;
        this.settingsService = settingsService;
    }

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void purgeOldLogs() {
        int retentionDays = settingsService.getLogRetentionDays();
        Instant cutoff = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        int deleted = auditLogRepository.deleteByCreatedAtBefore(cutoff);
        if (deleted > 0) {
            log.info("Purged {} audit log entries older than {} days", deleted, retentionDays);
        }
    }
}
