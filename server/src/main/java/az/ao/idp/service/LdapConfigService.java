package az.ao.idp.service;

import az.ao.idp.dto.request.LdapConfigRequest;
import az.ao.idp.entity.LdapServerConfig;
import az.ao.idp.exception.ResourceNotFoundException;
import az.ao.idp.repository.LdapServerConfigRepository;
import org.springframework.ldap.core.ContextMapper;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.support.LdapContextSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class LdapConfigService {

    private final LdapServerConfigRepository repository;

    public LdapConfigService(LdapServerConfigRepository repository) {
        this.repository = repository;
    }

    public List<LdapServerConfig> list() {
        return repository.findAll();
    }

    public LdapServerConfig get(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("LDAP config not found: " + id));
    }

    public List<LdapServerConfig> getActiveAll() {
        return repository.findAllByActiveTrueOrderByPriorityDesc();
    }

    public Optional<LdapServerConfig> getActive() {
        List<LdapServerConfig> all = getActiveAll();
        return all.isEmpty() ? Optional.empty() : Optional.of(all.get(0));
    }

    public boolean isConfigured() {
        return !getActiveAll().isEmpty();
    }

    @Transactional
    public void saveClaimMappings(UUID id, String claimMappingsJson) {
        LdapServerConfig config = get(id);
        config.setClaimMappings(claimMappingsJson);
        config.setUpdatedAt(Instant.now());
        repository.save(config);
    }

    @Transactional
    public LdapServerConfig create(LdapConfigRequest request) {
        return repository.save(fromRequest(new LdapServerConfig(), request));
    }

    @Transactional
    public LdapServerConfig update(UUID id, LdapConfigRequest request) {
        LdapServerConfig config = get(id);
        fromRequest(config, request);
        config.setUpdatedAt(Instant.now());
        return repository.save(config);
    }

    @Transactional
    public void delete(UUID id) {
        get(id);
        repository.deleteById(id);
    }

    @Transactional
    public LdapServerConfig setActive(UUID id) {
        LdapServerConfig config = get(id);
        config.setActive(true);
        config.setUpdatedAt(Instant.now());
        return repository.save(config);
    }

    @Transactional
    public LdapServerConfig setInactive(UUID id) {
        LdapServerConfig config = get(id);
        config.setActive(false);
        config.setUpdatedAt(Instant.now());
        return repository.save(config);
    }

    @Transactional
    public LdapServerConfig setPriority(UUID id, int priority) {
        LdapServerConfig config = get(id);
        config.setPriority(priority);
        config.setUpdatedAt(Instant.now());
        return repository.save(config);
    }

    public Map<String, Object> testConnectionById(UUID id) {
        LdapServerConfig config = get(id);
        LdapConfigRequest req = new LdapConfigRequest(
                config.getName(), config.getUrl(), config.getBaseDn(),
                config.getServiceAccountDn(), config.getServiceAccountPassword(),
                config.getUsernameAttribute(), config.getUserObjectClass(),
                config.getAdditionalUserFilter(), config.getClaimMappings(), config.getPriority()
        );
        return testConnection(req);
    }

    public Map<String, Object> testConnection(LdapConfigRequest request) {
        try {
            LdapContextSource source = buildContextSource(
                    request.url(), request.baseDn(),
                    request.serviceAccountDn(), request.serviceAccountPassword()
            );
            source.getContext(request.serviceAccountDn(), request.serviceAccountPassword()).close();
            LdapTemplate template = new LdapTemplate(source);
            template.search("", "(objectClass=*)", (ContextMapper<Void>) ctx -> null).stream().limit(1).count();
            return Map.of("success", true, "message", "Connection successful");
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage() != null ? e.getMessage() : "Connection refused");
        }
    }

    public static LdapContextSource buildContextSource(String url, String baseDn, String userDn, String password) {
        LdapContextSource source = new LdapContextSource();
        source.setUrl(url);
        source.setBase(baseDn);
        source.setUserDn(userDn);
        source.setPassword(password != null ? password : "");
        source.setPooled(false);
        source.afterPropertiesSet();
        return source;
    }

    private LdapServerConfig fromRequest(LdapServerConfig config, LdapConfigRequest request) {
        config.setName(request.name());
        config.setUrl(request.url());
        config.setBaseDn(request.baseDn());
        config.setServiceAccountDn(request.serviceAccountDn());
        if (request.serviceAccountPassword() != null && !request.serviceAccountPassword().isBlank()) {
            config.setServiceAccountPassword(request.serviceAccountPassword());
        }
        config.setUsernameAttribute(request.usernameAttribute());
        config.setUserObjectClass(request.userObjectClass());
        config.setAdditionalUserFilter(request.additionalUserFilter());
        if (request.claimMappings() != null) {
            config.setClaimMappings(request.claimMappings());
        }
        if (request.priority() != null) {
            config.setPriority(request.priority());
        }
        return config;
    }
}
