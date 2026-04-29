package az.ao.idp.controller.admin;

import az.ao.idp.dto.request.CreateAppRequest;
import az.ao.idp.dto.response.AppResponse;
import az.ao.idp.entity.Application;
import az.ao.idp.service.ApplicationService;
import io.jsonwebtoken.Claims;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/api/v1/applications")
@Tag(name = "Admin — Applications", description = "CRUD for registered OAuth2 client applications")
@SecurityRequirement(name = "AdminBearerAuth")
public class AdminAppController {

    private final ApplicationService applicationService;

    public AdminAppController(ApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @GetMapping
    public ResponseEntity<List<AppResponse>> list() {
        List<AppResponse> apps = applicationService.listAll().stream()
                .map(applicationService::toResponse)
                .toList();
        return ResponseEntity.ok(apps);
    }

    @PostMapping
    public ResponseEntity<AppResponse> create(@Valid @RequestBody CreateAppRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(applicationService.create(request, getAdminId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AppResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(applicationService.toResponse(applicationService.getById(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AppResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody CreateAppRequest request
    ) {
        Application updated = applicationService.update(id, request, getAdminId());
        return ResponseEntity.ok(applicationService.toResponse(updated));
    }

    @PatchMapping("/{id}/deactivate")
    @Operation(summary = "Deactivate application", description = "Marks the application as inactive. Users can no longer authenticate with it. Access records are preserved.")
    public ResponseEntity<AppResponse> deactivate(@PathVariable UUID id) {
        Application app = applicationService.deactivate(id, getAdminId());
        return ResponseEntity.ok(applicationService.toResponse(app));
    }

    @PatchMapping("/{id}/activate")
    @Operation(summary = "Activate application", description = "Restores an inactive application. Existing user access records are preserved.")
    public ResponseEntity<AppResponse> activate(@PathVariable UUID id) {
        Application app = applicationService.activate(id, getAdminId());
        return ResponseEntity.ok(applicationService.toResponse(app));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Permanently delete application", description = "Irreversibly deletes the application and revokes all user access records.")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        applicationService.delete(id, getAdminId());
        return ResponseEntity.noContent().build();
    }

    private String getAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "unknown";
    }
}
