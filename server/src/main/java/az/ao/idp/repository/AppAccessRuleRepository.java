package az.ao.idp.repository;

import az.ao.idp.entity.AppAccessRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AppAccessRuleRepository extends JpaRepository<AppAccessRule, UUID> {
    List<AppAccessRule> findAllByAppId(UUID appId);
    void deleteByAppId(UUID appId);
}
