package az.ao.idp.service;

import az.ao.idp.config.IdpProperties;
import az.ao.idp.config.JwtConfig;
import az.ao.idp.dto.response.JwksResponse;
import az.ao.idp.exception.InvalidTokenException;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.SignatureException;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.math.BigInteger;
import java.time.Instant;
import java.util.*;

@Service
public class JwtService {

    private final JwtConfig jwtConfig;
    private final IdpProperties.JwtProperties jwtProps;
    private final String issuer;

    private List<JwtConfig.KeyPair> keyPairs;
    private JwtConfig.KeyPair activeKeyPair;

    public JwtService(JwtConfig jwtConfig, IdpProperties idpProperties) {
        this.jwtConfig = jwtConfig;
        this.jwtProps = idpProperties.jwt();
        this.issuer = idpProperties.issuer();
    }

    @PostConstruct
    void init() {
        keyPairs = jwtConfig.loadKeyPairs();
        activeKeyPair = keyPairs.get(keyPairs.size() - 1);
    }

    public String issueAccessToken(UUID userId, String clientId, String ldapUsername, String email, String displayName) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId.toString())
                .issuer(issuer)
                .audience().add(clientId).and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(jwtProps.accessTokenExpiryMinutes() * 60)))
                .id(UUID.randomUUID().toString())
                .claim("ldap_username", ldapUsername)
                .claim("email", email)
                .claim("display_name", displayName)
                .header().keyId(activeKeyPair.kid()).and()
                .signWith(activeKeyPair.privateKey(), Jwts.SIG.RS256)
                .compact();
    }

    public String issueAdminToken(UUID adminId, String username, String adminType, String displayName, List<UUID> scopedAppIds) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(adminId.toString())
                .issuer(issuer)
                .audience().add("ao-admin").and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(jwtProps.adminTokenExpiryMinutes() * 60)))
                .id(UUID.randomUUID().toString())
                .claim("username", username)
                .claim("admin_type", adminType)
                .claim("display_name", displayName)
                .claim("scoped_app_ids", scopedAppIds.stream().map(UUID::toString).toList())
                .header().keyId(activeKeyPair.kid()).and()
                .signWith(activeKeyPair.privateKey(), Jwts.SIG.RS256)
                .compact();
    }

    public Claims validateUserToken(String token) {
        return parseToken(token);
    }

    public Claims validateAdminToken(String token) {
        Claims claims = parseToken(token);
        Set<String> audience = claims.getAudience();
        if (audience == null || !audience.contains("ao-admin")) {
            throw new InvalidTokenException("Token is not an admin token");
        }
        return claims;
    }

    public JwksResponse buildJwks() {
        List<JwksResponse.JwkKey> keys = keyPairs.stream().map(kp -> {
            BigInteger modulus = kp.publicKey().getModulus();
            BigInteger exponent = kp.publicKey().getPublicExponent();
            String n = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(stripLeadingZero(modulus.toByteArray()));
            String e = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(exponent.toByteArray());
            return new JwksResponse.JwkKey("RSA", "sig", "RS256", kp.kid(), n, e);
        }).toList();
        return new JwksResponse(keys);
    }

    private Claims parseToken(String token) {
        try {
            return Jwts.parser()
                    .keyLocator(header -> {
                        String kid = (String) header.get("kid");
                        return keyPairs.stream()
                                .filter(kp -> kp.kid().equals(kid))
                                .findFirst()
                                .map(JwtConfig.KeyPair::publicKey)
                                .orElse(activeKeyPair.publicKey());
                    })
                    .requireIssuer(issuer)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            throw new InvalidTokenException("Token has expired");
        } catch (SignatureException e) {
            throw new InvalidTokenException("Invalid token signature");
        } catch (JwtException e) {
            throw new InvalidTokenException("Invalid token: " + e.getMessage());
        }
    }

    private byte[] stripLeadingZero(byte[] bytes) {
        if (bytes.length > 1 && bytes[0] == 0) {
            return Arrays.copyOfRange(bytes, 1, bytes.length);
        }
        return bytes;
    }
}
