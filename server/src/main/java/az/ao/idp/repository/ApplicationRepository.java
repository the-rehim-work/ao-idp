package az.ao.idp.repository;

import az.ao.idp.entity.Application;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ApplicationRepository extends JpaRepository<Application, UUID> {

    Optional<Application> findByClientId(String clientId);

    Optional<Application> findBySlug(String slug);

    boolean existsBySlug(String slug);

    boolean existsByClientId(String clientId);

    long countByActiveTrue();

    java.util.List<Application> findAllByActiveTrueOrderByCreatedAtDesc();

    java.util.List<Application> findAllByOrderByCreatedAtDesc();
}
