package az.ao.idp.repository;

import az.ao.idp.entity.LdapServerConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LdapServerConfigRepository extends JpaRepository<LdapServerConfig, UUID> {

    List<LdapServerConfig> findAllByActiveTrueOrderByPriorityDesc();

    Optional<LdapServerConfig> findByActiveTrue();
}
