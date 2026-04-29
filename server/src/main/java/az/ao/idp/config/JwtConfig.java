package az.ao.idp.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.util.StringUtils;

import java.io.InputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Configuration
public class JwtConfig {

    private final String keyPath;

    public JwtConfig(IdpProperties idpProperties) {
        this.keyPath = idpProperties.jwt().rsaKeyPath();
    }

    public List<KeyPair> loadKeyPairs() {
        return isClasspathPath()
                ? loadKeyPairsFromClasspath()
                : loadKeyPairsFromFileSystem();
    }

    public KeyPair loadKeyPair(Path keyDir, String kid) {
        try {
            RSAPrivateKey privateKey = loadPrivateKey(keyDir.resolve("private-" + kid + ".pem"));
            RSAPublicKey publicKey = loadPublicKey(keyDir.resolve("public-" + kid + ".pem"));
            return new KeyPair(kid, privateKey, publicKey);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load key pair for kid=" + kid, e);
        }
    }

    private List<KeyPair> loadKeyPairsFromFileSystem() {
        Path keyDir = Paths.get(keyPath);
        if (!Files.exists(keyDir)) {
            throw new IllegalStateException("JWT key path does not exist: " + keyPath);
        }
        try (Stream<Path> files = Files.list(keyDir)) {
            List<String> kids = files
                    .map(p -> p.getFileName().toString())
                    .map(this::extractKidFromPrivateKeyName)
                    .filter(StringUtils::hasText)
                    .sorted()
                    .toList();

            if (kids.isEmpty()) {
                throw new IllegalStateException("No RSA private key files found in: " + keyPath);
            }

            return kids.stream()
                    .map(kid -> loadKeyPair(keyDir, kid))
                    .toList();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to list key files in: " + keyPath, e);
        }
    }

    private List<KeyPair> loadKeyPairsFromClasspath() {
        String basePath = keyPath.replace("classpath:", "").replaceAll("^/+", "");
        String pattern = "classpath*:" + basePath + "/private-*.pem";
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        try {
            Resource[] privateKeyResources = resolver.getResources(pattern);
            List<String> kids = Stream.of(privateKeyResources)
                    .map(Resource::getFilename)
                    .map(this::extractKidFromPrivateKeyName)
                    .filter(StringUtils::hasText)
                    .sorted()
                    .toList();

            if (kids.isEmpty()) {
                throw new IllegalStateException("No RSA private key files found in classpath path: " + keyPath);
            }

            return kids.stream()
                    .map(kid -> loadKeyPairFromClasspath(basePath, kid, resolver))
                    .sorted(Comparator.comparing(KeyPair::kid))
                    .toList();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to list key files in classpath path: " + keyPath, e);
        }
    }

    private KeyPair loadKeyPairFromClasspath(
            String basePath,
            String kid,
            PathMatchingResourcePatternResolver resolver
    ) {
        try {
            Resource privateResource = resolver.getResource("classpath:" + basePath + "/private-" + kid + ".pem");
            Resource publicResource = resolver.getResource("classpath:" + basePath + "/public-" + kid + ".pem");
            RSAPrivateKey privateKey = loadPrivateKey(privateResource);
            RSAPublicKey publicKey = loadPublicKey(publicResource);
            return new KeyPair(kid, privateKey, publicKey);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load key pair from classpath for kid=" + kid, e);
        }
    }

    private boolean isClasspathPath() {
        return keyPath != null && keyPath.startsWith("classpath:");
    }

    private String extractKidFromPrivateKeyName(String name) {
        if (name == null) {
            return null;
        }
        Matcher matcher = Pattern.compile("^private-(.+)\\.pem$").matcher(name);
        return matcher.matches() ? matcher.group(1) : null;
    }

    private RSAPrivateKey loadPrivateKey(Path path) throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        String pem = Files.readString(path)
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] decoded = Base64.getDecoder().decode(pem);
        return (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(decoded));
    }

    private RSAPublicKey loadPublicKey(Path path) throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        String pem = Files.readString(path)
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");
        byte[] decoded = Base64.getDecoder().decode(pem);
        return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(decoded));
    }

    private RSAPrivateKey loadPrivateKey(Resource resource) throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        if (!resource.exists()) {
            throw new IllegalStateException("Missing private key resource: " + resource.getDescription());
        }
        String pem;
        try (InputStream inputStream = resource.getInputStream()) {
            pem = new String(inputStream.readAllBytes());
        }
        pem = pem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] decoded = Base64.getDecoder().decode(pem);
        return (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(decoded));
    }

    private RSAPublicKey loadPublicKey(Resource resource) throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        if (!resource.exists()) {
            throw new IllegalStateException("Missing public key resource: " + resource.getDescription());
        }
        String pem;
        try (InputStream inputStream = resource.getInputStream()) {
            pem = new String(inputStream.readAllBytes());
        }
        pem = pem
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");
        byte[] decoded = Base64.getDecoder().decode(pem);
        return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(decoded));
    }

    public record KeyPair(String kid, RSAPrivateKey privateKey, RSAPublicKey publicKey) {}
}
