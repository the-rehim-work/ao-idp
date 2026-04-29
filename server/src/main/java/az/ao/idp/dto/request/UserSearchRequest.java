package az.ao.idp.dto.request;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record UserSearchRequest(
        String search,
        List<String> roles,
        UUID orgNodeId,
        Map<String, String> metadataFilters,
        int page,
        int size
) {}
