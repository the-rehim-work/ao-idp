package az.ao.idp.repository;

import az.ao.idp.entity.IdpSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IdpSettingRepository extends JpaRepository<IdpSetting, String> {}
