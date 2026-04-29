# AO IDP

Centralized Identity Provider for `*.ao.az` — OAuth2 Authorization Code + PKCE, OIDC, LDAP/AD authentication.

## Structure

```
ao-idp/
├── server/                   Spring Boot 3 / Java 21 backend
│   ├── src/
│   │   ├── main/java/        Application code
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── db/migration/ Flyway migrations (V1 → V10)
│   │       └── templates/    Thymeleaf login page
│   ├── build.gradle
│   └── gradlew
├── admin/                    React 18 admin panel
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── docker/
│   ├── nginx/nginx.conf      Reverse proxy (SSL termination)
│   └── certs/                TLS certificates (not committed)
├── Dockerfile                Multi-stage build
├── docker-compose.yml
└── .env.example
```

## How the admin panel is merged into the server

The `Dockerfile` is a three-stage build:

1. **Node stage** — runs `npm run build` inside `admin/`, outputs static files
2. **Gradle stage** — copies those static files into `server/src/main/resources/static/admin/`, then builds the Spring Boot JAR
3. **Runtime stage** — runs the JAR

The admin panel is served from within the Spring Boot app at `/admin/`. There is no separate container for the admin UI.

```
docker compose up --build   ← builds both, deploys one image
```

---

## Local development

### Backend only

```bash
cd server
./gradlew bootRun --args='--spring.profiles.active=dev'
# runs at http://localhost:8080
```

### Admin UI (hot reload)

The Vite dev server proxies `/admin/api/` calls to the Spring Boot backend.

```bash
# In a separate terminal, with server already running:
cd admin
npm install
npm run dev
# open http://localhost:3000/admin/
```

> Changes to `admin/src/` are reflected instantly. You do not need to rebuild the server JAR during UI development.

### Building the UI into the JAR

```bash
cd admin && npm run build
# outputs to admin/dist/ — then run gradlew bootRun as usual
```

Or just use `docker compose up --build` which does everything automatically.

---

## Production deploy

### Prerequisites

These services must be running and accessible **before** starting:

| Service    | Purpose                     |
|------------|-----------------------------|
| PostgreSQL 16 | Application database     |
| Redis 7    | Sessions + refresh tokens   |
| LDAP / AD  | User authentication (readonly) |

### First-time setup

1. **Clean up dev-only migrations** — before deploying to production for the first time, remove these files from `server/src/main/resources/db/migration/`:

   | File | Why remove |
   |------|-----------|
   | `V4__reset_admin_password.sql` | Dev password reset, not needed |
   | `V5__reset_admin_password.sql` | Dev password reset, not needed |
   | `V6__prod_seed_data.sql` | Seeds 29 fake test users — do not use in production |

   > Flyway runs all present migration files on first startup. Removing these before the first run means they never execute. If the database is already initialized with them, you must clean up the fake users manually.

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Fill in all values — see table below
   ```

3. **Add TLS certificates:**
   ```
   docker/certs/auth.ao.az.crt
   docker/certs/auth.ao.az.key
   ```

4. **Deploy:**
   ```bash
   docker compose up -d --build
   ```

5. **Change the superadmin password** — the initial password seeded by `V2__seed_admin.sql` is a known dev credential. Log in at `https://auth.ao.az/admin/` and change it immediately, or update the hash directly:
   ```sql
   UPDATE admin_users
   SET password_hash = '<new bcrypt hash>'
   WHERE username = 'superadmin';
   ```

### Migrations on startup

Flyway runs automatically when the server starts. On the first run against an empty database it executes all migration files in version order (V1 → V10, minus any you removed). Subsequent starts only apply new versions.

If a migration fails the server will not start — check logs with:
```bash
docker compose logs idp-server
```

---

## Environment variables

| Variable                  | Description                                      |
|---------------------------|--------------------------------------------------|
| `DB_HOST`                 | PostgreSQL hostname                              |
| `DB_PORT`                 | PostgreSQL port (default: `5432`)                |
| `DB_NAME`                 | Database name (default: `ao_idp`)                |
| `DB_USERNAME`             | Database user (default: `ao_idp`)                |
| `DB_PASSWORD`             | Database password                                |
| `REDIS_HOST`              | Redis hostname                                   |
| `REDIS_PORT`              | Redis port (default: `6379`)                     |
| `LDAP_URL`                | e.g. `ldaps://ldap.ao.az:636`                    |
| `LDAP_BASE_DN`            | e.g. `DC=ao,DC=az`                               |
| `LDAP_SERVICE_ACCOUNT_DN` | DN used for user attribute lookups               |
| `LDAP_SERVICE_PASSWORD`   | Service account password                         |
| `LDAP_USERNAME_ATTR`      | `sAMAccountName` (AD) or `uid` (OpenLDAP)        |
| `LDAP_USER_OBJECT_CLASS`  | `user` (AD) or `inetOrgPerson` (OpenLDAP)        |
| `IDP_ISSUER`              | Public URL, e.g. `https://auth.ao.az`            |
| `COOKIE_DOMAIN`           | e.g. `.ao.az`                                    |

---

## Key endpoints

| Endpoint                                | Description                  |
|-----------------------------------------|------------------------------|
| `GET /.well-known/openid-configuration` | OIDC discovery               |
| `GET /jwks`                             | Public signing keys (RS256)  |
| `GET /authorize`                        | Authorization endpoint        |
| `POST /token`                           | Token exchange / refresh      |
| `GET /userinfo`                         | UserInfo (Bearer token)       |
| `POST /token/revoke`                    | Token revocation (RFC 7009)   |
| `POST /logout`                          | End session                   |
| `GET /admin/`                           | Admin panel                   |
| `GET /swagger-ui.html`                  | API docs                      |
