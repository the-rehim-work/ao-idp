import { useState, useEffect, useCallback, useRef } from 'react'

const C = '#00ffff'
const CD = '#00d4e8'
const CM = '#009bb5'
const CB = '#006b8a'
const ERR = '#ff4444'
const OK = '#00ff88'
const WARN = '#ff8800'
const BORDER = 'rgba(0,255,255,0.2)'
const SURFACE = '#020d10'
const SURFACE2 = '#041520'

const SS_KEY = 'ao_oauth2_demo'

interface Config {
  idpUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
  scope: string
}

interface Discovery {
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
  end_session_endpoint?: string
  issuer: string
  [key: string]: unknown
}

interface Tokens {
  access_token?: string
  id_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  [key: string]: unknown
}

interface SessionProfile {
  u: string
  n?: string
}

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.')
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return null }
}

function generateCodeVerifier() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function generateState() {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

function readSessionProfile(): SessionProfile | null {
  try {
    const m = document.cookie.match('(?:^|; )ao-user=([^;]*)')
    if (!m) return null
    const json = decodeURIComponent(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''))
    const p = JSON.parse(json)
    return p.u ? p : null
  } catch { return null }
}

function formatExpiry(exp?: number): { text: string; warn: boolean } | null {
  if (!exp) return null
  const diff = exp * 1000 - Date.now()
  if (diff <= 0) return { text: 'expired', warn: true }
  const s = Math.floor(diff / 1000)
  if (s < 60) return { text: `${s}s`, warn: s < 30 }
  const m = Math.floor(s / 60)
  if (m < 60) return { text: `${m}m ${s % 60}s`, warn: m < 2 }
  return { text: `${Math.floor(m / 60)}h ${m % 60}m`, warn: false }
}

const sectionStyle: React.CSSProperties = { background: SURFACE, border: `1px solid ${BORDER}`, padding: '1.5rem', marginBottom: '1rem' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.6rem', color: CD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '0.3rem' }
const fieldStyle: React.CSSProperties = { marginBottom: '0.875rem' }
const btnPrimary: React.CSSProperties = { padding: '0.55rem 1.25rem', background: 'transparent', border: `1px solid ${C}`, color: C, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', boxShadow: `0 0 8px rgba(0,255,255,0.3)`, cursor: 'pointer', fontFamily: 'inherit' }
const btnSecondary: React.CSSProperties = { ...btnPrimary, border: `1px solid ${CB}`, color: CB, boxShadow: 'none' }
const btnDanger: React.CSSProperties = { ...btnPrimary, border: `1px solid ${ERR}66`, color: ERR, boxShadow: 'none' }

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ fontSize: '0.6rem', padding: '0.15rem 0.4rem', border: `1px solid ${color}`, color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{children}</span>
}

function ClaimsTable({ payload, title }: { payload: Record<string, unknown>; title: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const KNOWN: Record<string, string> = {
    sub: 'Subject (user ID)', iss: 'Issuer', aud: 'Audience (client)',
    exp: 'Expires at', iat: 'Issued at', nbf: 'Not before',
    jti: 'JWT ID', scope: 'Scopes', username: 'Username',
    email: 'Email', name: 'Display name', roles: 'Roles',
    groups: 'Groups', admin_type: 'Admin type', display_name: 'Display name',
  }
  const fmtVal = (k: string, v: unknown): string => {
    if ((k === 'exp' || k === 'iat' || k === 'nbf') && typeof v === 'number') {
      return new Date(v * 1000).toLocaleString() + (k === 'exp' ? ` (${formatExpiry(v)?.text ?? ''})` : '')
    }
    if (Array.isArray(v)) return v.join(', ')
    return String(v)
  }
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.65rem', color: CM, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>{title}</div>
        <button onClick={() => setCollapsed(c => !c)} style={{ ...btnSecondary, padding: '0.1rem 0.4rem', fontSize: '0.55rem' }}>
          {collapsed ? 'expand' : 'collapse'}
        </button>
      </div>
      {!collapsed && (
        <div style={{ border: `1px solid rgba(0,255,255,0.1)`, background: '#000' }}>
          {Object.entries(payload).map(([k, v], i) => (
            <div key={k} style={{
              display: 'grid', gridTemplateColumns: '140px 1fr',
              padding: '0.35rem 0.75rem',
              borderBottom: i < Object.keys(payload).length - 1 ? '1px solid rgba(0,255,255,0.06)' : 'none',
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: C, fontFamily: 'monospace' }}>{k}</div>
                {KNOWN[k] && <div style={{ fontSize: '0.58rem', color: CB, marginTop: '0.1rem' }}>{KNOWN[k]}</div>}
              </div>
              <div style={{ fontSize: '0.72rem', color: CD, fontFamily: 'monospace', wordBreak: 'break-all', paddingLeft: '0.5rem' }}>
                {fmtVal(k, v)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function JsonBlock({ data, title }: { data: unknown; title?: string }) {
  const [collapsed, setCollapsed] = useState(true)
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
          <div style={{ fontSize: '0.6rem', color: CM, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{title}</div>
          <button onClick={() => setCollapsed(c => !c)} style={{ ...btnSecondary, padding: '0.1rem 0.4rem', fontSize: '0.55rem' }}>
            {collapsed ? 'expand raw' : 'collapse'}
          </button>
        </div>
      )}
      {!collapsed && (
        <pre style={{ background: '#000', border: `1px solid rgba(0,255,255,0.1)`, padding: '0.75rem', color: CD, fontSize: '0.72rem', maxHeight: 220, overflowY: 'auto' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function App() {
  const [config, setConfig] = useState<Config>(() => {
    try {
      const stored = sessionStorage.getItem(SS_KEY)
      if (stored) return JSON.parse(stored)
    } catch {}
    return {
      idpUrl: `${window.location.protocol}//${window.location.hostname}`,
      clientId: '',
      clientSecret: '',
      redirectUri: window.location.origin + '/',
      scope: 'openid profile email',
    }
  })

  const [tokens, setTokens] = useState<Tokens | null>(null)
  const [userInfo, setUserInfo] = useState<unknown>(null)
  const [discovery, setDiscovery] = useState<Discovery | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [usePkce, setUsePkce] = useState(true)
  const [sessionProfile, setSessionProfile] = useState<SessionProfile | null>(null)

  const discoveryRef = useRef<Discovery | null>(null)
  const exchangeCalledRef = useRef(false)

  useEffect(() => { setSessionProfile(readSessionProfile()) }, [])

  const addLog = useCallback((msg: string) => setLog(prev => [`[${new Date().toISOString().slice(11, 23)}] ${msg}`, ...prev.slice(0, 49)]), [])

  const saveConfig = (cfg: Config) => {
    setConfig(cfg)
    sessionStorage.setItem(SS_KEY, JSON.stringify(cfg))
  }

  const setField = (key: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) =>
    saveConfig({ ...config, [key]: e.target.value })

  const fetchDiscovery = useCallback(async (idpUrl: string): Promise<Discovery | null> => {
    const url = `${idpUrl}/.well-known/openid-configuration`
    addLog(`GET ${url}`)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Discovery = await res.json()
      setDiscovery(data)
      discoveryRef.current = data
      addLog(`Discovery OK — issuer: ${data.issuer}`)
      return data
    } catch (e) {
      const msg = (e as Error).message
      addLog(`Discovery FAILED: ${msg}`)
      setError(`Discovery failed: ${msg}`)
      return null
    }
  }, [addLog])

  const startAuth = async () => {
    if (!config.clientId) { setError('Client ID is required'); return }
    setLoading(true)
    setError('')
    sessionStorage.setItem(SS_KEY, JSON.stringify(config))

    const disc = await fetchDiscovery(config.idpUrl)
    setLoading(false)
    if (!disc) return

    const state = generateState()
    const params: Record<string, string> = {
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope,
      state,
    }

    if (usePkce) {
      const verifier = generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)
      sessionStorage.setItem('pkce_verifier', verifier)
      params.code_challenge = challenge
      params.code_challenge_method = 'S256'
      addLog(`PKCE: challenge=${challenge.slice(0, 12)}...`)
    } else {
      sessionStorage.removeItem('pkce_verifier')
    }

    sessionStorage.setItem('oauth_state', state)
    const authUrl = disc.authorization_endpoint + '?' + new URLSearchParams(params).toString()
    addLog(`Redirecting → ${authUrl.slice(0, 90)}...`)
    window.location.href = authUrl
  }

  const exchangeCode = useCallback(async (code: string) => {
    const stored = sessionStorage.getItem(SS_KEY)
    const cfg: Config = stored ? JSON.parse(stored) : config
    setLoading(true)
    setError('')

    let disc = discoveryRef.current
    if (!disc) disc = await fetchDiscovery(cfg.idpUrl)
    if (!disc) { setLoading(false); return }

    const body: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
    }
    if (cfg.clientSecret) body.client_secret = cfg.clientSecret

    const verifier = sessionStorage.getItem('pkce_verifier')
    if (verifier) { body.code_verifier = verifier; addLog('PKCE: attaching code_verifier') }

    addLog(`POST ${disc.token_endpoint}`)
    try {
      const res = await fetch(disc.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error_description ?? data.error ?? 'Token exchange failed'
        setError(msg); addLog(`Token exchange FAILED: ${msg}`)
      } else {
        setTokens(data)
        sessionStorage.removeItem('pkce_verifier')
        sessionStorage.removeItem('oauth_state')
        addLog(`Tokens received — expires_in: ${data.expires_in}s`)
        setSessionProfile(readSessionProfile())
      }
    } catch (e) {
      const msg = (e as Error).message
      setError(msg); addLog(`Token request error: ${msg}`)
    } finally {
      setLoading(false)
      window.history.replaceState({}, '', '/')
    }
  }, [addLog, config, fetchDiscovery])

  const fetchUserInfo = async () => {
    if (!tokens?.access_token) return
    const disc = discovery ?? await fetchDiscovery(config.idpUrl)
    if (!disc) return
    setLoading(true); setError('')
    addLog(`GET ${disc.userinfo_endpoint}`)
    try {
      const res = await fetch(disc.userinfo_endpoint, { headers: { Authorization: `Bearer ${tokens.access_token}` } })
      const data = await res.json()
      if (!res.ok) {
        const msg = (data as any).error_description ?? 'UserInfo failed'
        setError(msg); addLog(`UserInfo FAILED: ${msg}`)
      } else {
        setUserInfo(data); addLog(`UserInfo OK — sub: ${(data as any).sub}`)
      }
    } catch (e) {
      const msg = (e as Error).message; setError(msg); addLog(`UserInfo error: ${msg}`)
    } finally { setLoading(false) }
  }

  const refreshToken = async () => {
    if (!tokens?.refresh_token) return
    const disc = discovery ?? await fetchDiscovery(config.idpUrl)
    if (!disc) return
    setLoading(true); setError('')

    const body: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token as string,
      client_id: config.clientId,
    }
    if (config.clientSecret) body.client_secret = config.clientSecret

    addLog(`POST ${disc.token_endpoint} (refresh_token)`)
    try {
      const res = await fetch(disc.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error_description ?? data.error ?? 'Refresh failed'
        setError(msg); addLog(`Refresh FAILED: ${msg}`)
      } else {
        setTokens(data); addLog('Tokens refreshed OK')
      }
    } catch (e) {
      const msg = (e as Error).message; setError(msg); addLog(`Refresh error: ${msg}`)
    } finally { setLoading(false) }
  }

  const signOut = async () => {
    const disc = discovery ?? await fetchDiscovery(config.idpUrl)
    if (tokens?.refresh_token) {
      try {
        const revokeUrl = `${config.idpUrl}/oauth2/token/revoke`
        addLog(`POST ${revokeUrl} (revoke)`)
        await fetch(revokeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: tokens.refresh_token as string, client_id: config.clientId }).toString(),
        })
        addLog('Refresh token revoked')
      } catch (e) { addLog(`Revoke warning: ${(e as Error).message}`) }
    }
    try {
      addLog(`POST ${config.idpUrl}/oauth2/logout`)
      await fetch(`${config.idpUrl}/oauth2/logout`, { method: 'POST', credentials: 'include' })
      addLog('IDP session ended')
    } catch (e) { addLog(`Logout warning: ${(e as Error).message}`) }

    setTokens(null); setUserInfo(null)
    setSessionProfile(readSessionProfile())
    addLog('Signed out — tokens cleared')

    if (disc?.end_session_endpoint) {
      const params = new URLSearchParams({ post_logout_redirect_uri: config.redirectUri })
      if (tokens?.id_token) params.set('id_token_hint', tokens.id_token as string)
      window.location.href = disc.end_session_endpoint + '?' + params.toString()
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const errorParam = params.get('error')
    const state = params.get('state')
    const savedState = sessionStorage.getItem('oauth_state')

    if (errorParam) {
      const desc = params.get('error_description') ?? errorParam
      setError(`Auth error: ${desc}`); addLog(`Auth error from IDP: ${desc}`)
      window.history.replaceState({}, '', '/')
    } else if (code && !exchangeCalledRef.current) {
      exchangeCalledRef.current = true
      if (savedState && state !== savedState) {
        setError('State mismatch — possible CSRF attack'); addLog('State mismatch! Aborting.')
        window.history.replaceState({}, '', '/')
      } else {
        addLog(`Auth code received: ${code.slice(0, 12)}...`)
        exchangeCode(code)
      }
    }
  }, [])

  const accessPayload = tokens?.access_token ? decodeJwt(tokens.access_token) : null
  const idPayload = tokens?.id_token ? decodeJwt(tokens.id_token) : null
  const expiry = accessPayload ? formatExpiry(accessPayload.exp as number) : null

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '1.5rem', fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem', background: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.58rem', color: CB, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>AO Identity Provider</div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: C, letterSpacing: '0.08em', textTransform: 'uppercase', textShadow: `0 0 12px rgba(0,255,255,0.6)`, margin: 0 }}>OAuth2 / OIDC Demo</h1>
          <div style={{ fontSize: '0.65rem', color: CM, marginTop: '0.25rem' }}>Authorization Code Flow · PKCE · OpenID Connect</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Session chip */}
          {sessionProfile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.8rem', border: `1px solid rgba(0,255,255,0.2)`, background: SURFACE2 }}>
              <div style={{ width: 26, height: 26, border: `1px solid rgba(0,255,255,0.4)`, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', color: C }}>
                {(sessionProfile.n || sessionProfile.u).charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '0.55rem', color: CB, letterSpacing: '0.12em', textTransform: 'uppercase' }}>idp session</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C }}>{sessionProfile.n || sessionProfile.u}</div>
              </div>
            </div>
          )}

          {/* Token expiry badge */}
          {expiry && (
            <div style={{ fontSize: '0.65rem', color: expiry.warn ? WARN : CM, border: `1px solid ${expiry.warn ? WARN : CM}44`, padding: '0.3rem 0.6rem' }}>
              token expires: {expiry.text}
            </div>
          )}

          {/* Sign out button — always visible when tokens present */}
          {tokens && (
            <button style={btnDanger} onClick={signOut} disabled={loading}>
              sign out
            </button>
          )}
        </div>
      </div>

      {/* ── Access token claims strip (shown right after header when authed) ── */}
      {accessPayload && (
        <div style={{ marginBottom: '1rem', padding: '1rem 1.5rem', background: SURFACE2, border: `1px solid rgba(0,255,255,0.15)`, borderLeft: `3px solid ${C}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.65rem', color: C, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>access token claims</div>
            <Badge color={OK}>authenticated</Badge>
            {expiry && <Badge color={expiry.warn ? WARN : CM}>{expiry.text}</Badge>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem 1.5rem' }}>
            {[
              { k: 'sub', label: 'subject' },
              { k: 'username', label: 'username' },
              { k: 'email', label: 'email' },
              { k: 'name', label: 'name' },
              { k: 'scope', label: 'scope' },
              { k: 'roles', label: 'roles' },
            ].filter(({ k }) => accessPayload[k] !== undefined).map(({ k, label }) => (
              <div key={k}>
                <div style={{ fontSize: '0.55rem', color: CB, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.1rem' }}>{label}</div>
                <div style={{ fontSize: '0.78rem', color: CD, wordBreak: 'break-all' }}>
                  {Array.isArray(accessPayload[k]) ? (accessPayload[k] as unknown[]).join(', ') : String(accessPayload[k])}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,68,68,0.05)', border: `1px solid rgba(255,68,68,0.3)`, display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ color: ERR, fontSize: '0.75rem', flex: 1 }}>[ERR] {error}</div>
          <button style={{ ...btnSecondary, padding: '0.2rem 0.5rem', fontSize: '0.6rem' }} onClick={() => setError('')}>dismiss</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* ── Left column ── */}
        <div>
          <div style={sectionStyle}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '1rem' }}>1 · Configuration</div>

            <div style={fieldStyle}>
              <label style={labelStyle}>IDP Base URL</label>
              <input value={config.idpUrl} onChange={setField('idpUrl')} placeholder="https://auth.ao.az" style={{ width: '100%', padding: '0.4rem 0.6rem', background: '#000', border: `1px solid ${BORDER}`, color: CD, fontFamily: 'inherit', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Client ID</label>
              <input value={config.clientId} onChange={setField('clientId')} placeholder="your-client-id" style={{ width: '100%', padding: '0.4rem 0.6rem', background: '#000', border: `1px solid ${BORDER}`, color: CD, fontFamily: 'inherit', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Client Secret (leave blank for PKCE)</label>
              <input type="password" value={config.clientSecret} onChange={setField('clientSecret')} placeholder="••••••••" style={{ width: '100%', padding: '0.4rem 0.6rem', background: '#000', border: `1px solid ${BORDER}`, color: CD, fontFamily: 'inherit', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Redirect URI</label>
              <input value={config.redirectUri} onChange={setField('redirectUri')} style={{ width: '100%', padding: '0.4rem 0.6rem', background: '#000', border: `1px solid ${BORDER}`, color: CD, fontFamily: 'inherit', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Scope</label>
              <input value={config.scope} onChange={setField('scope')} placeholder="openid profile email" style={{ width: '100%', padding: '0.4rem 0.6rem', background: '#000', border: `1px solid ${BORDER}`, color: CD, fontFamily: 'inherit', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: CD, cursor: 'pointer', marginBottom: '1rem' }}>
              <input type="checkbox" checked={usePkce} onChange={e => setUsePkce(e.target.checked)} style={{ width: 14, height: 14, accentColor: C }} />
              Use PKCE (S256)
            </label>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button style={btnSecondary} onClick={() => fetchDiscovery(config.idpUrl)} disabled={loading}>discovery</button>
              <button style={btnPrimary} onClick={startAuth} disabled={loading || !config.clientId}>
                {loading ? 'working...' : tokens ? '> re-authorize' : '> authorize'}
              </button>
            </div>
          </div>

          {discovery && (
            <div style={sectionStyle}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>OIDC Discovery</div>
              <JsonBlock data={discovery} title="endpoints" />
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div>
          {tokens ? (
            <div style={sectionStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C, letterSpacing: '0.15em', textTransform: 'uppercase' }}>2 · Tokens</div>
                <Badge color={OK}>received</Badge>
                {tokens.token_type && <Badge color={CM}>{String(tokens.token_type)}</Badge>}
              </div>

              {accessPayload && <ClaimsTable payload={accessPayload} title="Access Token Claims" />}
              {tokens.access_token && <JsonBlock data={tokens.access_token} title="access_token (raw)" />}
              {idPayload && <ClaimsTable payload={idPayload} title="ID Token Claims" />}
              {tokens.refresh_token && (
                <div style={{ fontSize: '0.7rem', color: CM, marginBottom: '0.75rem' }}>
                  refresh_token: <span style={{ color: C }}>{(tokens.refresh_token as string).slice(0, 20)}…</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1px solid rgba(0,255,255,0.08)` }}>
                <button style={btnPrimary} onClick={fetchUserInfo} disabled={loading}>userinfo</button>
                {tokens.refresh_token && <button style={btnSecondary} onClick={refreshToken} disabled={loading}>refresh</button>}
                <button style={{ ...btnSecondary, color: ERR, borderColor: `${ERR}44` }} onClick={() => { setTokens(null); setUserInfo(null); addLog('Tokens cleared locally') }}>clear</button>
              </div>
            </div>
          ) : (
            <div style={{ ...sectionStyle, opacity: 0.4, textAlign: 'center', fontSize: '0.75rem', color: CB }}>
              Tokens will appear here after authorization
            </div>
          )}

          {userInfo && (
            <div style={sectionStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C, letterSpacing: '0.15em', textTransform: 'uppercase' }}>3 · UserInfo</div>
                <Badge color={OK}>fetched</Badge>
              </div>
              <ClaimsTable payload={userInfo as Record<string, unknown>} title="UserInfo Claims" />
            </div>
          )}

          <div style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Request Log</div>
              <button style={{ ...btnSecondary, padding: '0.15rem 0.4rem', fontSize: '0.55rem' }} onClick={() => setLog([])}>clear</button>
            </div>
            <div style={{ background: '#000', border: `1px solid rgba(0,255,255,0.08)`, padding: '0.5rem 0.75rem', maxHeight: 180, overflowY: 'auto' }}>
              {log.length === 0
                ? <div style={{ color: CB, fontSize: '0.7rem' }}>No activity yet</div>
                : log.map((entry, i) => <div key={i} style={{ fontSize: '0.68rem', color: CM, marginBottom: '0.15rem' }}>{entry}</div>)
              }
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.6rem', color: CB, letterSpacing: '0.1em' }}>
        Add <code style={{ color: CM }}>{config.redirectUri}</code> to your app's allowed redirect URIs
      </div>
    </div>
  )
}
