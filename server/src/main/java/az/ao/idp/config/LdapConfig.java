package az.ao.idp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.support.LdapContextSource;

@Configuration
public class LdapConfig {

    private final IdpProperties.LdapProperties ldapProps;

    public LdapConfig(IdpProperties idpProperties) {
        this.ldapProps = idpProperties.ldap();
    }

    @Bean
    public LdapContextSource ldapContextSource() {
        LdapContextSource ctx = new LdapContextSource();
        ctx.setUrl(ldapProps.url());
        ctx.setBase(ldapProps.baseDn());
        ctx.setUserDn(ldapProps.serviceAccountDn());
        ctx.setPassword(ldapProps.serviceAccountPassword());
        ctx.setPooled(true);
        return ctx;
    }

    @Bean
    public LdapTemplate ldapTemplate(LdapContextSource ldapContextSource) {
        return new LdapTemplate(ldapContextSource);
    }
}
