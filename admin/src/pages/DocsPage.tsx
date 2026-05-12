import React, { useState } from 'react'

const C = 'var(--accent)'
const CD = 'var(--accent-strong)'
const CM = 'var(--text-dim)'
const CB = 'var(--text-muted)'
const BORDER = 'rgba(94,234,212,0.2)'
const SURFACE = 'var(--surface-1)'
const SURFACE2 = 'var(--surface-2)'
const AMBER = '#fbbf24'
const GREEN = '#34d399'
const RED = '#f87171'

interface Section {
  id: string
  title: string
  group: string
  content: React.ReactNode
}

function Code({ children }: { children: string }) {
  return (
    <code style={{ background: SURFACE2, color: CD, border: `1px solid ${BORDER}`, padding: '1px 6px', fontSize: '0.78rem', fontFamily: 'inherit', borderRadius: 2 }}>
      {children}
    </code>
  )
}

function Block({ children, lang }: { children: string; lang?: string }) {
  return (
    <div style={{ margin: '0.75rem 0', position: 'relative' }}>
      {lang && (
        <div style={{ fontSize: '0.6rem', color: CB, background: SURFACE2, border: `1px solid ${BORDER}`, borderBottom: 'none', padding: '2px 8px', display: 'inline-block', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{lang}</div>
      )}
      <pre style={{ background: SURFACE2, border: `1px solid ${BORDER}`, padding: '0.9rem 1rem', fontSize: '0.78rem', color: CD, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, fontFamily: 'inherit' }}>
        {children}
      </pre>
    </div>
  )
}

function H3({ children }: { children: string }) {
  return <div className="text-xs font-bold tracking-widest uppercase mt-5 mb-2" style={{ color: C }}>{children}</div>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed mb-2" style={{ color: CM }}>{children}</p>
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${AMBER}33`, background: `${AMBER}08`, padding: '0.6rem 0.9rem', margin: '0.75rem 0', fontSize: '0.75rem', color: AMBER, lineHeight: 1.6 }}>
      <span style={{ fontWeight: 700, letterSpacing: '0.08em' }}>NOTE  </span>{children}
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${GREEN}33`, background: `${GREEN}08`, padding: '0.6rem 0.9rem', margin: '0.75rem 0', fontSize: '0.75rem', color: GREEN, lineHeight: 1.6 }}>
      <span style={{ fontWeight: 700, letterSpacing: '0.08em' }}>TIP  </span>{children}
    </div>
  )
}

function Table({ rows }: { rows: [string, string, string?][] }) {
  return (
    <div style={{ border: `1px solid ${BORDER}`, fontSize: '0.75rem', margin: '0.75rem 0', overflow: 'hidden' }}>
      {rows.map(([col1, col2, col3], i) => {
        const isHeader = i === 0
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: col3 !== undefined ? '1.2fr 1fr 2fr' : '1.2fr 2fr',
            borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : 'none',
            background: isHeader ? SURFACE2 : (i % 2 === 0 ? 'transparent' : `${SURFACE2}55`),
          }}>
            <div style={{ padding: '5px 10px', color: isHeader ? C : CD, fontWeight: isHeader ? 700 : 400, letterSpacing: isHeader ? '0.06em' : 0, textTransform: isHeader ? 'uppercase' : 'none', fontSize: isHeader ? '0.65rem' : '0.75rem', borderRight: `1px solid ${BORDER}` }}>{col1}</div>
            <div style={{ padding: '5px 10px', color: isHeader ? C : CM, fontWeight: isHeader ? 700 : 400, letterSpacing: isHeader ? '0.06em' : 0, textTransform: isHeader ? 'uppercase' : 'none', fontSize: isHeader ? '0.65rem' : '0.75rem', borderRight: col3 !== undefined ? `1px solid ${BORDER}` : 'none' }}>{col2}</div>
            {col3 !== undefined && <div style={{ padding: '5px 10px', color: isHeader ? C : CB, fontWeight: isHeader ? 700 : 400, letterSpacing: isHeader ? '0.06em' : 0, textTransform: isHeader ? 'uppercase' : 'none', fontSize: isHeader ? '0.65rem' : '0.75rem' }}>{col3}</div>}
          </div>
        )
      })}
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: `${color}18`, color, border: `1px solid ${color}44`, padding: '1px 7px', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 6 }}>
      {label}
    </span>
  )
}

const sections: Section[] = [
  // ─── GETTING STARTED ────────────────────────────────────────────────────────
  {
    id: 'overview',
    title: 'Overview',
    group: 'Getting Started',
    content: (
      <div>
        <P>AO IDP is a self-hosted OpenID Connect (OIDC) and OAuth 2.0 Identity Provider. It authenticates users against your LDAP/Active Directory, issues signed JWTs, and manages per-application access control from a single admin panel.</P>
        <H3>Key capabilities</H3>
        <ul className="text-xs space-y-1 mb-3" style={{ color: CM, listStyle: 'none', padding: 0 }}>
          {[
            '✓ Authorization Code flow with PKCE (RFC 6749 / RFC 7636)',
            '✓ LDAP / Active Directory multi-server authentication',
            '✓ Per-application user access control (grant / revoke)',
            '✓ RS256-signed access tokens + refresh tokens + ID tokens',
            '✓ JWKS endpoint for public key distribution',
            '✓ OpenID Connect Discovery (/.well-known/openid-configuration)',
            '✓ Configurable JWT claim mappings from LDAP attributes',
            '✓ RP-initiated logout with post_logout_redirect_uri validation',
            '✓ Token revocation endpoint (RFC 7009)',
            '✓ Admin panel with idp_admin / app_admin RBAC',
            '✓ Full audit log for all admin and user events',
            '✓ Live structured log viewer',
          ].map(item => <li key={item}>{item}</li>)}
        </ul>
        <H3>Architecture</H3>
        <P>AO IDP runs as a single Docker container bundling PostgreSQL 16 (data store), Spring Boot 3 (API + OIDC engine), and the React admin UI (served from <Code>/admin</Code>). Nginx is used as a reverse proxy in front.</P>
        <Table rows={[
          ['Component', 'Technology', 'Notes'],
          ['Auth engine', 'Spring Boot 3 / Java 21', 'OIDC / OAuth2 endpoints'],
          ['Database', 'PostgreSQL 16', 'Embedded in container'],
          ['Admin UI', 'React + Vite', 'Served at /admin path'],
          ['Token signing', 'RS256 (RSA 2048)', 'Key auto-generated on first run'],
          ['Directory', 'LDAP / Active Directory', 'Multi-server supported'],
        ]} />
        <H3>Default ports</H3>
        <Table rows={[
          ['Port', 'Description'],
          ['7000', 'HTTP — Spring Boot application'],
          ['5432', 'PostgreSQL (internal, not exposed by default)'],
        ]} />
      </div>
    ),
  },
  {
    id: 'quickstart',
    title: 'Quick Start',
    group: 'Getting Started',
    content: (
      <div>
        <P>Integrate your application with AO IDP in five steps.</P>

        <H3>Step 1 — Register the application</H3>
        <P>Go to <strong style={{ color: CD }}>Admin → Applications → New Application</strong>. Set:</P>
        <ul className="text-xs space-y-1 mb-3" style={{ color: CM, listStyle: 'none', padding: 0 }}>
          <li>• <strong style={{ color: CD }}>Name</strong> — human-readable label</li>
          <li>• <strong style={{ color: CD }}>Slug</strong> — short identifier (letters/numbers/dashes)</li>
          <li>• <strong style={{ color: CD }}>Redirect URIs</strong> — one per line, exact match after login</li>
          <li>• <strong style={{ color: CD }}>Post Logout Redirect URIs</strong> — allowed URLs after logout</li>
          <li>• <strong style={{ color: CD }}>Public Client</strong> — enable for SPAs/mobile (PKCE, no secret)</li>
        </ul>
        <P>On creation you receive a <Code>client_id</Code> and (for confidential clients) a <Code>client_secret</Code>. The secret is shown only once — copy it immediately.</P>

        <H3>Step 2 — Grant users access</H3>
        <P>Users must be <em>activated</em> in the IDP and <em>granted access</em> to your application before they can log in. Go to <strong style={{ color: CD }}>Directory</strong>, find the user, and click <strong style={{ color: CD }}>Activate &amp; Grant</strong>. Or use <strong style={{ color: CD }}>Applications → [app] → Users</strong> to manage access in bulk.</P>

        <H3>Step 3 — Fetch discovery metadata</H3>
        <Block lang="http">{`GET /.well-known/openid-configuration`}</Block>
        <P>This returns all endpoint URLs, supported scopes, signing algorithms, and more. Most OIDC libraries consume this automatically.</P>

        <H3>Step 4 — Initiate the login flow</H3>
        <Block lang="http">{`GET /oauth2/authorize
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=https://your-app.example.com/callback
  &response_type=code
  &state=RANDOM_STATE
  &scope=openid profile
  &code_challenge=BASE64URL(SHA256(code_verifier))
  &code_challenge_method=S256`}</Block>
        <Tip>Generate <Code>code_verifier</Code> as 43–128 random URL-safe chars. Derive <Code>code_challenge</Code> as <Code>BASE64URL(SHA256(code_verifier))</Code>. Store <Code>state</Code> and <Code>code_verifier</Code> in session storage.</Tip>

        <H3>Step 5 — Exchange the code for tokens</H3>
        <Block lang="http">{`POST /oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=AUTH_CODE
&redirect_uri=https://your-app.example.com/callback
&client_id=YOUR_CLIENT_ID
&code_verifier=YOUR_CODE_VERIFIER`}</Block>
        <P>Validate the <Code>state</Code> parameter before exchanging. Store the <Code>access_token</Code> for API calls and the <Code>refresh_token</Code> for silent renewal.</P>
      </div>
    ),
  },
  {
    id: 'discovery',
    title: 'Discovery Endpoint',
    group: 'Getting Started',
    content: (
      <div>
        <P>AO IDP exposes an OpenID Connect Discovery document at the standard well-known URL. OIDC-compliant libraries use this to auto-configure themselves.</P>
        <Block lang="http">{`GET /.well-known/openid-configuration`}</Block>
        <H3>Response (example)</H3>
        <Block lang="json">{`{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/oauth2/authorize",
  "token_endpoint": "https://auth.example.com/oauth2/token",
  "userinfo_endpoint": "https://auth.example.com/oauth2/userinfo",
  "end_session_endpoint": "https://auth.example.com/oauth2/logout",
  "revocation_endpoint": "https://auth.example.com/oauth2/token/revoke",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "response_types_supported": ["code"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": ["openid", "profile", "email"],
  "token_endpoint_auth_methods_supported": ["client_secret_post", "none"],
  "code_challenge_methods_supported": ["S256"],
  "claims_supported": ["sub", "iss", "aud", "exp", "iat",
    "ldap_username", "email", "display_name"]
}`}</Block>
        <Note>The <Code>issuer</Code> value is controlled by the <Code>IDP_ISSUER</Code> environment variable. Set it to the public base URL of your IDP deployment.</Note>
      </div>
    ),
  },

  // ─── OAUTH2 / OIDC ──────────────────────────────────────────────────────────
  {
    id: 'oidc-flow',
    title: 'Authorization Code Flow',
    group: 'OAuth2 / OIDC',
    content: (
      <div>
        <P>The Authorization Code flow is the only grant type supported. It is always combined with PKCE for public clients and optionally with a <Code>client_secret</Code> for confidential clients.</P>
        <H3>Authorization request</H3>
        <Block lang="http">{`GET /oauth2/authorize
  ?client_id=<client_id>
  &redirect_uri=https://app.example.com/callback
  &response_type=code
  &state=<csrf_token>
  &scope=openid profile email
  &code_challenge=<S256_challenge>
  &code_challenge_method=S256`}</Block>
        <Table rows={[
          ['Parameter', 'Required', 'Description'],
          ['client_id', 'yes', 'Issued at application registration'],
          ['redirect_uri', 'yes', 'Must exactly match a registered URI'],
          ['response_type', 'yes', 'Must be "code"'],
          ['state', 'recommended', 'CSRF protection — returned as-is'],
          ['scope', 'yes', 'Space-separated; must include "openid"'],
          ['code_challenge', 'public clients', 'S256 PKCE challenge'],
          ['code_challenge_method', 'public clients', 'Must be "S256"'],
        ]} />

        <H3>Token exchange</H3>
        <Block lang="http">{`POST /oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=<auth_code>
&redirect_uri=https://app.example.com/callback
&client_id=<client_id>
&code_verifier=<pkce_verifier>
# confidential clients also send:
# &client_secret=<client_secret>`}</Block>

        <H3>Token response</H3>
        <Block lang="json">{`{
  "access_token": "eyJhbGciOiJSUzI1NiJ9...",
  "id_token": "eyJhbGciOiJSUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "rt_...",
  "scope": "openid profile email"
}`}</Block>

        <H3>Refresh token</H3>
        <Block lang="http">{`POST /oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=<refresh_token>
&client_id=<client_id>`}</Block>
        <Note>Refresh tokens are single-use. Each refresh issues a new pair. Unused refresh tokens expire after the configured TTL (default 30 days).</Note>
      </div>
    ),
  },
  {
    id: 'userinfo',
    title: 'UserInfo Endpoint',
    group: 'OAuth2 / OIDC',
    content: (
      <div>
        <P>Returns identity claims for the currently authenticated user. The response is determined by the scopes included in the access token and any configured claim mappings.</P>
        <Block lang="http">{`GET /oauth2/userinfo
Authorization: Bearer <access_token>`}</Block>
        <H3>Example response</H3>
        <Block lang="json">{`{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "ldap_username": "jsmith",
  "email": "jsmith@example.com",
  "display_name": "John Smith",
  "title": "Senior Engineer",
  "department": "Engineering"
}`}</Block>
        <H3>Scope → claims mapping</H3>
        <Table rows={[
          ['Scope', 'Claims returned'],
          ['openid', 'sub, iss, aud, exp, iat'],
          ['profile', 'ldap_username, display_name, title + custom LDAP mappings'],
          ['email', 'email'],
        ]} />
        <P>Custom claims from LDAP attributes are configured in <strong style={{ color: CD }}>Settings → Claim Mappings</strong>.</P>
      </div>
    ),
  },
  {
    id: 'logout',
    title: 'Logout / End Session',
    group: 'OAuth2 / OIDC',
    content: (
      <div>
        <P>AO IDP supports three logout mechanisms: browser redirect (RP-initiated), API POST, and token revocation.</P>
        <H3>Browser redirect logout</H3>
        <P>Redirect the user&apos;s browser to the end-session endpoint. The IDP invalidates the session and redirects back if the URI is registered.</P>
        <Block lang="http">{`GET /oauth2/logout
  ?id_token_hint=<id_token>
  &client_id=<client_id>
  &post_logout_redirect_uri=https://app.example.com/logged-out`}</Block>
        <Note>The <Code>post_logout_redirect_uri</Code> must be listed in the application&apos;s <strong>Post Logout Redirect URIs</strong> field. If not registered or not provided, the user lands on the IDP&apos;s default logout page.</Note>

        <H3>API POST logout</H3>
        <P>For server-side logout. Revokes the refresh token and clears the session.</P>
        <Block lang="http">{`POST /oauth2/logout
Content-Type: application/x-www-form-urlencoded

refresh_token=<refresh_token>
&client_id=<client_id>`}</Block>

        <H3>Token revocation (RFC 7009)</H3>
        <P>Revoke a specific token (access or refresh) without ending the session.</P>
        <Block lang="http">{`POST /oauth2/token/revoke
Content-Type: application/x-www-form-urlencoded

token=<token>
&token_type_hint=refresh_token
&client_id=<client_id>
&client_secret=<client_secret>`}</Block>
        <Table rows={[
          ['token_type_hint', 'Effect'],
          ['refresh_token', 'Revokes the refresh token and all associated access tokens'],
          ['access_token', 'Revokes the specific access token only'],
        ]} />
      </div>
    ),
  },
  {
    id: 'token-claims',
    title: 'Token Claims Reference',
    group: 'OAuth2 / OIDC',
    content: (
      <div>
        <P>Access tokens and ID tokens are RS256-signed JWTs. Below are all standard and AO IDP-specific claims.</P>
        <H3>Standard claims (all tokens)</H3>
        <Table rows={[
          ['Claim', 'Type', 'Description'],
          ['sub', 'string', 'User UUID (stable, never changes)'],
          ['iss', 'string', 'Issuer URL (IDP_ISSUER env var)'],
          ['aud', 'string[]', 'Audience — contains the client_id'],
          ['exp', 'number', 'Expiry timestamp (Unix epoch)'],
          ['iat', 'number', 'Issued-at timestamp (Unix epoch)'],
          ['jti', 'string', 'Unique token identifier (UUID)'],
        ]} />
        <H3>Identity claims (profile + email scopes)</H3>
        <Table rows={[
          ['Claim', 'Type', 'Description'],
          ['ldap_username', 'string', 'LDAP account login name'],
          ['email', 'string', 'Email address from LDAP'],
          ['display_name', 'string', 'Full display name'],
          ['title', 'string', 'Job title (if present in LDAP)'],
        ]} />
        <H3>Custom claims</H3>
        <P>Additional claims are injected from LDAP attributes via <strong style={{ color: CD }}>Settings → Claim Mappings</strong>. Any LDAP attribute can be mapped to any JWT claim name.</P>
        <H3>Example decoded access token</H3>
        <Block lang="json">{`{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "iss": "https://auth.example.com",
  "aud": ["my-app-client-id"],
  "exp": 1715000000,
  "iat": 1714996400,
  "jti": "a1b2c3d4-...",
  "ldap_username": "jsmith",
  "email": "jsmith@example.com",
  "display_name": "John Smith",
  "title": "Engineer",
  "department": "R&D"
}`}</Block>
        <Note>Access tokens expire in <strong>1 hour</strong> by default. Refresh tokens expire in <strong>30 days</strong>. These are not yet configurable per-application.</Note>
      </div>
    ),
  },
  {
    id: 'jwks',
    title: 'JWKS & Token Validation',
    group: 'OAuth2 / OIDC',
    content: (
      <div>
        <P>Access tokens are RS256-signed JWTs. Your resource server should validate them using the public keys from the JWKS endpoint — never trust a token without signature verification.</P>
        <Block lang="http">{`GET /.well-known/jwks.json`}</Block>
        <H3>Example JWKS response</H3>
        <Block lang="json">{`{
  "keys": [{
    "kty": "RSA",
    "use": "sig",
    "alg": "RS256",
    "kid": "ao-idp-signing-key",
    "n": "0vx7agoebGcQSuuPiLJXZptN9...",
    "e": "AQAB"
  }]
}`}</Block>
        <H3>Validation checklist</H3>
        <ul className="text-xs space-y-1 mb-3" style={{ color: CM, listStyle: 'none', padding: 0 }}>
          <li><span style={{ color: GREEN }}>✓</span> Signature valid (RS256, key from JWKS)</li>
          <li><span style={{ color: GREEN }}>✓</span> <Code>exp</Code> — token not expired</li>
          <li><span style={{ color: GREEN }}>✓</span> <Code>iss</Code> — matches your IDP issuer URL</li>
          <li><span style={{ color: GREEN }}>✓</span> <Code>aud</Code> — contains your <Code>client_id</Code></li>
          <li><span style={{ color: GREEN }}>✓</span> <Code>jti</Code> — not in revocation list (if you track revocation)</li>
        </ul>
        <H3>Library recommendations</H3>
        <Table rows={[
          ['Language', 'Library'],
          ['Node.js', 'jose, jsonwebtoken + jwks-rsa'],
          ['Java', 'java-jwt (Auth0), nimbus-jose-jwt'],
          ['Python', 'python-jose, PyJWT'],
          ['.NET', 'Microsoft.IdentityModel.Tokens'],
          ['Go', 'golang-jwt/jwt, lestrrat-go/jwx'],
          ['PHP', 'web-token/jwt-framework, firebase/php-jwt'],
        ]} />
        <Tip>Cache the JWKS response with a 5-minute TTL. Rotate the key via admin settings — the new key is added to JWKS before the old one is removed, allowing graceful key rollover.</Tip>
      </div>
    ),
  },

  // ─── ADMIN ──────────────────────────────────────────────────────────────────
  {
    id: 'applications',
    title: 'Registering Applications',
    group: 'Admin Guide',
    content: (
      <div>
        <P>Every OAuth2 client that will use AO IDP for authentication must be registered as an <strong style={{ color: CD }}>Application</strong>.</P>
        <H3>Confidential client</H3>
        <P>Server-side apps (backend APIs, web apps with a server) that can keep a secret. Token exchange uses <Code>client_secret</Code> instead of (or in addition to) PKCE.</P>
        <H3>Public client</H3>
        <P>SPAs and mobile apps that cannot keep a secret. Must use PKCE. The <Code>client_secret</Code> field is empty. Enable with the <strong style={{ color: CD }}>Public Client</strong> toggle.</P>
        <H3>Application fields</H3>
        <Table rows={[
          ['Field', 'Description'],
          ['Name', 'Human-readable display name'],
          ['Slug', 'URL-safe identifier (letters, numbers, dashes)'],
          ['Client ID', 'Auto-generated UUID — used in all OAuth2 requests'],
          ['Client Secret', 'Auto-generated — shown once, hashed for storage'],
          ['Redirect URIs', 'Exact callback URLs (one per line)'],
          ['Allowed Origins', 'CORS origins for browser-based token requests'],
          ['Post Logout Redirect URIs', 'Allowed URIs after RP-initiated logout'],
          ['Public Client', 'Disables client_secret, requires PKCE'],
        ]} />
        <H3>Rotating the client secret</H3>
        <P>Use <strong style={{ color: CD }}>Applications → [app] → Rotate Secret</strong>. The old secret is immediately invalidated. Update your application configuration before rotating.</P>
        <Note>The <Code>client_secret</Code> is hashed with BCrypt and shown only once at creation or rotation. There is no way to recover it — rotate if lost.</Note>
        <H3>Deleting an application</H3>
        <P>Deleting an application revokes all user access grants for that app. Users are not deactivated — they retain access to other applications. Issued tokens become invalid immediately.</P>
      </div>
    ),
  },
  {
    id: 'users',
    title: 'User Activation',
    group: 'Admin Guide',
    content: (
      <div>
        <P>A user must be <em>activated</em> in the IDP before they can log in. Activation is separate from their LDAP account status — a valid LDAP account alone is not enough.</P>
        <H3>Two-step access model</H3>
        <ul className="text-xs space-y-1 mb-3" style={{ color: CM, listStyle: 'none', padding: 0 }}>
          <li><span style={{ color: AMBER }}>1.</span> <strong style={{ color: CD }}>Activate</strong> — creates an IDP record linked to the LDAP username</li>
          <li><span style={{ color: AMBER }}>2.</span> <strong style={{ color: CD }}>Grant access</strong> — allows the user to log into a specific application</li>
        </ul>
        <P>A user can be activated but have no application access, or be granted access to some apps but not others.</P>
        <H3>Activating from Directory</H3>
        <P>Go to <strong style={{ color: CD }}>Directory</strong>, browse the LDAP tree, select a user, click <strong style={{ color: CD }}>Activate &amp; Grant</strong>. Choose the target application from the dropdown. This activates the user (if not already) and grants access to the app in one step.</P>
        <H3>Activating from Users page</H3>
        <P>Go to <strong style={{ color: CD }}>Users → Activate User</strong>. Enter the LDAP username. The user is activated with no application access — grant access to apps separately.</P>
        <H3>Granting / revoking app access</H3>
        <P>From the <strong style={{ color: CD }}>Users</strong> page, click a user row, then use the <strong style={{ color: CD }}>Grant App</strong> / <strong style={{ color: CD }}>Revoke App</strong> controls. Or manage per-app from <strong style={{ color: CD }}>Applications → [app] → Users</strong>.</P>
        <H3>Deactivation</H3>
        <P>Deactivating a user blocks all future logins across all apps. Issued tokens expire normally (they are not immediately revoked). All access grants and audit history are preserved. Re-activating restores all grants.</P>
        <Tip>To immediately block a user, deactivate them AND revoke any long-lived refresh tokens from the admin panel.</Tip>
      </div>
    ),
  },
  {
    id: 'ldap',
    title: 'LDAP Configuration',
    group: 'Admin Guide',
    content: (
      <div>
        <P>AO IDP supports multiple LDAP / Active Directory servers. On login, servers are tried in priority order — the first successful bind wins. Configure servers in <strong style={{ color: CD }}>Settings → LDAP</strong>.</P>
        <H3>Connection fields</H3>
        <Table rows={[
          ['Field', 'Example', 'Notes'],
          ['URL', 'ldap://dc.example.com:389', 'Use ldaps:// for TLS (port 636)'],
          ['Base DN', 'DC=example,DC=com', 'Root search base'],
          ['Service Account DN', 'CN=svc,OU=Srv,DC=ex,DC=com', 'Used for directory lookups'],
          ['Service Account Password', '***', 'Stored encrypted'],
          ['Username Attribute', 'sAMAccountName', 'uid for OpenLDAP'],
          ['User Object Class', 'user', 'person or inetOrgPerson for OpenLDAP'],
          ['Display Name Attr', 'displayName', 'cn as fallback'],
          ['Email Attribute', 'mail', 'Standard'],
          ['Additional Filter', '(!(userAccountControl:1.2.840.113556.1.4.803:=2))', 'Optional extra LDAP filter'],
        ]} />
        <H3>Active Directory specifics</H3>
        <ul className="text-xs space-y-1 mb-3" style={{ color: CM, listStyle: 'none', padding: 0 }}>
          <li>• Username attribute: <Code>sAMAccountName</Code></li>
          <li>• Object class: <Code>user</Code></li>
          <li>• Disabled accounts filter: <Code>(!(userAccountControl:1.2.840.113556.1.4.803:=2))</Code></li>
          <li>• Use <Code>ldaps://</Code> on port 636 for production</li>
        </ul>
        <H3>OpenLDAP specifics</H3>
        <ul className="text-xs space-y-1 mb-3" style={{ color: CM, listStyle: 'none', padding: 0 }}>
          <li>• Username attribute: <Code>uid</Code></li>
          <li>• Object class: <Code>inetOrgPerson</Code> or <Code>person</Code></li>
          <li>• Display name: <Code>cn</Code></li>
        </ul>
        <H3>Testing the connection</H3>
        <P>After saving, use the <strong style={{ color: CD }}>Test</strong> button in the LDAP settings card. It performs a service account bind and a test search to verify connectivity.</P>
        <Note>Changes to LDAP configuration take effect immediately — no restart required. Deactivate a server to stop using it without deleting the configuration.</Note>
      </div>
    ),
  },
  {
    id: 'claim-mappings',
    title: 'Claim Mappings',
    group: 'Admin Guide',
    content: (
      <div>
        <P>Claim Mappings let you inject LDAP attributes into JWT tokens as custom claims. Configure them in <strong style={{ color: CD }}>Settings → Claim Mappings</strong>.</P>
        <H3>How it works</H3>
        <P>When a token is issued, the IDP reads the configured LDAP attributes from the authenticated user&apos;s LDAP entry and adds them as claims in the access token and UserInfo response.</P>
        <H3>Mapping fields</H3>
        <Table rows={[
          ['Field', 'Description'],
          ['LDAP Attribute', 'The LDAP attribute name to read (e.g. department, telephoneNumber)'],
          ['JWT Claim Name', 'The claim key to use in the token (e.g. dept, phone)'],
          ['Scope', 'Which scope must be requested for this claim to be included'],
        ]} />
        <H3>Example</H3>
        <Block lang="json">{`// Mapping: department → dept (scope: profile)
// Mapping: telephoneNumber → phone (scope: profile)

// Resulting access token claims:
{
  "sub": "...",
  "ldap_username": "jsmith",
  "email": "jsmith@example.com",
  "display_name": "John Smith",
  "dept": "Engineering",
  "phone": "+994501234567"
}`}</Block>
        <H3>Built-in mappings (always included)</H3>
        <Table rows={[
          ['Claim', 'LDAP source', 'Scope'],
          ['ldap_username', 'username_attribute (per LDAP config)', 'profile'],
          ['email', 'email_attribute (per LDAP config)', 'email'],
          ['display_name', 'display_name_attribute (per LDAP config)', 'profile'],
          ['title', 'title', 'profile'],
        ]} />
        <Tip>Custom claim names cannot collide with reserved claims (<Code>sub</Code>, <Code>iss</Code>, <Code>aud</Code>, <Code>exp</Code>, <Code>iat</Code>, <Code>jti</Code>). These are always present and cannot be overridden.</Tip>
      </div>
    ),
  },
  {
    id: 'admins',
    title: 'Admin Roles & Permissions',
    group: 'Admin Guide',
    content: (
      <div>
        <P>The admin panel supports two role types with different permission scopes.</P>
        <H3>idp_admin</H3>
        <P>Full access to all sections: dashboard, users, applications, directory, audit, logs, database, admins, settings, and docs. The initial admin account is always <Code>idp_admin</Code>.</P>
        <H3>app_admin</H3>
        <P>Scoped access. Permissions are assigned per-section by an <Code>idp_admin</Code>. Default sections: dashboard, applications, users, docs.</P>
        <H3>Available sections</H3>
        <Table rows={[
          ['Section', 'idp_admin', 'app_admin (grantable)'],
          ['Dashboard', '✓ always', '✓ always'],
          ['Applications', '✓ always', '✓ default'],
          ['Users', '✓ always', '✓ default'],
          ['Directory', '✓ always', '✓ grantable'],
          ['Audit Log', '✓ always', '✓ grantable'],
          ['Logs', '✓ always', '✓ grantable'],
          ['Database', '✓ always', '✓ grantable'],
          ['Admins', '✓ always', '✗ never'],
          ['Settings', '✓ always', '✗ never'],
          ['Docs', '✓ always', '✓ default'],
        ]} />
        <H3>Assigning permissions</H3>
        <P>Go to <strong style={{ color: CD }}>Admins → [admin] → Scopes</strong>. Add or remove section permissions using the controls. Changes take effect on the next login.</P>
        <Note>The <Code>admins</Code> and <Code>settings</Code> sections are always restricted to <Code>idp_admin</Code> and cannot be granted to <Code>app_admin</Code> accounts.</Note>
        <H3>Deactivating admins</H3>
        <P>Deactivated admins cannot log in to the admin panel. Their account and permission history is preserved. You cannot deactivate the last active <Code>idp_admin</Code>.</P>
      </div>
    ),
  },

  // ─── API REFERENCE ──────────────────────────────────────────────────────────
  {
    id: 'api-reference',
    title: 'API Reference',
    group: 'API Reference',
    content: (
      <div>
        <P>Complete list of public endpoints. All endpoints return JSON. Errors follow the OAuth2 error response format.</P>
        <H3>OpenID Connect</H3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {[
            { method: 'GET', path: '/.well-known/openid-configuration', desc: 'OIDC discovery document' },
            { method: 'GET', path: '/.well-known/jwks.json', desc: 'JSON Web Key Set (public signing keys)' },
            { method: 'GET', path: '/oauth2/authorize', desc: 'Authorization endpoint — starts login flow' },
            { method: 'POST', path: '/oauth2/token', desc: 'Token endpoint — code exchange, refresh' },
            { method: 'GET/POST', path: '/oauth2/logout', desc: 'End-session / logout endpoint' },
            { method: 'POST', path: '/oauth2/token/revoke', desc: 'Token revocation (RFC 7009)' },
            { method: 'GET', path: '/oauth2/userinfo', desc: 'UserInfo endpoint (Bearer token required)' },
          ].map(e => (
            <div key={e.path} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 8px', background: SURFACE2, border: `1px solid ${BORDER}` }}>
              <Badge label={e.method} color={e.method.includes('POST') ? AMBER : C} />
              <code style={{ fontSize: '0.75rem', color: CD, flex: '0 0 auto' }}>{e.path}</code>
              <span style={{ fontSize: '0.72rem', color: CB }}>{e.desc}</span>
            </div>
          ))}
        </div>
        <H3>Admin REST API (Bearer token)</H3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {[
            { method: 'POST', path: '/api/admin/auth/login', desc: 'Admin login — returns access token' },
            { method: 'GET', path: '/api/admin/applications', desc: 'List all applications' },
            { method: 'POST', path: '/api/admin/applications', desc: 'Create application' },
            { method: 'PUT', path: '/api/admin/applications/{id}', desc: 'Update application' },
            { method: 'DELETE', path: '/api/admin/applications/{id}', desc: 'Delete application' },
            { method: 'GET', path: '/api/admin/users', desc: 'List / search users (paginated)' },
            { method: 'POST', path: '/api/admin/users/activate', desc: 'Activate user by LDAP username' },
            { method: 'POST', path: '/api/admin/users/{id}/deactivate', desc: 'Deactivate user' },
            { method: 'POST', path: '/api/admin/users/{id}/grant-app', desc: 'Grant app access to user' },
            { method: 'POST', path: '/api/admin/users/{id}/revoke-app', desc: 'Revoke app access from user' },
            { method: 'GET', path: '/api/admin/audit', desc: 'Audit log (paginated)' },
            { method: 'GET', path: '/api/admin/ldap/configs', desc: 'List LDAP configurations' },
          ].map(e => (
            <div key={e.path} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 8px', background: SURFACE2, border: `1px solid ${BORDER}` }}>
              <Badge label={e.method} color={e.method === 'DELETE' ? RED : e.method === 'GET' ? C : AMBER} />
              <code style={{ fontSize: '0.75rem', color: CD, flex: '0 0 auto' }}>{e.path}</code>
              <span style={{ fontSize: '0.72rem', color: CB }}>{e.desc}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'error-codes',
    title: 'Error Codes',
    group: 'API Reference',
    content: (
      <div>
        <P>OAuth2 errors follow RFC 6749 format. HTTP errors from the admin API use a standard JSON envelope.</P>
        <H3>OAuth2 error response</H3>
        <Block lang="json">{`{
  "error": "invalid_grant",
  "error_description": "Authorization code expired or already used"
}`}</Block>
        <H3>OAuth2 error codes</H3>
        <Table rows={[
          ['error', 'HTTP', 'Description'],
          ['invalid_request', '400', 'Missing or malformed parameter'],
          ['unauthorized_client', '401', 'Client not authorized for this grant type'],
          ['access_denied', '403', 'User denied access or not activated'],
          ['unsupported_response_type', '400', 'response_type must be "code"'],
          ['invalid_scope', '400', 'Requested scope not supported'],
          ['invalid_grant', '400', 'Code expired, used, or verifier mismatch'],
          ['invalid_client', '401', 'client_id unknown or client_secret wrong'],
          ['server_error', '500', 'Unexpected internal error'],
        ]} />
        <H3>Admin API error response</H3>
        <Block lang="json">{`{
  "status": 403,
  "error": "Forbidden",
  "message": "Insufficient permissions for this operation",
  "timestamp": "2024-05-01T12:00:00Z"
}`}</Block>
        <H3>Admin API HTTP status codes</H3>
        <Table rows={[
          ['Status', 'Meaning'],
          ['200', 'Success'],
          ['201', 'Resource created'],
          ['400', 'Validation error / bad request'],
          ['401', 'Not authenticated (missing or invalid token)'],
          ['403', 'Authenticated but insufficient permissions'],
          ['404', 'Resource not found'],
          ['409', 'Conflict (e.g. duplicate slug)'],
          ['500', 'Internal server error'],
        ]} />
        <H3>Login-specific errors</H3>
        <Table rows={[
          ['Condition', 'Redirect parameter'],
          ['Wrong username or password', 'error=invalid_credentials'],
          ['User not activated in IDP', 'error=user_not_activated'],
          ['User has no access to this app', 'error=access_denied'],
          ['Too many failed attempts (locked)', 'error=account_locked'],
        ]} />
      </div>
    ),
  },
  {
    id: 'integration',
    title: 'Integration Examples',
    group: 'API Reference',
    content: (
      <div>
        <P>Ready-to-use code snippets for common integration scenarios.</P>
        <H3>JavaScript / TypeScript (PKCE SPA)</H3>
        <Block lang="typescript">{`// Generate PKCE pair
async function generatePkce() {
  const verifier = crypto.randomUUID().replace(/-/g, '') +
                   crypto.randomUUID().replace(/-/g, '')
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '')
  return { verifier, challenge }
}

// Initiate login
async function login(clientId: string, idpUrl: string, redirectUri: string) {
  const { verifier, challenge } = await generatePkce()
  const state = crypto.randomUUID()
  sessionStorage.setItem('pkce_verifier', verifier)
  sessionStorage.setItem('oauth_state', state)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  window.location.href = \`\${idpUrl}/oauth2/authorize?\${params}\`
}

// Handle callback
async function handleCallback(idpUrl: string, clientId: string, redirectUri: string) {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')!
  const state = params.get('state')!

  if (state !== sessionStorage.getItem('oauth_state')) throw new Error('State mismatch')
  const verifier = sessionStorage.getItem('pkce_verifier')!

  const res = await fetch(\`\${idpUrl}/oauth2/token\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code, redirect_uri: redirectUri,
      client_id: clientId, code_verifier: verifier,
    }),
  })
  return res.json() // { access_token, refresh_token, expires_in, ... }
}`}</Block>

        <H3>Python (confidential client)</H3>
        <Block lang="python">{`import httpx
from urllib.parse import urlencode

IDP_URL = "https://auth.example.com"
CLIENT_ID = "your-client-id"
CLIENT_SECRET = "your-client-secret"
REDIRECT_URI = "https://your-app.example.com/callback"

def exchange_code(code: str) -> dict:
    resp = httpx.post(
        f"{IDP_URL}/oauth2/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
    )
    resp.raise_for_status()
    return resp.json()

def refresh_token(refresh_token: str) -> dict:
    resp = httpx.post(
        f"{IDP_URL}/oauth2/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
    )
    resp.raise_for_status()
    return resp.json()

def get_userinfo(access_token: str) -> dict:
    resp = httpx.get(
        f"{IDP_URL}/oauth2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    resp.raise_for_status()
    return resp.json()`}</Block>

        <H3>Java (Spring Security OAuth2 Client)</H3>
        <Block lang="yaml">{`# application.yml
spring:
  security:
    oauth2:
      client:
        registration:
          ao-idp:
            client-id: your-client-id
            client-secret: your-client-secret
            authorization-grant-type: authorization_code
            redirect-uri: "{baseUrl}/login/oauth2/code/ao-idp"
            scope: openid, profile, email
        provider:
          ao-idp:
            issuer-uri: https://auth.example.com`}</Block>
      </div>
    ),
  },
]

// Group sections for nav rendering
const GROUPS = ['Getting Started', 'OAuth2 / OIDC', 'Admin Guide', 'API Reference']

export default function DocsPage() {
  const [active, setActive] = useState('overview')
  const current = sections.find(s => s.id === active)

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs tracking-widest uppercase mb-1" style={{ color: CB }}>reference</div>
        <h1 className="text-xl font-bold tracking-wider" style={{ color: C }}>{'> '}documentation</h1>
      </div>

      <div className="flex gap-6">
        <nav className="shrink-0 w-48">
          <div className="space-y-0">
            {GROUPS.map(group => (
              <div key={group} className="mb-3">
                <div style={{ fontSize: '0.6rem', color: CB, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '2px 12px 4px', fontWeight: 700 }}>
                  {group}
                </div>
                {sections.filter(s => s.group === group).map(s => (
                  <button key={s.id} onClick={() => setActive(s.id)}
                    className="w-full text-left px-3 py-1.5 text-xs tracking-wide transition-all"
                    style={{
                      color: active === s.id ? 'var(--bg)' : CM,
                      background: active === s.id ? C : 'transparent',
                      border: 'none', cursor: 'pointer',
                    }}>
                    {active === s.id ? '▸ ' : '  '}{s.title.toLowerCase()}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0 border p-6" style={{ background: SURFACE, borderColor: BORDER, minHeight: 400 }}>
          <div className="text-sm font-bold tracking-wider mb-1" style={{ color: C }}>
            {'// '}{current?.title}
          </div>
          <div style={{ fontSize: '0.6rem', color: CB, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '1rem' }}>
            {current?.group}
          </div>
          <div>{current?.content}</div>
        </div>
      </div>
    </div>
  )
}
