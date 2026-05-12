import React, { useState } from 'react'

const C = 'var(--accent)'
const CD = 'var(--accent-strong)'
const CM = 'var(--text-dim)'
const CB = 'var(--text-muted)'
const BORDER = 'rgba(94,234,212,0.2)'
const SURFACE = 'var(--surface-1)'
const SURFACE2 = 'var(--surface-2)'

interface Section {
  id: string
  title: string
  content: React.ReactNode
}

function Code({ children }: { children: string }) {
  return (
    <code style={{ background: SURFACE2, color: CD, border: `1px solid ${BORDER}`, padding: '1px 6px', fontSize: '0.8rem', fontFamily: 'inherit' }}>
      {children}
    </code>
  )
}

function Block({ children }: { children: string }) {
  return (
    <pre style={{ background: SURFACE2, border: `1px solid ${BORDER}`, padding: '1rem', fontSize: '0.8rem', color: CD, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: '0.75rem 0', fontFamily: 'inherit' }}>
      {children}
    </pre>
  )
}

function H3({ children }: { children: string }) {
  return <div className="text-xs font-bold tracking-widest uppercase mt-5 mb-2" style={{ color: C }}>{children}</div>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed mb-2" style={{ color: CM }}>{children}</p>
}

const sections: Section[] = [
  {
    id: 'overview',
    title: 'Overview',
    content: (
      <div>
        <P>AO IDP is a self-hosted OpenID Connect (OIDC) and OAuth 2.0 Identity Provider. It authenticates users against your LDAP/Active Directory, issues JWTs, and manages per-application access control.</P>
        <H3>Key capabilities</H3>
        <ul className="text-xs space-y-1 mb-3" style={{ color: CM, listStyle: 'none', padding: 0 }}>
          {[
            '✓ Authorization Code flow with PKCE (RFC 6749 / RFC 7636)',
            '✓ LDAP / Active Directory authentication',
            '✓ Per-application user access control',
            '✓ JWT access tokens + refresh tokens',
            '✓ JWKS endpoint for public key distribution',
            '✓ Configurable JWT claim mappings from LDAP attributes',
            '✓ Admin panel with role-based access',
            '✓ Audit log for all admin and user events',
          ].map(item => <li key={item}>{item}</li>)}
        </ul>
      </div>
    ),
  },
  {
    id: 'oidc-flow',
    title: 'OIDC Authorization Code Flow',
    content: (
      <div>
        <P>Your application redirects users to the IDP authorization endpoint. After successful login the IDP redirects back with a short-lived code that the app exchanges for tokens.</P>
        <H3>Step 1 — redirect to authorization endpoint</H3>
        <Block>{`GET /oauth2/authorize
  ?client_id=<your_client_id>
  &redirect_uri=https://app.example.com/callback
  &response_type=code
  &state=<random_state>
  &scope=openid profile
  &code_challenge=<S256_challenge>
  &code_challenge_method=S256`}</Block>
        <H3>Step 2 — exchange code for tokens</H3>
        <Block>{`POST /oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=<auth_code>
&redirect_uri=https://app.example.com/callback
&client_id=<your_client_id>
&code_verifier=<pkce_verifier>`}</Block>
        <H3>Response</H3>
        <Block>{`{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "scope": "openid profile"
}`}</Block>
        <H3>Step 3 — refresh access token</H3>
        <Block>{`POST /oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=<refresh_token>
&client_id=<your_client_id>`}</Block>
      </div>
    ),
  },
  {
    id: 'userinfo',
    title: 'UserInfo Endpoint',
    content: (
      <div>
        <P>Fetch identity claims for the authenticated user using the Bearer access token.</P>
        <Block>{`GET /oauth2/userinfo
Authorization: Bearer <access_token>`}</Block>
        <H3>Response</H3>
        <Block>{`{
  "sub": "550e8400-...",
  "ldap_username": "jsmith",
  "email": "jsmith@example.com",
  "display_name": "John Smith"
}`}</Block>
        <P>Additional claims can be mapped from LDAP attributes in Settings → Claim Mappings.</P>
      </div>
    ),
  },
  {
    id: 'logout',
    title: 'Logout / End Session',
    content: (
      <div>
        <P>Initiate RP-initiated logout by redirecting the user&apos;s browser to the logout endpoint.</P>
        <H3>GET logout (browser redirect)</H3>
        <Block>{`GET /oauth2/logout
  ?id_token_hint=<id_token>
  &client_id=<your_client_id>
  &post_logout_redirect_uri=https://app.example.com/logged-out`}</Block>
        <P>The <Code>post_logout_redirect_uri</Code> must be registered in the application settings (Post Logout Redirect URIs field). The IDP validates it before redirecting.</P>
        <H3>POST logout (API)</H3>
        <Block>{`POST /oauth2/logout
Content-Type: application/x-www-form-urlencoded

refresh_token=<refresh_token>
&client_id=<your_client_id>`}</Block>
        <H3>Token revocation (RFC 7009)</H3>
        <Block>{`POST /oauth2/token/revoke
Content-Type: application/x-www-form-urlencoded

token=<refresh_token>
&token_type_hint=refresh_token
&client_id=<your_client_id>
&client_secret=<your_client_secret>`}</Block>
      </div>
    ),
  },
  {
    id: 'jwks',
    title: 'JWKS & Token Validation',
    content: (
      <div>
        <P>Access tokens are signed RS256 JWTs. Validate them using the public keys from the JWKS endpoint.</P>
        <Block>{`GET /.well-known/jwks.json`}</Block>
        <P>Use a JWT library (e.g. <Code>jsonwebtoken</Code> for Node.js, <Code>java-jwt</Code> for Java, <Code>python-jose</Code> for Python) to verify the signature, expiry, issuer, and audience claims.</P>
        <H3>Required validation checks</H3>
        <ul className="text-xs space-y-1 mb-3" style={{ color: CM, listStyle: 'none', padding: 0 }}>
          <li>✓ Signature valid (RS256, key from JWKS)</li>
          <li>✓ <Code>exp</Code> — not expired</li>
          <li>✓ <Code>iss</Code> — matches your IDP issuer URL</li>
          <li>✓ <Code>aud</Code> — contains your <Code>client_id</Code></li>
        </ul>
      </div>
    ),
  },
  {
    id: 'applications',
    title: 'Registering Applications',
    content: (
      <div>
        <P>Go to <strong style={{ color: CD }}>Applications</strong> in the sidebar to register a new OAuth2 client.</P>
        <H3>Confidential client (server-side app)</H3>
        <P>Has a <Code>client_secret</Code>. The secret is hashed and shown only once at creation. Use it in the token exchange step instead of PKCE.</P>
        <H3>Public client (SPA / mobile)</H3>
        <P>No client secret. Must use PKCE (<Code>code_challenge</Code> / <Code>code_verifier</Code>). Suitable for single-page apps and native mobile clients.</P>
        <H3>Fields</H3>
        <ul className="text-xs space-y-1 mb-3" style={{ color: CM, listStyle: 'none', padding: 0 }}>
          <li><Code>redirect_uris</Code> — allowed callback URLs after login</li>
          <li><Code>allowed_origins</Code> — CORS origins for browser-based token requests</li>
          <li><Code>post_logout_redirect_uris</Code> — allowed redirect URLs after logout (validated server-side)</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'users',
    title: 'User Activation',
    content: (
      <div>
        <P>Users must be explicitly activated before they can log in. This is separate from their LDAP account — a user can exist in the directory but not yet have IDP access.</P>
        <H3>Activating a user</H3>
        <P>Go to <strong style={{ color: CD }}>Users</strong> or <strong style={{ color: CD }}>Directory</strong>. Click a user and activate them. This creates an IDP account linked to their LDAP username.</P>
        <H3>Per-app access</H3>
        <P>Even after activation, a user must be granted access to each application individually. Go to the <strong style={{ color: CD }}>Applications</strong> page → Users section of an app to manage access.</P>
        <H3>Deactivation</H3>
        <P>Deactivating a user prevents future logins but preserves audit history and app access records. Re-activating restores access.</P>
      </div>
    ),
  },
  {
    id: 'ldap',
    title: 'LDAP Configuration',
    content: (
      <div>
        <P>Go to <strong style={{ color: CD }}>Settings → LDAP</strong> to configure one or more directory servers. Multiple active servers are searched in order — the first successful authentication wins.</P>
        <H3>Key fields</H3>
        <ul className="text-xs space-y-1 mb-3" style={{ color: CM, listStyle: 'none', padding: 0 }}>
          <li><Code>url</Code> — e.g. <Code>ldap://dc.example.com:389</Code> or <Code>ldaps://...</Code></li>
          <li><Code>base_dn</Code> — e.g. <Code>DC=example,DC=com</Code></li>
          <li><Code>service_account_dn</Code> — DN used to bind for directory searches</li>
          <li><Code>username_attribute</Code> — attribute holding the login name (e.g. <Code>sAMAccountName</Code>, <Code>uid</Code>)</li>
          <li><Code>user_object_class</Code> — e.g. <Code>person</Code>, <Code>inetOrgPerson</Code>, <Code>user</Code></li>
          <li><Code>additional_user_filter</Code> — optional extra LDAP filter applied to all user searches</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'admins',
    title: 'Admin Roles & Permissions',
    content: (
      <div>
        <P>Two admin types are supported:</P>
        <H3>idp_admin</H3>
        <P>Full access to all sections — users, applications, LDAP, settings, logs, database, and docs.</P>
        <H3>app_admin</H3>
        <P>Scoped access. The <Code>idp_admin</Code> can grant specific sections per admin: users, applications, directory, audit, logs, database, docs.</P>
        <P>Permissions are enforced both in the sidebar (sections hidden if no permission) and on the API (403 if the token lacks the required scope).</P>
      </div>
    ),
  },
]

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
        <nav className="shrink-0 w-44">
          <div className="space-y-0.5">
            {sections.map(s => (
              <button key={s.id} onClick={() => setActive(s.id)}
                className="w-full text-left px-3 py-2 text-xs tracking-wide transition-all"
                style={{
                  color: active === s.id ? 'var(--bg)' : CM,
                  background: active === s.id ? C : 'transparent',
                  border: 'none', cursor: 'pointer',
                }}>
                {active === s.id ? '> ' : '  '}{s.title.toLowerCase()}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0 border p-6" style={{ background: SURFACE, borderColor: BORDER }}>
          <div className="text-sm font-bold tracking-wider mb-4" style={{ color: C }}>
            {'// '}{current?.title}
          </div>
          <div>{current?.content}</div>
        </div>
      </div>
    </div>
  )
}
