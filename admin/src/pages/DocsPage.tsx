import React, { useState } from 'react'

const C = 'var(--accent)'
const CD = 'var(--accent-strong)'
const CM = 'var(--text-dim)'
const CB = 'var(--text-muted)'
const BORDER = 'rgba(94,234,212,0.2)'
const SURFACE = 'var(--surface-1)'
const SURFACE2 = 'var(--surface-2)'

interface Section { id: string; title: string; content: React.ReactNode }

function Code({ children }: { children: string }) {
  return (
    <code style={{ background: SURFACE2, color: CD, border: `1px solid ${BORDER}`, padding: '1px 6px', fontSize: '0.8rem', fontFamily: 'inherit' }}>
      {children}
    </code>
  )
}

function Block({ title, children }: { title?: string; children: string }) {
  return (
    <div style={{ margin: '0.75rem 0' }}>
      {title && <div style={{ fontSize: '0.55rem', color: CB, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>{title}</div>}
      <pre style={{ background: SURFACE2, border: `1px solid ${BORDER}`, padding: '1rem', fontSize: '0.8rem', color: CD, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'inherit', margin: 0 }}>
        {children}
      </pre>
    </div>
  )
}

function H3({ children }: { children: string }) {
  return <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '1.25rem', marginBottom: '0.5rem', color: C }}>{children}</div>
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '0.82rem', lineHeight: 1.7, marginBottom: '0.6rem', color: CM }}>{children}</p>
}

function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: '0.82rem', color: CM, display: 'flex', gap: '0.5rem' }}>
          <span style={{ color: C, flexShrink: 0 }}>›</span>{item}
        </li>
      ))}
    </ul>
  )
}

function Note({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warn' | 'tip' }) {
  const colors = {
    info: { bg: 'rgba(94,234,212,0.05)', border: 'rgba(94,234,212,0.25)', text: C },
    warn: { bg: 'rgba(251,191,36,0.05)', border: 'rgba(251,191,36,0.35)', text: 'var(--warning)' },
    tip:  { bg: 'rgba(52,211,153,0.05)', border: 'rgba(52,211,153,0.3)',  text: 'var(--success)' },
  }
  const { bg, border, text } = colors[type]
  const icons = { info: 'ℹ', warn: '⚠', tip: '💡' }
  return (
    <div style={{ margin: '0.75rem 0', padding: '0.6rem 0.85rem', background: bg, border: `1px solid ${border}`, borderRadius: 5, display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
      <span style={{ color: text, flexShrink: 0, fontSize: '0.75rem' }}>{icons[type]}</span>
      <div style={{ fontSize: '0.8rem', color: CM, lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  IDP GUIDE SECTIONS
// ─────────────────────────────────────────────
const idpSections: Section[] = [
  {
    id: 'idp-overview',
    title: 'Overview',
    content: (
      <div>
        <P>AO IDP is a self-hosted Identity Provider (IdP) that bridges your LDAP/Active Directory with modern OAuth 2.0 / OpenID Connect applications. It handles authentication so your apps never touch directory credentials.</P>
        <H3>Architecture</H3>
        <Block>{`┌─────────────────────────────────────────────┐
│                 AO IDP Server                │
│                                              │
│  ┌──────────┐    ┌──────────┐   ┌─────────┐ │
│  │  Login   │    │  OAuth2  │   │  Admin  │ │
│  │  Page    │───▶│  Engine  │   │  Panel  │ │
│  └──────────┘    └──────────┘   └─────────┘ │
│        │               │              │      │
│        ▼               ▼              ▼      │
│  ┌──────────┐    ┌──────────┐   ┌─────────┐ │
│  │   LDAP   │    │   JWT    │   │  DB     │ │
│  │ Service  │    │  Service │   │ (Postgres│ │
│  └──────────┘    └──────────┘   └─────────┘ │
└─────────────────────────────────────────────┘
         │
   ┌─────┴──────┐
   ▼            ▼
Active       Registered
Directory    Applications`}</Block>
        <H3>Key capabilities</H3>
        <Ul items={[
          'Authorization Code flow with PKCE (RFC 6749 / RFC 7636)',
          'LDAP / Active Directory authentication with multi-server support',
          'Per-application user access control list',
          'RS256-signed JWT access tokens + refresh tokens',
          'JWKS endpoint for stateless token validation by resource servers',
          'Configurable JWT claim mappings from any LDAP attribute',
          'Admin panel with role-based access (idp_admin / app_admin)',
          'Login page branding: colors, logo, welcome text, custom CSS',
          'Audit log for all login and admin events',
          'Brute-force protection with configurable lockout',
        ]} />
      </div>
    ),
  },
  {
    id: 'idp-deployment',
    title: 'Deployment',
    content: (
      <div>
        <P>AO IDP is distributed as a single Docker image. A <Code>docker-compose.yml</Code> file is provided that starts the server, Postgres, and Nginx in one command.</P>
        <H3>Quick start</H3>
        <Block title="1. Copy the compose file and start">{`git clone https://github.com/your-org/ao-idp.git
cd ao-idp
docker compose up -d`}</Block>
        <Block title="2. Import image from tar (air-gapped)">{`docker load -i ao-idp-server.tar
docker tag ao-images/ao-idp-server:latest ao-images/ao-idp-server:latest
docker compose up -d`}</Block>
        <H3>Environment variables</H3>
        <Ul items={[
          <><Code>IDP_ISSUER</Code> — public base URL, e.g. <Code>https://auth.company.com</Code>. Must be reachable by browsers and resource servers.</>,
          <><Code>IDP_DB_URL</Code> — JDBC URL, e.g. <Code>jdbc:postgresql://db:5432/idp</Code></>,
          <><Code>IDP_DB_USERNAME</Code> / <Code>IDP_DB_PASSWORD</Code> — database credentials</>,
          <><Code>IDP_COOKIE_DOMAIN</Code> — cookie domain (e.g. <Code>.company.com</Code> for SSO across subdomains)</>,
          <><Code>IDP_JWT_KEY_PATH</Code> — path to RSA private key PEM (auto-generated on first start if absent)</>,
        ]} />
        <Note type="warn">Set <Code>IDP_ISSUER</Code> to the exact URL your users will hit. The issuer is embedded in every JWT and must match the <Code>iss</Code> claim validated by resource servers.</Note>
        <H3>First run</H3>
        <P>On first start with a fresh database, a default <Code>admin</Code> account is created with a random password printed to stdout. Change it immediately via Settings → Admin.</P>
      </div>
    ),
  },
  {
    id: 'idp-ldap',
    title: 'LDAP Configuration',
    content: (
      <div>
        <P>Go to <strong style={{ color: CD }}>Settings → LDAP Server</strong> to configure one or more directory servers.</P>
        <H3>Required fields</H3>
        <Ul items={[
          <><Code>URL</Code> — <Code>ldap://host:389</Code> or <Code>ldaps://host:636</Code> (TLS recommended)</>,
          <><Code>Base DN</Code> — root of the user search, e.g. <Code>DC=company,DC=com</Code></>,
          <><Code>Service Account DN</Code> — a read-only bind account used to search the directory</>,
          <><Code>Service Account Password</Code> — stored encrypted at rest</>,
          <><Code>User Object Class</Code> — e.g. <Code>user</Code> (AD) or <Code>inetOrgPerson</Code> (OpenLDAP)</>,
        ]} />
        <H3>Optional fields</H3>
        <Ul items={[
          <><Code>Additional Filter</Code> — extra LDAP filter applied to all user searches, e.g. <Code>(department=Engineering)</Code></>,
          <><Code>Username Attribute</Code> — default <Code>sAMAccountName</Code>; use <Code>uid</Code> for OpenLDAP</>,
          <><Code>Email Attribute</Code> — default <Code>mail</Code></>,
        ]} />
        <H3>Testing the connection</H3>
        <P>Use the <strong style={{ color: CD }}>Test Connection</strong> button inside the form. A successful test also loads the available LDAP attributes, which you can immediately add as JWT claim mappings.</P>
        <H3>Multiple servers</H3>
        <P>You can register multiple servers. At login, AO IDP tries each active server in order; the first successful authentication wins. This is useful for migrations or multi-domain environments.</P>
        <Note type="tip">For AD environments, use <Code>ldaps://</Code> on port 636 with a trusted certificate. Self-signed certs require adding the CA to the JVM truststore.</Note>
      </div>
    ),
  },
  {
    id: 'idp-users',
    title: 'User Lifecycle',
    content: (
      <div>
        <P>Users exist in your LDAP directory but must be explicitly <strong style={{ color: CD }}>activated</strong> in AO IDP before they can log in. This gives you fine-grained control over who can authenticate, independent of the directory.</P>
        <H3>Activating a user</H3>
        <Ul items={[
          'Go to Directory → find the user in the LDAP tree or search by name/email',
          'Open the user detail panel on the right',
          'Click Activate — an IDP account is created linked to their LDAP username',
          'The user can now log in to any application they have access to',
        ]} />
        <H3>Per-application access</H3>
        <P>After activation, access to individual applications must be granted separately. Go to <strong style={{ color: CD }}>Applications → [App Name] → Users</strong> and add the user.</P>
        <Note type="info">Users without app access will see "Bu tətbiqə girişiniz yoxdur" (access denied) on the login page even if their credentials are correct.</Note>
        <H3>Bulk import</H3>
        <P>Use the <strong style={{ color: CD }}>Import Users</strong> button in the Users page to activate multiple users from a CSV or from a selected LDAP OU.</P>
        <H3>Deactivation</H3>
        <P>Deactivating a user prevents new logins. Existing sessions and refresh tokens remain valid until they expire. To force immediate logout, also revoke their refresh tokens from the user detail panel.</P>
      </div>
    ),
  },
  {
    id: 'idp-apps',
    title: 'Registering Applications',
    content: (
      <div>
        <P>Every system that uses AO IDP for authentication must be registered as an <strong style={{ color: CD }}>Application</strong>.</P>
        <H3>Confidential client</H3>
        <P>Has a <Code>client_secret</Code>. Suitable for server-side apps (Spring Boot, Django, Express) where the secret can be kept private. The secret is hashed and shown only once at creation.</P>
        <H3>Public client</H3>
        <P>No secret. Must use PKCE. Suitable for SPAs (React, Vue, Angular) and native mobile apps where a secret cannot be kept safely.</P>
        <H3>Required fields</H3>
        <Ul items={[
          <><Code>Name</Code> — display name shown to users on the login page</>,
          <><Code>Redirect URIs</Code> — comma-separated list of allowed callback URLs after login (validated server-side)</>,
          <><Code>Post Logout Redirect URIs</Code> — allowed URLs after logout</>,
          <><Code>Allowed Origins</Code> — CORS origins for browser token requests (SPA/mobile only)</>,
        ]} />
        <H3>Disabling an app</H3>
        <P>Set the app to <em>inactive</em> in the Applications list. All logins for that <Code>client_id</Code> will fail with "Application is disabled".</P>
      </div>
    ),
  },
  {
    id: 'idp-claims',
    title: 'JWT Claim Mappings',
    content: (
      <div>
        <P>By default every JWT contains <Code>sub</Code> (user UUID), <Code>ldap_username</Code>, <Code>email</Code>, and <Code>display_name</Code>. Additional LDAP attributes can be mapped to custom claims per LDAP server.</P>
        <H3>Adding a claim mapping</H3>
        <Ul items={[
          'Go to Settings → JWT Claims and find the LDAP server',
          'Click an available attribute (loaded automatically if the server is active)',
          'Or click "+ add row" and type the LDAP attribute name and desired claim name',
          'Enable the toggle on the left, then click Save Claims',
        ]} />
        <H3>Example</H3>
        <Block>{`LDAP attribute: department
JWT claim:      department
Sample value:   Engineering

LDAP attribute: telephoneNumber
JWT claim:      phone
Sample value:   +994501234567`}</Block>
        <P>Mappings are per-server. If a user authenticates against a server with no claim mappings, only the default claims are included.</P>
        <Note type="tip">After saving, the next token issued for that user will include the new claims. No restart needed — changes are effective immediately.</Note>
      </div>
    ),
  },
  {
    id: 'idp-security',
    title: 'Security Settings',
    content: (
      <div>
        <P>Go to <strong style={{ color: CD }}>Settings → Security</strong> to configure brute-force protection, session timeouts, PKCE enforcement, and network restrictions.</P>
        <H3>Brute-force / lockout</H3>
        <Ul items={[
          'Max attempts — number of failed logins before lockout (default: 5)',
          'Window — time window in which the attempts are counted (default: 15 min)',
          'Duration — how long the account/IP is locked out (default: 30 min)',
          'Lockout is per username + IP pair, so locking one IP does not affect other IPs',
        ]} />
        <H3>Session timeouts</H3>
        <Ul items={[
          'Idle timeout — log out after N minutes of inactivity (default: 30 min)',
          'Absolute max — hard cap regardless of activity (default: 12 h)',
        ]} />
        <H3>PKCE</H3>
        <P>When enabled, public clients (SPAs, mobile apps) must send a valid <Code>code_challenge</Code> / <Code>code_verifier</Code> pair. Confidential clients using a client secret are exempt.</P>
        <H3>IP allowlist</H3>
        <P>Restrict admin panel access to specific CIDR ranges. Leave empty to allow all IPs. Separate multiple ranges with commas.</P>
        <Note type="warn">Force HTTPS should only be enabled when the server is running behind a TLS-terminating reverse proxy (Nginx, Caddy). Enabling it without HTTPS will break all logins.</Note>
      </div>
    ),
  },
  {
    id: 'idp-branding',
    title: 'Login Branding',
    content: (
      <div>
        <P>Go to <strong style={{ color: CD }}>Settings → Login Branding</strong> to customize the OAuth2 login page that all users see.</P>
        <H3>Basic settings</H3>
        <Ul items={[
          'Logo URL — shown above the login card (leave blank for the default lock icon)',
          'Welcome text — large heading inside the card',
          'Footer text — small text at the bottom of the page',
          'Primary / Background / Text colors — applied via CSS variables',
        ]} />
        <H3>Continue As panel</H3>
        <P>When enabled, returning users will see a "Continue as [Name]" card on the login page (like Google). This reads a profile cookie set after the previous login. Toggle it off if you want a clean login form every time.</P>
        <H3>Custom CSS</H3>
        <P>The Custom CSS field is injected at the end of the <Code>&lt;style&gt;</Code> tag on the login page, after all default styles. You can override any class.</P>
        <Ul items={[
          <>Use the <strong style={{ color: CD }}>orange theme</strong> or <strong style={{ color: CD }}>dark theme</strong> template buttons to load a complete ready-made design</>,
          'All standard classes are available: .card, .btn, .field input, .hd-dot, .app-banner, etc.',
          'Changes are effective on the next page load (no restart required)',
        ]} />
        <Note type="tip">After pasting CSS, click "Preview Login Page" to open <Code>/login</Code> in a new tab and see the result live.</Note>
      </div>
    ),
  },
  {
    id: 'idp-audit',
    title: 'Audit Logs',
    content: (
      <div>
        <P>Every significant event in AO IDP is written to the audit log. Go to <strong style={{ color: CD }}>Audit</strong> in the sidebar to query, filter, and export logs.</P>
        <H3>Logged events</H3>
        <Ul items={[
          'User login (success + failure with reason)',
          'Token exchange, refresh, revocation',
          'User activation / deactivation',
          'Application create / update / delete',
          'LDAP config create / update / delete',
          'Admin login, logout, password change',
          'Settings updates',
        ]} />
        <H3>Retention</H3>
        <P>Logs older than the configured retention period (default 10 days) are automatically deleted at 03:00 UTC daily. Change the retention in Settings → Login Settings.</P>
        <H3>Export</H3>
        <P>Use the Export button in the Audit page to download logs as CSV. Filter by actor, event type, or date range before exporting.</P>
      </div>
    ),
  },
  {
    id: 'idp-admins',
    title: 'Admin Roles',
    content: (
      <div>
        <P>AO IDP has two admin roles:</P>
        <H3>idp_admin</H3>
        <P>Full unrestricted access to all sections: users, applications, LDAP, settings, audit, logs, and docs. Can create and manage other admin accounts.</P>
        <H3>app_admin</H3>
        <P>Scoped access. An <Code>idp_admin</Code> grants specific sections per admin account. Permissions are enforced both in the sidebar (sections hidden if not granted) and on the API (returns 403 if the token lacks the required scope).</P>
        <H3>Creating an admin</H3>
        <Block>{`Settings → Management → Admins → "+ Create Admin"
Fill in: username, display name, initial password, role
For app_admin: select which sections to grant`}</Block>
        <H3>Password policy</H3>
        <P>Admin passwords are bcrypt-hashed. Admins can change their own password via the profile menu (top right). <Code>idp_admin</Code> can reset any admin's password.</P>
      </div>
    ),
  },
]

// ─────────────────────────────────────────────
//  OAUTH2 INTEGRATION SECTIONS
// ─────────────────────────────────────────────
const oauth2Sections: Section[] = [
  {
    id: 'oauth-quickstart',
    title: 'Quick Start',
    content: (
      <div>
        <P>Integrate any application with AO IDP in under 5 minutes using the OIDC discovery document.</P>
        <H3>1. Register your app</H3>
        <P>Create an Application in the admin panel. Note the <Code>client_id</Code> and (for confidential clients) the <Code>client_secret</Code>.</P>
        <H3>2. Point your library at the discovery URL</H3>
        <Block title="Spring Boot">{`spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://auth.company.com
# That's it — Spring auto-fetches JWKS and validates tokens.`}</Block>
        <Block title="Node.js (passport-jwt / jose)">{`import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS = createRemoteJWKSet(
  new URL('https://auth.company.com/jwks')
)

async function verify(token) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'https://auth.company.com',
    audience: 'your-client-id',
  })
  return payload
}`}</Block>
        <Block title="Python (python-jose)">{`from jose import jwt, jwk
import requests

jwks = requests.get('https://auth.company.com/jwks').json()
keys = {k['kid']: jwk.construct(k) for k in jwks['keys']}

def verify(token):
    header = jwt.get_unverified_header(token)
    key = keys[header['kid']]
    return jwt.decode(token, key, algorithms=['RS256'],
                      audience='your-client-id',
                      issuer='https://auth.company.com')`}</Block>
        <Note type="tip">Use the OIDC discovery document at <Code>/.well-known/openid-configuration</Code> to auto-configure any standard OIDC library. Most libraries accept a single <Code>issuer-uri</Code>.</Note>
      </div>
    ),
  },
  {
    id: 'oauth-discovery',
    title: 'Discovery & JWKS',
    content: (
      <div>
        <P>AO IDP exposes two standard endpoints for automatic client configuration:</P>
        <H3>OIDC Discovery Document</H3>
        <Block>{`GET /.well-known/openid-configuration`}</Block>
        <Block title="Response">{`{
  "issuer": "https://auth.company.com",
  "authorization_endpoint": "https://auth.company.com/oauth2/authorize",
  "token_endpoint": "https://auth.company.com/oauth2/token",
  "userinfo_endpoint": "https://auth.company.com/oauth2/userinfo",
  "jwks_uri": "https://auth.company.com/jwks",
  "end_session_endpoint": "https://auth.company.com/oauth2/logout",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "code_challenge_methods_supported": ["S256"]
}`}</Block>
        <H3>JWKS Endpoint</H3>
        <Block>{`GET /jwks`}</Block>
        <P>Returns the RSA public key(s) used to sign JWTs. Resource servers fetch this once (or cache it) and use the keys to verify tokens locally — no call to the IDP is needed per request.</P>
        <Note type="info">Keys are identified by <Code>kid</Code> (Key ID) in the JWT header. The JWKS endpoint may serve multiple keys during key rotation. Your JWT library should select the right key by matching <Code>kid</Code>.</Note>
      </div>
    ),
  },
  {
    id: 'oauth-authcode',
    title: 'Authorization Code + PKCE',
    content: (
      <div>
        <P>The Authorization Code flow with PKCE is the recommended flow for all client types.</P>
        <H3>Step 1 — Generate PKCE pair</H3>
        <Block title="JavaScript">{`// 1. Generate code_verifier (43-128 random chars)
const verifier = crypto.randomUUID().replace(/-/g, '') +
                 crypto.randomUUID().replace(/-/g, '')

// 2. Compute code_challenge = BASE64URL(SHA256(verifier))
const digest = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(verifier)
)
const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')`}</Block>
        <H3>Step 2 — Redirect to authorization endpoint</H3>
        <Block>{`GET /oauth2/authorize
  ?client_id=your-client-id
  &redirect_uri=https://app.example.com/callback
  &response_type=code
  &state=RANDOM_STATE_VALUE
  &scope=openid profile
  &code_challenge=BASE64URL_SHA256_OF_VERIFIER
  &code_challenge_method=S256`}</Block>
        <P>The user is shown the login page. After successful authentication they are redirected to your <Code>redirect_uri</Code> with <Code>?code=AUTH_CODE&state=RANDOM_STATE_VALUE</Code>.</P>
        <Note type="warn">Always verify the <Code>state</Code> parameter matches what you sent. This prevents CSRF attacks.</Note>
        <H3>Step 3 — Exchange code for tokens</H3>
        <Block>{`POST /oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=AUTH_CODE
&redirect_uri=https://app.example.com/callback
&client_id=your-client-id
&code_verifier=ORIGINAL_VERIFIER    ← PKCE
# For confidential clients, omit code_verifier and use:
# &client_secret=YOUR_SECRET`}</Block>
        <Block title="Success response">{`{
  "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ii4uLiJ9...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "4a7b3c2d...",
  "scope": "openid profile"
}`}</Block>
      </div>
    ),
  },
  {
    id: 'oauth-tokens',
    title: 'Token Management',
    content: (
      <div>
        <P>AO IDP issues RS256-signed JWTs as access tokens. They are stateless — resource servers verify them locally using the public key from <Code>/jwks</Code>.</P>
        <H3>Access token payload</H3>
        <Block>{`{
  "sub": "550e8400-e29b-41d4-a716-446655440000",  // User UUID
  "iss": "https://auth.company.com",
  "aud": "your-client-id",
  "iat": 1716000000,
  "exp": 1716000900,
  "jti": "unique-token-id",
  "ldap_username": "jsmith",
  "email": "jsmith@company.com",
  "display_name": "John Smith",
  // ... any extra claims from JWT Claim Mappings
  "department": "Engineering"
}`}</Block>
        <H3>Refreshing the access token</H3>
        <Block>{`POST /oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=4a7b3c2d...
&client_id=your-client-id
# &client_secret=YOUR_SECRET  ← confidential clients only`}</Block>
        <H3>Revoking a token (RFC 7009)</H3>
        <Block>{`POST /oauth2/token/revoke
Content-Type: application/x-www-form-urlencoded

token=REFRESH_TOKEN
&token_type_hint=refresh_token
&client_id=your-client-id
&client_secret=YOUR_SECRET`}</Block>
        <P>Returns <Code>200 OK</Code> even if the token was already expired or invalid (per RFC 7009 §2.2).</P>
        <Note type="info">Access token expiry is configurable in Settings → Token Expiry (default 15 minutes). Refresh token expiry defaults to 7 days. Store refresh tokens securely — they are equivalent to credentials.</Note>
      </div>
    ),
  },
  {
    id: 'oauth-validate',
    title: 'Validating Tokens',
    content: (
      <div>
        <P>Resource servers (your APIs) must validate every incoming access token. Validation is entirely local — no network call to the IDP needed per request.</P>
        <H3>Validation checklist</H3>
        <Ul items={[
          <><Code>alg</Code> — must be <Code>RS256</Code> (reject HS256 or "none")</>,
          <>Signature — verify using the public key matching <Code>kid</Code> from <Code>/jwks</Code></>,
          <><Code>exp</Code> — must be in the future</>,
          <><Code>iss</Code> — must equal your IDP base URL</>,
          <><Code>aud</Code> — must contain your <Code>client_id</Code></>,
        ]} />
        <H3>Spring Boot (auto-config)</H3>
        <Block>{`# application.yml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://auth.company.com
          # Spring fetches JWKS automatically and caches it.`}</Block>
        <H3>Manual validation (Node.js)</H3>
        <Block>{`import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS = createRemoteJWKSet(
  new URL('https://auth.company.com/jwks')
)

export async function authenticate(req, res, next) {
  const auth = req.headers.authorization ?? ''
  if (!auth.startsWith('Bearer ')) return res.status(401).end()
  try {
    const { payload } = await jwtVerify(auth.slice(7), JWKS, {
      issuer: 'https://auth.company.com',
      audience: 'your-client-id',
    })
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'invalid_token' })
  }
}`}</Block>
        <H3>JWKS caching</H3>
        <P>Fetch and cache the JWKS at startup. Only re-fetch when a token presents an unknown <Code>kid</Code> — this handles key rotation gracefully without re-fetching on every request.</P>
      </div>
    ),
  },
  {
    id: 'oauth-userinfo',
    title: 'UserInfo Endpoint',
    content: (
      <div>
        <P>Fetch identity claims for the authenticated user using their access token. Useful when you need up-to-date data without decoding the JWT.</P>
        <Block>{`GET /oauth2/userinfo
Authorization: Bearer ACCESS_TOKEN`}</Block>
        <Block title="Response">{`{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "ldap_username": "jsmith",
  "email": "jsmith@company.com",
  "display_name": "John Smith"
}`}</Block>
        <Note type="info">The userinfo response contains the same claims as the access token. Prefer reading claims from the JWT directly (no network call) unless you need to guarantee freshness after a user update.</Note>
      </div>
    ),
  },
  {
    id: 'oauth-logout',
    title: 'Logout / End Session',
    content: (
      <div>
        <P>AO IDP supports RP-initiated logout per the OIDC Session Management spec.</P>
        <H3>Browser redirect logout (recommended)</H3>
        <P>Redirect the user's browser to end the IDP session. This clears the SSO session cookie so other apps won't be auto-logged in.</P>
        <Block>{`GET /oauth2/logout
  ?client_id=your-client-id
  &post_logout_redirect_uri=https://app.example.com/logged-out
  &id_token_hint=PREVIOUSLY_ISSUED_ID_TOKEN`}</Block>
        <P>The <Code>post_logout_redirect_uri</Code> must be registered in the application's Post Logout Redirect URIs. The IDP validates it before redirecting.</P>
        <H3>API logout (no browser redirect)</H3>
        <Block>{`POST /oauth2/logout
Content-Type: application/x-www-form-urlencoded

refresh_token=REFRESH_TOKEN
&client_id=your-client-id`}</Block>
        <P>Invalidates the refresh token and the session. Use this from a server-side endpoint when you want to log the user out programmatically.</P>
        <Note type="tip">Always revoke the refresh token on logout, even for browser-redirect logout flows. Otherwise the token remains valid until it expires.</Note>
      </div>
    ),
  },
  {
    id: 'oauth-prompt-login',
    title: 'prompt=login',
    content: (
      <div>
        <P><Code>prompt=login</Code> is an OIDC Core §3.1.2.1 parameter that forces the IDP to skip the existing SSO session and show the login page — even when the user is already authenticated.</P>
        <H3>When to use</H3>
        <Ul items={[
          'After your app clears its own local session without calling IDP logout',
          'Before sensitive operations requiring fresh credential confirmation',
          'When the user clicks "Sign in with a different account" in your UI',
          'After a long period of inactivity in your app (regardless of IDP session state)',
        ]} />
        <H3>How to add it</H3>
        <Block>{`GET /oauth2/authorize
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.example.com/callback
  &response_type=code
  &scope=openid profile
  &state=RANDOM_STATE
  &code_challenge=BASE64URL_ENCODED_CHALLENGE
  &code_challenge_method=S256
  &prompt=login`}</Block>
        <P>The existing IDP session is <strong style={{ color: CD }}>NOT destroyed</strong> — its auto-authorization is only bypassed for this request. After re-authentication a fresh session is created; the old one expires naturally.</P>
        <Note type="warn"><strong>Important:</strong> <Code>prompt=login</Code> bypasses the SSO session but does NOT prevent passwordless continue-as. If the user has a stored remember token, they will still see the one-click panel and can authenticate without typing a password. If you truly require explicit credential entry, implement a re-auth step in your own UI.</Note>
        <H3>Recommended logout patterns</H3>
        <Block title="Option A — browser redirect logout (preferred)">{`# Clears the IDP session cookie. Remember token survives
# (user can still click continue-as on next visit).
GET /oauth2/logout
  ?client_id=YOUR_CLIENT_ID
  &post_logout_redirect_uri=https://yourapp.example.com/signed-out`}</Block>
        <Block title="Option B — prompt=login only">{`# Use when you cannot do a browser redirect (API-only context).
# The user will see the Continue As panel (passwordless available).
GET /oauth2/authorize?...&prompt=login`}</Block>
        <Block title="Option C — redirect logout then prompt=login">{`# Step 1: redirect to logout → user lands on your /signed-out page
GET /oauth2/logout?...&post_logout_redirect_uri=https://app/re-auth

# Step 2: from /re-auth, redirect to authorize with prompt=login
GET /oauth2/authorize?...&prompt=login`}</Block>
        <H3>JavaScript example</H3>
        <Block title="React / SPA — force re-auth">{`function forceReAuth() {
  const verifier = generateCodeVerifier()    // store in sessionStorage
  const challenge = await computeChallenge(verifier)

  const params = new URLSearchParams({
    client_id:             'YOUR_CLIENT_ID',
    redirect_uri:          window.location.origin + '/callback',
    response_type:         'code',
    scope:                 'openid profile',
    state:                 crypto.randomUUID(),
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    prompt:                'login',           // ← force re-auth
  })
  window.location.href = 'https://auth.company.com/oauth2/authorize?' + params
}`}</Block>
      </div>
    ),
  },
  {
    id: 'oauth-continue-as',
    title: 'Passwordless Continue As',
    content: (
      <div>
        <P>AO IDP stores a <strong style={{ color: CD }}>remember token</strong> in the browser after every successful login. On the next visit, stored accounts appear as one-click cards — no password required. This works even after the SSO session has expired.</P>
        <H3>How it works</H3>
        <Ul items={[
          'User logs in with username + password → IDP issues a 48-byte remember token',
          'Raw token stored in the ao-user cookie (not HttpOnly); SHA-256 hash stored in DB with 30-day TTL',
          'Next visit: login page reads the cookie, renders stored accounts',
          'User clicks an account → browser submits POST /oauth2/continue-as with the raw token',
          'IDP hashes the token, finds the match, rotates it (old invalidated, new issued), creates session',
          'Auth code issued → user is logged in. Zero password interaction.',
        ]} />
        <H3>/oauth2/continue-as endpoint</H3>
        <Block>{`POST /oauth2/continue-as
Content-Type: application/x-www-form-urlencoded

remember_token=RAW_48_BYTE_TOKEN
client_id=YOUR_CLIENT_ID
redirect_uri=https://yourapp.example.com/callback
state=RANDOM_STATE
scope=openid%20profile
code_challenge=BASE64URL_CHALLENGE
code_challenge_method=S256`}</Block>
        <Block title="Success (OAuth2 flow)">{`HTTP 302 → https://yourapp.example.com/callback?code=AUTH_CODE&state=STATE
# Token exchange is identical to a normal login`}</Block>
        <Block title="Failure — token expired or invalid">{`HTTP 302 → /login?error=Sessiya+müddəti+bitib...&client_id=...
# User is shown the normal login form`}</Block>
        <H3>Security properties</H3>
        <Ul items={[
          '384-bit random token — unguessable, no rate limiting needed',
          'DB stores only the SHA-256 hash — cookie theft does not expose DB values',
          'Token rotation on each use — replaying a used token fails immediately',
          'Logout clears the SSO session but preserves remember tokens (Google-style)',
          'Removing an account in the UI deletes it from the cookie; server token expires naturally after 30 days',
        ]} />
        <H3>ao-user cookie format</H3>
        <Block>{`# Base64url-encoded JSON array (up to 5 accounts)
[
  { "u": "jsmith",  "n": "John Smith",  "rt": "BASE64URL_REMEMBER_TOKEN" },
  { "u": "ajones",  "n": "Alice Jones", "rt": "BASE64URL_REMEMBER_TOKEN" }
]

# Accounts without rt (old format or manual edits) fall back
# to the password-only view when clicked.`}</Block>
        <Note type="tip">You do not need to implement anything to support this — it is handled entirely by the IDP login page. Your app's callback and token exchange code is unchanged. If a user uses continue-as, the resulting auth code and tokens are identical to a normal login.</Note>
        <Note type="warn">The ao-user cookie is readable by JavaScript (not HttpOnly). If your deployment has strict XSS risks, disable the Continue As panel in Settings → Login Branding — this prevents remember tokens from being issued and clears the stored profiles.</Note>
      </div>
    ),
  },
  {
    id: 'oauth-sso',
    title: 'Single Sign-On (SSO)',
    content: (
      <div>
        <P>AO IDP provides SSO across all registered applications via an <strong style={{ color: CD }}>HttpOnly session cookie</strong> set on the IDP domain.</P>
        <H3>How it works</H3>
        <Ul items={[
          'User logs into App A — IDP sets a session cookie on the IDP domain',
          'User navigates to App B and clicks "Sign In"',
          "App B redirects to /oauth2/authorize — IDP detects the session cookie",
          'IDP immediately issues an authorization code and redirects back — no login form shown',
          'App B exchanges the code for tokens — user is logged in transparently',
        ]} />
        <H3>Requirements</H3>
        <Ul items={[
          <>All apps must redirect to the <strong>same IDP domain</strong> for authentication</>,
          <>The <Code>IDP_COOKIE_DOMAIN</Code> must be set to a parent domain (e.g. <Code>.company.com</Code>) if apps are on different subdomains</>,
          'Apps must correctly implement the authorization code flow (not store tokens in URLs)',
        ]} />
        <H3>Continue As — passwordless one-click login</H3>
        <P>When the SSO session has expired but the user has a profile cookie with a remember token, the login page shows stored accounts. Clicking an account submits instantly — <strong style={{ color: CD }}>no password required</strong>. This is powered by a 30-day remember token (hashed in the DB) that rotates on each use. Enable/disable the panel in Settings → Login Branding.</P>
        <Note type="info">The SSO session is separate from the access token. A user can have a valid SSO session (no login form shown) but their access tokens may have expired and need refreshing separately.</Note>
      </div>
    ),
  },
  {
    id: 'oauth-errors',
    title: 'Error Reference',
    content: (
      <div>
        <P>AO IDP returns standard OAuth 2.0 error responses.</P>
        <H3>Authorization endpoint errors (redirect)</H3>
        <Block>{`https://app.example.com/callback
  ?error=unsupported_response_type
  &state=YOUR_STATE

# Other error codes:
# invalid_client — unknown client_id
# invalid_request — missing required parameter`}</Block>
        <H3>Token endpoint errors (JSON)</H3>
        <Block>{`{
  "error": "invalid_grant",
  "error_description": "Invalid or expired authorization code"
}

# Other codes:
# invalid_client      — wrong client_id / client_secret
# invalid_token       — bad/expired refresh token
# pkce_failed         — code_verifier does not match code_challenge
# unsupported_grant_type`}</Block>
        <H3>Resource server errors</H3>
        <Block>{`HTTP 401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token",
  error_description="Token has expired"

# Causes:
# expired access token → use refresh_token to get a new one
# wrong audience (aud) → check client_id matches
# wrong issuer (iss)   → check IDP_ISSUER env var`}</Block>
        <H3>Login page errors</H3>
        <Ul items={[
          '"İstifadəçi adı və ya şifrə yanlışdır" — invalid credentials',
          '"Hesab aktivləşdirilməyib" — user not activated in AO IDP',
          '"Bu tətbiqə girişiniz yoxdur" — no access granted to this application',
          '"Too many failed attempts" — brute-force lockout active',
        ]} />
      </div>
    ),
  },
]

// ─────────────────────────────────────────────
//  Markdown export helper
// ─────────────────────────────────────────────
function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: React.ReactNode; title?: string; items?: React.ReactNode[]; type?: string }>
    const inner = extractText(el.props.children)

    // Handle known custom components by identity
    if (el.type === H3) return '\n\n### ' + inner.trim() + '\n'
    if (el.type === P)  return '\n' + inner + '\n'
    if (el.type === Block) {
      const t = el.props.title
      const fence = t ? `\n\`\`\`\n# ${t}\n${inner.trim()}\n\`\`\`\n` : `\n\`\`\`\n${inner.trim()}\n\`\`\`\n`
      return fence
    }
    if (el.type === Note) {
      return '\n> ' + inner.trim().replace(/\n/g, '\n> ') + '\n'
    }
    if (el.type === Ul) {
      const items = el.props.items ?? []
      return '\n' + (items as React.ReactNode[]).map(i => '- ' + extractText(i).trim()).join('\n') + '\n'
    }
    if (el.type === Code) return '`' + inner + '`'

    // Native HTML tags
    const tag = typeof el.type === 'string' ? el.type : ''
    if (tag === 'pre')    return '\n```\n' + inner + '\n```\n'
    if (tag === 'code')   return '`' + inner + '`'
    if (tag === 'li')     return '- ' + inner.trim()
    if (tag === 'ul' || tag === 'ol') return inner + '\n'
    if (tag === 'p')      return inner + '\n'
    if (tag === 'strong' || tag === 'b') return '**' + inner + '**'
    if (tag === 'em')     return '_' + inner + '_'
    if (inner)            return inner
  }
  return ''
}

function buildMarkdown(book: 'idp' | 'oauth2'): string {
  const secs = book === 'idp' ? idpSections : oauth2Sections
  const title = book === 'idp' ? '# AO IDP — Server & Operations Guide\n\n' : '# AO IDP — OAuth2 Integration Guide\n\n'
  return title + secs.map(s => {
    const body = extractText(s.content).replace(/\n{3,}/g, '\n\n').trim()
    return `## ${s.title}\n\n${body}`
  }).join('\n\n---\n\n')
}

function exportDocs(book: 'idp' | 'oauth2') {
  const md = buildMarkdown(book)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = book === 'idp' ? 'ao-idp-server-guide.md' : 'ao-idp-oauth2-integration.md'
  a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export default function DocsPage() {
  const [book, setBook] = useState<'idp' | 'oauth2'>('idp')
  const sections = book === 'idp' ? idpSections : oauth2Sections
  const [active, setActive] = useState(sections[0].id)

  // Reset active section when switching books
  const switchBook = (b: 'idp' | 'oauth2') => {
    setBook(b)
    setActive(b === 'idp' ? idpSections[0].id : oauth2Sections[0].id)
  }

  const currentSections = book === 'idp' ? idpSections : oauth2Sections
  const current = currentSections.find(s => s.id === active)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '0.625rem', color: CB, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>reference</div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: C, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{'> '}documentation</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => exportDocs(book)}
            style={{
              padding: '0.45rem 0.9rem', background: 'transparent',
              border: `1px solid ${BORDER}`, color: CM,
              fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            }}
            title="Export current guide as Markdown"
          >
            ↓ export .md
          </button>
        </div>
      </div>

      {/* Book selector */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.5rem', border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden', alignSelf: 'flex-start', width: 'fit-content' }}>
        {([
          { key: 'idp',    label: '⚙ IDP Server Guide',      hint: 'Setup, config, users, apps, security' },
          { key: 'oauth2', label: '🔗 OAuth2 Integration',    hint: 'Complete guide for app developers' },
        ] as const).map(({ key, label, hint }) => (
          <button
            key={key}
            onClick={() => switchBook(key)}
            title={hint}
            style={{
              padding: '0.6rem 1.4rem', background: book === key ? C : 'transparent',
              border: 'none', color: book === key ? 'var(--bg)' : CM,
              fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: book === key ? 700 : 400,
              letterSpacing: '0.05em', cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        {/* Sidebar nav */}
        <nav style={{ flexShrink: 0, width: 180 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {currentSections.map(s => (
              <button key={s.id} onClick={() => setActive(s.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem',
                  fontSize: '0.75rem', letterSpacing: '0.03em',
                  color: active === s.id ? 'var(--bg)' : CM,
                  background: active === s.id ? C : 'transparent',
                  border: 'none', cursor: 'pointer', borderRadius: 4,
                  transition: 'all 0.1s',
                }}>
                {active === s.id ? '› ' : '  '}{s.title}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, border: `1px solid ${BORDER}`, padding: '1.5rem', background: SURFACE, borderRadius: 5 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '1rem', color: C }}>
            {'// '}{current?.title}
          </div>
          <div>{current?.content}</div>
        </div>
      </div>
    </div>
  )
}
