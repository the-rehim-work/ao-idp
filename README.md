# AO IDP

Centralized Identity Provider for `*.ao.az` — OAuth2 Authorization Code + PKCE, OIDC, LDAP authentication.

## Structure

```
ao-idp/
├── server/          Spring Boot 3 / Java 21 backend
├── admin/           React 18 admin panel (built into server image)
├── docker/
│   ├── nginx/       nginx reverse proxy config
│   └── certs/       TLS certificates (not committed)
├── Dockerfile       Multi-stage: builds admin → builds server JAR
└── docker-compose.yml
```

## Requirements

External services must be running and accessible before deploying:
- **PostgreSQL 16** — application database
- **Redis 7** — sessions and refresh tokens
- **LDAP / Active Directory** — user authentication

## Deploy

1. Copy and fill environment variables:
   ```bash
   cp .env.example .env
   ```

2. Put TLS certificates in `docker/certs/`:
   ```
   docker/certs/auth.ao.az.crt
   docker/certs/auth.ao.az.key
   ```

3. Start:
   ```bash
   docker compose up -d --build
   ```

Admin panel: `https://auth.ao.az/admin/`

## Environment variables

| Variable                  | Description                              |
|---------------------------|------------------------------------------|
| `DB_HOST`                 | PostgreSQL host                          |
| `DB_PASSWORD`             | PostgreSQL password                      |
| `REDIS_HOST`              | Redis host                               |
| `LDAP_URL`                | e.g. `ldaps://ldap.ao.az:636`            |
| `LDAP_BASE_DN`            | e.g. `DC=ao,DC=az`                       |
| `LDAP_SERVICE_ACCOUNT_DN` | DN for attribute lookup service account  |
| `LDAP_SERVICE_PASSWORD`   | Service account password                 |
| `LDAP_USERNAME_ATTR`      | `sAMAccountName` (AD) or `uid`           |
| `LDAP_USER_OBJECT_CLASS`  | `user` (AD) or `inetOrgPerson`           |
| `IDP_ISSUER`              | Public issuer URL, e.g. `https://auth.ao.az` |
| `COOKIE_DOMAIN`           | e.g. `.ao.az`                            |

## Local development

**Server:**
```bash
cd server
./gradlew bootRun --args='--spring.profiles.active=dev'
```

**Admin panel:**
```bash
cd admin
npm install
npm run dev    # http://localhost:3000/admin/
```
