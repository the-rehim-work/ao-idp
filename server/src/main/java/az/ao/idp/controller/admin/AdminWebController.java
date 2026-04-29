package az.ao.idp.controller.admin;

import az.ao.idp.entity.Application;
import az.ao.idp.entity.User;
import az.ao.idp.exception.AuthenticationException;
import az.ao.idp.exception.InvalidTokenException;
import az.ao.idp.exception.ResourceNotFoundException;
import az.ao.idp.repository.ApplicationRepository;
import az.ao.idp.repository.AuditLogRepository;
import az.ao.idp.repository.UserAppAccessRepository;
import az.ao.idp.repository.UserRepository;
import az.ao.idp.security.AdminWebAuthInterceptor;
import az.ao.idp.service.AdminAuthService;
import az.ao.idp.service.ApplicationService;
import az.ao.idp.service.JwtService;
import az.ao.idp.service.LdapService;
import az.ao.idp.service.UserService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Cookie;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;
import java.util.UUID;

@Controller
@RequestMapping("/admin-thymeleaf")
public class AdminWebController {

    private final AdminAuthService adminAuthService;
    private final ApplicationService applicationService;
    private final UserService userService;
    private final LdapService ldapService;
    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserAppAccessRepository userAppAccessRepository;
    private final JwtService jwtService;

    public AdminWebController(
            AdminAuthService adminAuthService,
            ApplicationService applicationService,
            UserService userService,
            LdapService ldapService,
            UserRepository userRepository,
            ApplicationRepository applicationRepository,
            AuditLogRepository auditLogRepository,
            UserAppAccessRepository userAppAccessRepository,
            JwtService jwtService
    ) {
        this.adminAuthService = adminAuthService;
        this.applicationService = applicationService;
        this.userService = userService;
        this.ldapService = ldapService;
        this.userRepository = userRepository;
        this.applicationRepository = applicationRepository;
        this.auditLogRepository = auditLogRepository;
        this.userAppAccessRepository = userAppAccessRepository;
        this.jwtService = jwtService;
    }

    @GetMapping("/login")
    public String loginPage(HttpServletRequest request) {
        if (getAdminClaims(request) != null) {
            return "redirect:/admin/dashboard";
        }
        return "admin/login";
    }

    @PostMapping("/login")
    public String login(
            @RequestParam String username,
            @RequestParam String password,
            HttpServletRequest request,
            HttpServletResponse response,
            Model model
    ) {
        try {
            String ip = request.getHeader("X-Forwarded-For");
            if (ip == null || ip.isBlank()) {
                ip = request.getRemoteAddr();
            }
            var token = adminAuthService.login(username, password, ip);
            setAdminWebCookie(response, token.accessToken(), (int) token.expiresIn());
            return "redirect:/admin/dashboard";
        } catch (AuthenticationException e) {
            model.addAttribute("error", "İstifadəçi adı və ya şifrə yanlışdır");
            return "admin/login";
        }
    }

    @GetMapping("/logout")
    public String logout(HttpServletRequest request, HttpServletResponse response) {
        clearAdminWebCookie(response);
        return "redirect:/admin/login";
    }

    @GetMapping({"", "/"})
    public String adminRoot() {
        return "redirect:/admin/dashboard";
    }

    @GetMapping("/dashboard")
    public String dashboard(Model model) {
        model.addAttribute("totalUsers", userRepository.countByActiveTrue());
        model.addAttribute("totalApps", applicationRepository.countByActiveTrue());
        model.addAttribute("auditEvents", auditLogRepository.count());
        model.addAttribute("recentAudits", auditLogRepository.findAll(PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt"))).getContent());
        return "admin/dashboard";
    }

    @GetMapping("/applications")
    public String applications(Model model) {
        model.addAttribute("apps", applicationService.listAll());
        model.addAttribute("selectedAppId", null);
        model.addAttribute("selectedApp", null);
        model.addAttribute("appUsers", List.of());
        model.addAttribute("selectedAppName", null);
        return "admin/applications";
    }

    @GetMapping("/applications/{id}")
    public String applicationsById(@PathVariable UUID id, Model model) {
        Application selectedApp = applicationService.getById(id);
        Page<User> users = userService.getUsersForApp(id, null, 0, 200);
        model.addAttribute("apps", applicationService.listAll());
        model.addAttribute("selectedAppId", id);
        model.addAttribute("selectedApp", selectedApp);
        model.addAttribute("selectedAppName", selectedApp.getName());
        model.addAttribute("appUsers", users.getContent());
        return "admin/applications";
    }

    @PostMapping("/applications")
    public String createApplication(
            @RequestParam String name,
            @RequestParam String slug,
            @RequestParam("redirectUris") String redirectUris,
            @RequestParam(value = "allowedOrigins", required = false) String allowedOrigins,
            @RequestParam(value = "publicClient", defaultValue = "false") boolean publicClient,
            RedirectAttributes redirectAttributes,
            HttpServletRequest request
    ) {
        try {
            List<String> redirectUriList = splitLines(redirectUris);
            List<String> allowedOriginList = splitLines(allowedOrigins);
            var created = applicationService.create(
                    new az.ao.idp.dto.request.CreateAppRequest(name, slug, redirectUriList, allowedOriginList, publicClient),
                    getSessionAdminId(request)
            );
            redirectAttributes.addFlashAttribute("newClientId", created.clientId());
            redirectAttributes.addFlashAttribute("newClientSecret", created.clientSecret());
            redirectAttributes.addFlashAttribute("newAppName", created.name());
            redirectAttributes.addFlashAttribute("success", "Tətbiq uğurla yaradıldı");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/applications";
    }

    @PostMapping("/applications/{id}/delete")
    public String deleteApplication(
            @PathVariable UUID id,
            RedirectAttributes redirectAttributes,
            HttpServletRequest request
    ) {
        try {
            long accessCount = userAppAccessRepository.countByAppId(id);
            applicationService.delete(id, getSessionAdminId(request));
            redirectAttributes.addFlashAttribute("success", "Tətbiq silindi. " + accessCount + " istifadəçinin bu tətbiqə çıxışı ləğv edildi, istifadəçilər bloklanmadı.");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/applications";
    }

    @PostMapping("/applications/{id}/update")
    public String updateApplication(
            @PathVariable UUID id,
            @RequestParam String name,
            @RequestParam String slug,
            @RequestParam("redirectUris") String redirectUris,
            @RequestParam(value = "allowedOrigins", required = false) String allowedOrigins,
            @RequestParam(value = "publicClient", defaultValue = "false") boolean publicClient,
            RedirectAttributes redirectAttributes,
            HttpServletRequest request
    ) {
        try {
            List<String> redirectUriList = splitLines(redirectUris);
            List<String> allowedOriginList = splitLines(allowedOrigins);
            applicationService.update(
                    id,
                    new az.ao.idp.dto.request.CreateAppRequest(name, slug, redirectUriList, allowedOriginList, publicClient),
                    getSessionAdminId(request)
            );
            redirectAttributes.addFlashAttribute("success", "Tətbiq yeniləndi");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/applications/" + id;
    }

    @GetMapping("/users")
    public String users(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page,
            Model model
    ) {
        Page<User> users = userService.searchUsers(search, page, 20);
        model.addAttribute("users", users.getContent());
        model.addAttribute("allApps", applicationService.listAll());
        model.addAttribute("page", users.getNumber());
        model.addAttribute("totalPages", users.getTotalPages());
        model.addAttribute("search", search);
        return "admin/users";
    }

    @PostMapping("/users/activate")
    public String activateUser(
            @RequestParam String ldapUsername,
            RedirectAttributes redirectAttributes,
            HttpServletRequest request
    ) {
        try {
            var attrs = ldapService.getUserAttributes(ldapUsername);
            userService.activateUser(attrs.username(), attrs.email(), attrs.displayName(), getSessionAdminId(request));
            redirectAttributes.addFlashAttribute("success", "İstifadəçi aktiv edildi");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/users";
    }

    @PostMapping("/users/{id}/deactivate")
    public String deactivateUser(
            @PathVariable UUID id,
            RedirectAttributes redirectAttributes,
            HttpServletRequest request
    ) {
        try {
            userService.deactivate(id, getSessionAdminId(request));
            redirectAttributes.addFlashAttribute("success", "İstifadəçi deaktiv edildi");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/users";
    }

    @PostMapping("/users/{id}/grant-app")
    public String grantUserApp(
            @PathVariable UUID id,
            @RequestParam UUID appId,
            RedirectAttributes redirectAttributes,
            HttpServletRequest request
    ) {
        try {
            userService.grantAppAccess(id, appId, getSessionAdminId(request));
            redirectAttributes.addFlashAttribute("success", "Tətbiq çıxışı verildi");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/users";
    }

    @PostMapping("/users/{id}/revoke-app")
    public String revokeUserApp(
            @PathVariable UUID id,
            @RequestParam UUID appId,
            RedirectAttributes redirectAttributes,
            HttpServletRequest request
    ) {
        try {
            userService.revokeAppAccess(id, appId, getSessionAdminId(request));
            redirectAttributes.addFlashAttribute("success", "Tətbiq çıxışı geri alındı");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/users";
    }

    @GetMapping("/directory")
    public String directory(
            @RequestParam(required = false) String dn,
            @RequestParam(defaultValue = "") String search,
            Model model
    ) {
        model.addAttribute("dn", dn);
        model.addAttribute("search", search);
        model.addAttribute("ous", ldapService.listOus());
        model.addAttribute("ldapUsers", ldapService.listUsers(dn, search));
        model.addAttribute("allApps", applicationService.listAll());
        return "admin/directory";
    }

    @PostMapping("/directory/activate-and-grant")
    public String activateFromDirectory(
            @RequestParam String ldapUsername,
            @RequestParam UUID appId,
            RedirectAttributes redirectAttributes,
            HttpServletRequest request
    ) {
        try {
            var attrs = ldapService.getUserAttributes(ldapUsername);
            User user;
            if (userService.userExistsByLdapUsername(ldapUsername)) {
                user = userService.getByLdapUsername(ldapUsername);
            } else {
                user = userService.activateUser(attrs.username(), attrs.email(), attrs.displayName(), getSessionAdminId(request));
            }
            userService.grantAppAccess(user.getId(), appId, getSessionAdminId(request));
            redirectAttributes.addFlashAttribute("success", "LDAP istifadəçisi aktiv edildi və tətbiqə əlavə olundu");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/directory";
    }

    @GetMapping("/audit")
    public String audit(
            @RequestParam(defaultValue = "0") int page,
            Model model
    ) {
        var logs = auditLogRepository.findAll(PageRequest.of(page, 25, Sort.by(Sort.Direction.DESC, "createdAt")));
        model.addAttribute("logs", logs.getContent());
        model.addAttribute("page", logs.getNumber());
        model.addAttribute("totalPages", logs.getTotalPages());
        return "admin/audit";
    }

    @GetMapping("/admins")
    public String admins(Model model) {
        model.addAttribute("admins", adminAuthService.listAdmins());
        model.addAttribute("allApps", applicationService.listAll());
        return "admin/admins";
    }

    @PostMapping("/admins")
    public String createAdmin(
            @RequestParam String username,
            @RequestParam String password,
            @RequestParam String displayName,
            @RequestParam String adminType,
            RedirectAttributes redirectAttributes,
            HttpServletRequest request
    ) {
        try {
            adminAuthService.createAdmin(
                    new az.ao.idp.dto.request.CreateAdminRequest(username, password, displayName, adminType),
                    getSessionAdminId(request)
            );
            redirectAttributes.addFlashAttribute("success", "Admin yaradıldı");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/admins";
    }

    @PostMapping("/admins/{id}/deactivate")
    public String deactivateAdmin(
            @PathVariable UUID id,
            RedirectAttributes redirectAttributes
    ) {
        try {
            adminAuthService.deactivateAdmin(id);
            redirectAttributes.addFlashAttribute("success", "Admin deaktiv edildi");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/admins";
    }

    @PostMapping("/admins/{id}/scopes/add")
    public String addAdminScope(
            @PathVariable UUID id,
            @RequestParam UUID appId,
            RedirectAttributes redirectAttributes
    ) {
        try {
            adminAuthService.addAppScope(id, appId);
            redirectAttributes.addFlashAttribute("success", "Scope əlavə edildi");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/admins";
    }

    @PostMapping("/admins/{id}/scopes/remove")
    public String removeAdminScope(
            @PathVariable UUID id,
            @RequestParam UUID appId,
            RedirectAttributes redirectAttributes
    ) {
        try {
            adminAuthService.removeAppScope(id, appId);
            redirectAttributes.addFlashAttribute("success", "Scope silindi");
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", e.getMessage());
        }
        return "redirect:/admin/admins";
    }

    @org.springframework.web.bind.annotation.ModelAttribute
    public void addSessionInfo(HttpServletRequest request, Model model) {
        Claims claims = getAdminClaims(request);
        if (claims == null) {
            return;
        }
        String displayName = claims.get("display_name", String.class);
        if (displayName == null || displayName.isBlank()) {
            displayName = claims.get("username", String.class);
        }
        model.addAttribute("adminDisplayName", displayName);
        model.addAttribute("adminUsername", claims.get("username", String.class));
        model.addAttribute("adminType", claims.get("admin_type", String.class));
    }

    private String getSessionAdminId(HttpServletRequest request) {
        Claims claims = getAdminClaims(request);
        if (claims == null) {
            throw new ResourceNotFoundException("Admin auth not found");
        }
        return claims.getSubject();
    }

    private List<String> splitLines(String input) {
        if (input == null || input.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(input.split("[\\r\\n,]+"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }

    private Claims getAdminClaims(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;

        for (Cookie cookie : cookies) {
            if (!AdminWebAuthInterceptor.ADMIN_AUTH_COOKIE.equals(cookie.getName())) continue;
            String value = cookie.getValue();
            if (value == null || value.isBlank()) return null;
            try {
                return jwtService.validateAdminToken(value);
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private void setAdminWebCookie(HttpServletResponse response, String token, int maxAgeSeconds) {
        Cookie cookie = new Cookie(AdminWebAuthInterceptor.ADMIN_AUTH_COOKIE, token);
        cookie.setHttpOnly(false);
        cookie.setPath("/admin");
        cookie.setMaxAge(maxAgeSeconds);
        response.addCookie(cookie);
    }

    private void clearAdminWebCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie(AdminWebAuthInterceptor.ADMIN_AUTH_COOKIE, "");
        cookie.setHttpOnly(false);
        cookie.setPath("/admin");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }
}
