package az.ao.idp.util;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Base64;

@Component
public class SecureRandomUtil {

    private final SecureRandom secureRandom = new SecureRandom();

    public String generateSessionId() {
        return generateBase64UrlToken(32);
    }

    public String generateRefreshToken() {
        return generateBase64UrlToken(48);
    }

    public String generateAuthCode() {
        return generateBase64UrlToken(32);
    }

    public String generateClientId() {
        return generateBase64UrlToken(16);
    }

    public String generateClientSecret() {
        return generateBase64UrlToken(32);
    }

    private String generateBase64UrlToken(int byteLength) {
        byte[] bytes = new byte[byteLength];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
