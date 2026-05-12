package az.ao.idp.dto.response;

import az.ao.idp.entity.AuditLog;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record AuditLogResponse(
        UUID id,
        @JsonProperty("actor_type") String actorType,
        @JsonProperty("actor_id") String actorId,
        String action,
        @JsonProperty("target_type") String targetType,
        @JsonProperty("target_id") String targetId,
        @JsonProperty("application_id") UUID applicationId,
        @JsonProperty("ip_address") String ipAddress,
        @JsonProperty("user_agent") String userAgent,
        Map<String, Object> details,
        @JsonProperty("created_at") Instant createdAt
) {
    public static AuditLogResponse from(AuditLog a) {
        return new AuditLogResponse(
                a.getId(), a.getActorType(), a.getActorId(), a.getAction(),
                a.getTargetType(), a.getTargetId(),
                a.getApplication() != null ? a.getApplication().getId() : null,
                a.getIpAddress(), a.getUserAgent(), a.getDetails(), a.getCreatedAt()
        );
    }
}
