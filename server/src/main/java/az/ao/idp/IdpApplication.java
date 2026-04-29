package az.ao.idp;

import az.ao.idp.config.IdpProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(IdpProperties.class)
@org.springframework.scheduling.annotation.EnableAsync
public class IdpApplication {

    public static void main(String[] args) {
        SpringApplication.run(IdpApplication.class, args);
    }
}
