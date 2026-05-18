# AO IDP — Claude Code Context

## Project Overview

**AO IDP** is a centralized Identity Provider for Azerbaijan-focused organizations. It implements OAuth 2.0 + OIDC (Authorization Code + PKCE) backed by LDAP/Active Directory authentication. It provides a branded login page for end-users and a React admin panel.

**Tech stack:**
- Backend: Spring Boot 3 (Java 21), Spring Security, Thymeleaf, JPA/Hibernate, Flyway
- Frontend (admin): React 18 + TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand
- Database: PostgreSQL 16 (entities) + Redis 7 (sessions)
- Deployment: Docker Compose + Nginx reverse proxy
- Build: Gradle (backend), npm/Vite (frontend), multi-stage Dockerfile

---

## Architecture

```
Nginx (TLS termination)
  └─► Spring Boot :7000
        ├── /login, /oauth2/authorize, /oauth2/token, /oauth2/logout  — OIDC flow
        ├── /oauth2/userinfo, /.well-known/openid-configuration, /jwks — OIDC discovery
        ├── /admin/api/**  — REST API for admin panel (JWT-protected)
        └── /admin/        — React SPA (built into static resources)
```

**Session model:**
- End-user SSO session: `ao-session` cookie (HttpOnly, Secure) → PostgreSQL `sessions` table
- End-user profile hint: `ao-user` cookie (not HttpOnly, 30-day) → base64url-encoded JSON array of past accounts with remember tokens
- Remember tokens: 48-byte opaque tokens stored as SHA-256 hash in `remember_tokens` table (30-day TTL, rotated on each use)
- Admin session: JWT Bearer token (8h), stored in React `localStorage` via Zustand

---

## Key Files

### Backend

| File | Purpose |
|------|---------|
| `server/src/main/java/az/ao/idp/controller/OidcController.java` | All OAuth2/OIDC endpoints: login (GET/POST), authorize, token, userinfo, logout, revoke |
| `server/src/main/java/az/ao/idp/controller/admin/AdminUserController.java` | Admin REST: user activation/deactivation, LDAP browser (`/ldap/tree`, `/ldap/users`), app-access management |
| `server/src/main/java/az/ao/idp/service/OidcService.java` | Auth code generation, token exchange, logout logic |
| `server/src/main/java/az/ao/idp/service/LdapService.java` | LDAP/AD authentication, user search, attribute fetch, multi-server support |
| `server/src/main/java/az/ao/idp/service/LdapConfigService.java` | CRUD for LDAP server configs, connection test, directory-type defaults |
| `server/src/main/java/az/ao/idp/dto/request/LdapConfigRequest.java` | DTO for LDAP config create/update (includes `usernameAttribute` for per-server override) |
| `server/src/main/java/az/ao/idp/service/IdpSettingsService.java` | Branding, login, security, token settings from DB |
| `server/src/main/java/az/ao/idp/service/SessionService.java` | Redis-backed SSO session create/get/delete |
| `server/src/main/java/az/ao/idp/service/JwtService.java` | RS256 JWT sign/verify for access tokens and admin tokens |
| `server/src/main/java/az/ao/idp/service/BruteForceService.java` | Login rate limiting + lockout |
| `server/src/main/resources/templates/login.html` | End-user login page (Thymeleaf, self-contained CSS, vanilla JS) |
| `server/src/main/resources/templates/consent.html` | OAuth2 scope consent page |
| `server/src/main/resources/application-prod.yml` | Spring config: DB, Redis, JWT settings, cookie config |
| `server/src/main/java/az/ao/idp/service/RememberTokenService.java` | Remember token issue / validate / rotate (passwordless continue-as) |
| `server/src/main/resources/db/migration/` | Flyway SQL migrations (V1–V6) |

### Frontend (Admin)

| File | Purpose |
|------|---------|
| `admin/src/pages/SettingsPage.tsx` | All settings: appearance, LDAP, token expiry, JWT claims, login settings, login branding (themes), security |
| `admin/src/pages/ApplicationsPage.tsx` | OAuth2 client management |
| `admin/src/pages/UsersPage.tsx` | End-user management (LDAP-synced) |
| `admin/src/pages/AuditPage.tsx` | Audit log viewer |
| `admin/src/api/settings.ts` | Admin API client for settings (branding, LDAP, security) |
| `admin/src/theme.ts` | Runtime CSS-variable theming engine (localStorage) |
| `admin/src/store/authStore.ts` | Zustand store for admin JWT + permissions |

---

## Configuration

### Environment Variables (`.env`)

```
DB_HOST / DB_PORT / DB_NAME / DB_USERNAME / DB_PASSWORD
IDP_ISSUER          — public URL, e.g. https://auth.ao.az
COOKIE_DOMAIN       — e.g. .ao.az
REDIS_HOST / REDIS_PORT
```

### Key application.yml settings

```yaml
ao.idp:
  cookie.name: ao-session
  cookie.max-age-seconds: 28800          # 8h
  jwt.access-token-expiry-minutes: 15
  jwt.refresh-token-expiry-days: 7
  jwt.admin-token-expiry-minutes: 480    # 8h
  brute-force.max-attempts: 5
  brute-force.lockout-duration-minutes: 15
server.port: 7000
```

LDAP is configured in the admin panel (Settings → LDAP), not via env vars.

---

## Build & Run

### Local development

```bash
# Backend (from server/)
./gradlew bootRun

# Admin frontend (from admin/)
npm install && npm run dev   # Vite dev server on :5173, proxies /api → :7000
```

### Production (Docker)

```bash
cp .env.example .env && nano .env   # fill in secrets
docker compose up -d
```

### Offline/USB deploy

```bash
./scripts/build-export.sh       # builds idp-server.tar + postgres.tar → export/
# copy export/, docker-compose.yml, .env, scripts/load-deploy.sh to target
./scripts/load-deploy.sh        # on target machine
```

---

## Login Page Branding

The end-user login page (`/login`) is fully brandable via **Admin → Settings → Login Branding**:

- **Logo URL**, welcome text, footer text
- **Colors**: primary, background, text
- **Font selector**: 14 offline fonts (Inter, Outfit, DM Sans, Nunito, Poppins, Plus Jakarta Sans, Lato, Merriweather, Playfair Display, Raleway, Roboto Slab, Source Code Pro, Space Grotesk, Urbanist) — fonts are bundled; no external CDN required
- **Custom CSS**: full CSS override injected into the page
- **Preset themes**: 14 ready-made themes selectable from a dropdown (Default Cyber Teal, Orange Light, Dark Glassmorphism, Corporate Blue, Midnight Purple, Forest Green, Rose Pink, Minimal White, Slate Dark, Ocean Blue, Neon Matrix, Warm Sand, + 2 more)
- **Continue-as toggle**: show/hide the stored-accounts panel
- **Live preview**: right-hand panel in the branding settings form that reflects all changes (colors, font, welcome text, continue-as) in real time before saving

Branding is stored in the `idp_settings` DB table and read at every page render (no restart needed).

---

## Multi-Account "Continue As" Feature (Passwordless)

When a user logs in, their profile and a **remember token** are stored in the `ao-user` cookie (not HttpOnly, 30-day, JS-accessible). The cookie stores a **JSON array** of up to 5 past accounts:

```json
[{"u":"jsmith","n":"John Smith","rt":"BASE64URL_REMEMBER_TOKEN"},
 {"u":"ajones","n":"Alice Jones","rt":"BASE64URL_REMEMBER_TOKEN"}]
```

The `rt` field is a 48-byte random token (384-bit entropy). On the server, the SHA-256 hash of the token is stored in the `remember_tokens` DB table with a 30-day TTL. The raw token in the cookie is never stored on the server.

### How it works

1. **First login**: user enters username + password → session created, remember token issued and stored in `ao-user` cookie
2. **Return visit**: login page reads `ao-user` and renders the Continue-as panel
3. **Click an account with `rt`**: JS submits `POST /oauth2/continue-as` with the remember token — **no password required**
4. **Server validates**: token hash found in DB and not expired → creates new session, rotates the token (old invalidated, new issued), updates cookie
5. **Click an account without `rt`** (old/expired): shows password-only view for that account
6. **Click ×**: removes account from the cookie client-side (remember token expires server-side naturally after 30 days)

### Token rotation

Every successful `/oauth2/continue-as` call rotates the token: the used token is deleted and a new one issued. This limits the damage from a stolen cookie — each token is single-use for session creation.

### Security properties

- Token entropy: 48 bytes (384 bits) — unguessable even with access to the DB
- Server stores only the SHA-256 hash — cookie theft doesn't expose the DB value
- Logout clears the `ao-session` but **not** the remember tokens (Google-style: user can still click "continue as" without a password on the next visit, even after logging out)
- Brute-force is impossible: 48-byte random token with no rate-limiting needed

### `/oauth2/continue-as` endpoint

```
POST /oauth2/continue-as
Content-Type: application/x-www-form-urlencoded

remember_token=RAW_TOKEN
client_id=YOUR_CLIENT_ID        (optional — if part of OAuth2 flow)
redirect_uri=https://app/cb     (optional)
state=RANDOM_STATE              (optional)
scope=openid%20profile          (optional)
code_challenge=...              (optional)
code_challenge_method=S256      (optional)
```

Response: same as a successful `POST /login` — redirects to `redirect_uri?code=...&state=...` or to `/admin/` if no OAuth2 params.

The `ao-user` cookie is **preserved on logout** — only the `ao-session` cookie is cleared on `/oauth2/logout`. This matches Google-style account switching UX.

---

## OAuth2 Logout Flow

- **POST `/oauth2/logout`**: API logout (used by client apps). Invalidates session + refresh token. Clears `ao-session` cookie. Does NOT clear `ao-user` (profile hint preserved).
- **GET `/oauth2/logout`**: Browser redirect logout (RP-initiated logout). Same behavior + optional `post_logout_redirect_uri` (validated against registered URIs). Redirects to `/login?logged_out=1` if no post-logout URI — the `logged_out` flag prevents an automatic redirect to `/admin/` so the user always sees the login page with the Continue-as section.

External apps should call logout via GET redirect so the IDP can clear the session cookie in the browser.

---

## `prompt=login` — Force Re-authentication (OIDC Core §3.1.2.1)

When a client app redirects a user to `/oauth2/authorize` with `prompt=login`, the IDP **skips the existing session** and forces the user to re-authenticate, even if a valid `ao-session` cookie is present.

**When to use:**
- After the client app clears its own local session (but didn't call IDP logout)
- When the app needs fresh credentials (e.g., sensitive actions)
- When the user explicitly clicks "Sign in with a different account"

**How to add it to your OAuth2 authorization URL:**
```
GET /oauth2/authorize
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.example.com/callback
  &response_type=code
  &scope=openid%20profile
  &state=random_state
  &code_challenge=BASE64URL_ENCODED_CHALLENGE
  &code_challenge_method=S256
  &prompt=login                          ← add this
```

After `prompt=login`, the user is taken to the login page where they can pick a stored account via Continue-as (passwordless, one click) or type new credentials. The existing IDP session is NOT destroyed — only its auto-authorization is bypassed. After re-authentication a fresh session is created alongside the old one (which expires naturally).

**Important**: `prompt=login` bypasses the existing SSO session but does NOT bypass the remember token. The user will still see the Continue-as panel and can click through without a password if they have a valid remember token.

**Recommended logout pattern for client apps:**
```
# Option A — browser redirect logout (preferred, clears IDP session cookie)
# User can still use passwordless continue-as after this (remember token survives logout)
GET /oauth2/logout
  ?client_id=YOUR_CLIENT_ID
  &post_logout_redirect_uri=https://yourapp.example.com/logged-out

# Option B — force fresh password entry on next authorize call
# Use when the app requires explicit re-authentication (e.g. after inactivity)
# NOTE: even with prompt=login the user MAY click "continue as" and skip the password.
# If you truly need a password re-entry, show your own re-auth UI before the OAuth2 flow.
GET /oauth2/authorize?...&prompt=login

# Option C — hybrid: redirect logout then prompt=login
# Clears the IDP session; user then sees Continue-as panel but must still
# click through (one click vs typing credentials)
GET /oauth2/logout?...&post_logout_redirect_uri=https://app/re-auth
# → on re-auth page, redirect to /oauth2/authorize?...&prompt=login
```

---

## Database Schema (Flyway)

Migrations live in `server/src/main/resources/db/migration/`. Full column-level schema is documented in the admin panel under **Docs → IDP Guide → Database Schema**.

| Migration | Tables / Changes |
|-----------|-----------------|
| V1 | `users`, `sessions`, `refresh_tokens`, `auth_codes`, `applications`, `audit_logs`, `login_attempts` |
| V2 | `idp_settings` (key-value store for all runtime settings: branding, security, tokens, log retention) |
| V3 | `admin_users`, `admin_roles`, `admin_permissions` |
| V4 | `email_attribute` support added to LDAP server config (stored in `idp_settings`) |
| V5 | `post_logout_redirect_uris` column on `applications` (RP-initiated logout) |
| V6 | `remember_tokens` (passwordless continue-as: SHA-256 hashed 48-byte token, 30-day TTL, rotated on use) |

---

## Admin API Endpoints (summary)

All under `/admin/api/v1/`, protected by `Authorization: Bearer <admin-jwt>`.

- `GET/PUT /admin/api/v1/settings/login/branding` — login page branding (colors, font, welcome text, CSS)
- `GET/PUT /admin/api/v1/settings/security` — lockout, PKCE, session idle, IP allowlist
- `GET/PUT /admin/api/v1/settings/tokens` — token expiry settings
- `GET/PUT /admin/api/v1/settings/claims` — JWT claim-to-LDAP-attribute mappings
- `GET/POST/PUT/DELETE /admin/api/v1/settings/ldap/{id}` — LDAP server config CRUD
- `PATCH /admin/api/v1/settings/ldap/{id}/activate|deactivate` — toggle active server
- `POST /admin/api/v1/settings/ldap/test` — test LDAP connection from form data
- `GET /admin/api/v1/ldap/tree?dn=&configId=` — LDAP tree browser (children of a DN)
- `GET /admin/api/v1/ldap/users?search=&limit=500` — search LDAP users across all active servers (server-side limit, default 500)
- `GET /admin/api/v1/ldap/entry?dn=&configId=` — fetch all attributes of one LDAP entry
- `GET/POST /admin/api/v1/apps` — OAuth2 client (application) CRUD
- `GET /admin/api/v1/users?search=&page=&size=` — activated end users (paginated)
- `POST /admin/api/v1/users` — activate an LDAP user (create IDP account)
- `DELETE /admin/api/v1/users/{id}` — deactivate a user
- `POST /admin/api/v1/apps/{appId}/users/{ldapUsername}/activate` — grant app access
- `DELETE /admin/api/v1/apps/{appId}/users/{userId}/access` — revoke app access
- `GET /admin/api/v1/audit` — audit log (paginated)
- `GET /admin/api/v1/stats` — dashboard stats (sessions, users, apps)

---

## Security Notes

- JWT signed with RS256; public key exposed at `/jwks`
- PKCE (S256) enforced by default (configurable)
- Brute-force: 5 failed attempts → 15-min lockout (configurable in admin)
- CSRF protection on all POST forms (Spring Security default)
- `ao-session` cookie: HttpOnly, Secure, domain-scoped
- LDAP is read-only; user passwords are never stored
- Admin passwords are bcrypt-hashed

---

## `.claude` Folder

Contains git worktrees created by Claude Code for isolated branch work:
- `.claude/settings.local.json` — Claude Code tool permission allowlist for this project
- `.claude/worktrees/` — isolated git worktrees (auto-created, safe to ignore)

---

## Recent Changes (session summary)

### Passwordless "Continue As" (Google-style) — V6 migration
- New `remember_tokens` table (V6 Flyway migration): stores SHA-256 hash of 48-byte random token, userId, ldapUsername, 30-day TTL
- `RememberTokenService`: issue / validate / rotate / scheduled cleanup
- `OidcController.login()`: after successful password auth, issues a remember token and embeds it as `rt` in the `ao-user` cookie profile entry
- New `POST /oauth2/continue-as` endpoint: validates remember token → rotates it → creates session → issues auth code or redirects to admin (no LDAP call, no password)
- `login.html`: accounts with `rt` in cookie → clicking them submits the continue-as hidden form immediately (zero clicks on password). Accounts without `rt` → show password-only view as before.
- Token rotation: each use of `/oauth2/continue-as` invalidates the old token and issues a new one (prevents replay)
- Logout does NOT clear remember tokens (Google-style: user can still click through next visit)

### Multi-account stored sessions (`OidcController.java`, `login.html`)
- `ao-user` cookie stores a JSON array (up to 5 accounts) with `u`, `n`, and optional `rt` fields
- Login page renders each stored account as a clickable row with a × remove button
- Backward-compatible: old format without `rt` shows password-only view on click

### 14-theme preset selector + offline font picker (`SettingsPage.tsx`, `login.html`)
- Added 12+ CSS theme templates via `<select>` dropdown (Orange Light, Dark Glassmorphism, Corporate Blue, Midnight Purple, Forest Green, Rose Pink, Minimal White, Slate Dark, Ocean Blue, Neon Matrix, Warm Sand, ...)
- Added font selector: 14 fonts bundled offline (Inter, Outfit, DM Sans, Nunito, Poppins, Plus Jakarta Sans, Lato, Merriweather, Playfair Display, Raleway, Roboto Slab, Source Code Pro, Space Grotesk, Urbanist)
- `fontFamily` field added to `LoginBranding` DTO and `idp_settings` storage
- Live preview panel now reflects font in real time (was missing `fontFamily` before)
- Login button loading state: on form submit the button shows a spinner + "Giriş tamamlanır..." and the card is dimmed

### LDAP directory type selector + username attribute fix (`SettingsPage.tsx`, `LdapService.java`, `LdapConfigService.java`)
- Added "Directory Type" button group to LDAP config form (Active Directory / OpenLDAP / Other)
- Selecting AD auto-fills `userObjectClass=user`, `usernameAttribute=sAMAccountName`, URL template `ldap://`
- Selecting OpenLDAP auto-fills `userObjectClass=inetOrgPerson`, `usernameAttribute=uid`
- `usernameAttribute` is now a first-class field in `LdapConfigRequest` and persisted on create/update
- `LdapAttributeRow` derives the default username attribute from the server's `userObjectClass` (no longer hardcodes `sAMAccountName` for all servers)
- Fixes root cause of wrong objectClass filter being applied when the default value had never been explicitly set

### LDAP user list server-side limit + client-side pagination (`AdminUserController.java`, `LdapService.java`, `UsersPage.tsx`)
- `GET /admin/api/v1/ldap/users` now accepts `?limit=N` (default 500); passed as `SearchControls.setCountLimit` to the LDAP server
- `LdapService.listUsersFromAllActive(search, attr, limit)` overload added; size-limit exceptions are caught via string matching (Spring wraps JNDI exceptions before surfacing)
- Users → Directory tab now paginates 50 entries per page client-side; shows "X–Y of Z" count and prev/next buttons

### Database Schema docs (`DocsPage.tsx`)
- Added `idp-database` section to the IDP Guide covering all V1–V6 tables with full column definitions
