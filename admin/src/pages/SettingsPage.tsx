import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi, LdapServerConfig, LdapConfigRequest, TokenSettings, ClaimMapping, SecuritySettings, LoginBranding } from '../api/settings'
import { apiClient } from '../api/client'
import { ACCENT_PRESETS, applyTheme, loadTheme, saveTheme, ThemeState, FONT_SCALES, FontScale } from '../theme'

const C = 'var(--accent)', CD = 'var(--accent-strong)', CM = 'var(--text-dim)', CB = 'var(--text-muted)', ERR = 'var(--danger)'
const BORDER = 'var(--accent-medium)', SURFACE = 'var(--surface-1)'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem', background: 'var(--bg)',
  border: `1px solid ${BORDER}`, color: C, fontFamily: 'inherit',
  fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box',
}
const btnPrimary: React.CSSProperties = {
  padding: '0.55rem 1.1rem', background: 'transparent', border: `1px solid ${C}`,
  color: C, fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700,
  letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = { ...btnPrimary, border: `1px solid ${CB}`, color: CB }

function SectionTitle({ children }: { children: string }) {
  return <div style={{ fontSize: '0.625rem', color: CB, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1rem' }}>{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '0.875rem' }}>
      <label style={{ display: 'block', fontSize: '0.6rem', color: CD, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>{label}</label>
      {children}
    </div>
  )
}

function ClaimMappingsEditor({ claims, onChange, availableAttrs }: {
  claims: ClaimMapping[]
  onChange: (c: ClaimMapping[]) => void
  availableAttrs?: Record<string, string>
}) {
  const update = (idx: number, field: keyof ClaimMapping, value: string | boolean) =>
    onChange(claims.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  const addRow = (ldapAttr = '', claim = '') =>
    onChange([...claims, { claim, ldapAttr, description: '', enabled: true }])
  const removeRow = (idx: number) => onChange(claims.filter((_, i) => i !== idx))

  const usedAttrs = new Set(claims.map(m => m.ldapAttr).filter(Boolean))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.6rem', color: CB, letterSpacing: '0.15em', textTransform: 'uppercase' }}>JWT Claim Mappings</div>
        <button style={{ ...btnSecondary, padding: '0.15rem 0.5rem', fontSize: '0.55rem' }} onClick={() => addRow()}>+ add row</button>
      </div>

      {availableAttrs && Object.keys(availableAttrs).length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.55rem', color: CB, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Available LDAP Attributes — click to add
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: 120, overflowY: 'auto', padding: '0.5rem', border: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.3)' }}>
            {Object.entries(availableAttrs)
              .filter(([k]) => !k.startsWith('object') && k !== 'whenCreated' && k !== 'whenChanged' && k !== 'uSNCreated' && k !== 'uSNChanged')
              .map(([attr, sample]) => {
                const used = usedAttrs.has(attr)
                return (
                  <button
                    key={attr}
                    title={sample === '[binary]' ? '[binary data]' : sample}
                    disabled={used}
                    onClick={() => addRow(attr, attr)}
                    style={{
                      padding: '0.2rem 0.5rem', fontSize: '0.6rem', cursor: used ? 'default' : 'pointer',
                      border: `1px solid ${used ? 'rgba(94,234,212,0.1)' : BORDER}`,
                      background: used ? 'var(--accent-soft)' : 'transparent',
                      color: used ? CB : CD, fontFamily: 'inherit',
                    }}
                  >
                    {attr}
                    {sample !== '[binary]' && <span style={{ color: CB, marginLeft: '0.3rem', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', verticalAlign: 'middle', fontSize: '0.55rem' }}>= {sample}</span>}
                  </button>
                )
              })}
          </div>
        </div>
      )}

      <div style={{ border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 36px', borderBottom: `1px solid ${BORDER}`, padding: '0.4rem 0.5rem' }}>
          {['On', 'Claim', 'LDAP Attr', 'Description', ''].map(h => (
            <div key={h} style={{ fontSize: '0.5rem', color: CB, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>
        {claims.length === 0 && (
          <div style={{ padding: '0.75rem', fontSize: '0.7rem', color: CB, textAlign: 'center' }}>
            No claim mappings. Click an attribute above or use + add row.
          </div>
        )}
        {claims.map((m, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 36px', borderBottom: `1px solid rgba(94,234,212,0.06)`, padding: '0.3rem 0.5rem', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <input type="checkbox" checked={m.enabled} onChange={e => update(idx, 'enabled', e.target.checked)}
                style={{ accentColor: C, cursor: 'pointer', width: 13, height: 13 }} />
            </div>
            <input style={{ ...inputStyle, padding: '0.3rem 0.4rem', fontSize: '0.7rem' }}
              value={m.claim} onChange={e => update(idx, 'claim', e.target.value)} placeholder="email" />
            <input style={{ ...inputStyle, padding: '0.3rem 0.4rem', fontSize: '0.7rem' }}
              value={m.ldapAttr} onChange={e => update(idx, 'ldapAttr', e.target.value)} placeholder="mail" />
            <input style={{ ...inputStyle, padding: '0.3rem 0.4rem', fontSize: '0.7rem' }}
              value={m.description} onChange={e => update(idx, 'description', e.target.value)} placeholder="Email address" />
            <button style={{ color: ERR, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}
              onClick={() => removeRow(idx)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

const parseClaimMappings = (raw: string | undefined): ClaimMapping[] => {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

const emptyLdapForm = (dirType: 'ad' | 'openldap' | 'other' = 'ad'): LdapConfigRequest => ({
  name: '', url: dirType === 'openldap' ? 'ldap://' : 'ldaps://', baseDn: 'DC=ao,DC=az',
  serviceAccountDn: '', serviceAccountPassword: '',
  userObjectClass: dirType === 'openldap' ? 'inetOrgPerson' : 'user',
  usernameAttribute: dirType === 'openldap' ? 'uid' : 'sAMAccountName',
  additionalUserFilter: '', claimMappings: undefined,
})

function detectDirType(c: LdapServerConfig): 'ad' | 'openldap' | 'other' {
  const uoc = (c.userObjectClass ?? '').toLowerCase()
  const ua  = (c.usernameAttribute ?? '').toLowerCase()
  if (uoc === 'user' || ua === 'samaccountname') return 'ad'
  if (uoc === 'inetorgperson' || uoc === 'posixaccount' || ua === 'uid') return 'openldap'
  return 'other'
}

function ActiveConnectionPanel({ config }: { config: LdapServerConfig }) {
  return (
    <div style={{ border: `1px solid ${C}`, background: 'var(--accent-soft)', padding: '1rem 1.25rem', boxShadow: '0 0 16px rgba(94,234,212,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: C, boxShadow: '0 0 6px rgba(94,234,212,0.8)', flexShrink: 0 }} />
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Active Connection — {config.name}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem 2rem' }}>
        {[
          { label: 'URL', value: config.url },
          { label: 'Base DN', value: config.baseDn },
          { label: 'Service Account', value: config.serviceAccountDn },
          { label: 'User Object Class', value: config.userObjectClass },
          { label: 'Additional Filter', value: config.additionalUserFilter || '—' },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: '0.55rem', color: CB, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{label}</div>
            <div style={{ fontSize: '0.7rem', color: CD, wordBreak: 'break-all' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LdapSection() {
  const qc = useQueryClient()
  const { data: configs = [] } = useQuery({ queryKey: ['ldap-configs'], queryFn: settingsApi.ldap.list })
  const [editTarget, setEditTarget] = useState<LdapServerConfig | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [dirType, setDirType] = useState<'ad' | 'openldap' | 'other'>('ad')
  const [form, setForm] = useState<LdapConfigRequest>(emptyLdapForm())
  const [formClaims, setFormClaims] = useState<ClaimMapping[]>([])
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [formError, setFormError] = useState('')
  const [testing, setTesting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<LdapServerConfig | null>(null)
  const [formAttrs, setFormAttrs] = useState<Record<string, string> | undefined>(undefined)

  const applyDirType = (dt: 'ad' | 'openldap' | 'other') => {
    setDirType(dt)
    if (dt === 'ad') setForm(prev => ({ ...prev, userObjectClass: 'user', usernameAttribute: 'sAMAccountName' }))
    else if (dt === 'openldap') setForm(prev => ({ ...prev, userObjectClass: 'inetOrgPerson', usernameAttribute: 'uid' }))
  }

  const activeConfigs = configs.filter(c => c.active)
  const isEdit = !!editTarget

  const { data: availableAttrs } = useQuery({
    queryKey: ['ldap-attributes'],
    queryFn: settingsApi.ldap.attributes,
    enabled: activeConfigs.length > 0,
    retry: false,
    staleTime: 60_000,
  })

  const openCreate = () => {
    setEditTarget(null); setDirType('ad'); setForm(emptyLdapForm('ad')); setFormClaims([]); setTestResult(null); setFormError(''); setFormAttrs(undefined); setShowForm(true)
  }
  const openEdit = (c: LdapServerConfig) => {
    const dt = detectDirType(c)
    setEditTarget(c); setDirType(dt)
    setForm({
      name: c.name, url: c.url, baseDn: c.baseDn, serviceAccountDn: c.serviceAccountDn,
      serviceAccountPassword: '',
      userObjectClass: c.userObjectClass, usernameAttribute: c.usernameAttribute,
      additionalUserFilter: c.additionalUserFilter ?? '',
      claimMappings: undefined,
    })
    setFormClaims(parseClaimMappings(c.claimMappings))
    setTestResult(null); setFormError(''); setFormAttrs(undefined); setShowForm(true)
  }

  const handleSave = () => saveMut.mutate({ ...form, claimMappings: JSON.stringify(formClaims) })

  const saveMut = useMutation({
    mutationFn: (req: LdapConfigRequest) => isEdit ? settingsApi.ldap.update(editTarget!.id, req) : settingsApi.ldap.create(req),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ldap-configs'] }); qc.invalidateQueries({ queryKey: ['ldap-attributes'] }); setShowForm(false); setFormError('') },
    onError: (e: any) => setFormError(e.response?.data?.error_description ?? 'Save failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => settingsApi.ldap.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ldap-configs'] }); qc.invalidateQueries({ queryKey: ['ldap-attributes'] }); setConfirmDelete(null) },
  })

  const activateMut = useMutation({
    mutationFn: (id: string) => settingsApi.ldap.activate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ldap-configs'] }); qc.invalidateQueries({ queryKey: ['ldap-attributes'] }) },
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => settingsApi.ldap.deactivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ldap-configs'] }); qc.invalidateQueries({ queryKey: ['ldap-attributes'] }) },
  })

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      const result = isEdit && !form.serviceAccountPassword
        ? await settingsApi.ldap.testById(editTarget!.id)
        : await settingsApi.ldap.test(form)
      setTestResult(result)
      if (result.success) {
        try {
          const attrs = await settingsApi.ldap.attributesFromConfig(form)
          setFormAttrs(attrs)
        } catch { /* ignore — attrs are optional */ }
      }
    }
    catch (e: any) { setTestResult({ success: false, message: e.response?.data?.message ?? 'Connection failed' }) }
    finally { setTesting(false) }
  }

  const f = (k: keyof LdapConfigRequest) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div>
      {activeConfigs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: activeConfigs.length > 1 ? '1fr 1fr' : '1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {activeConfigs.map(c => <ActiveConnectionPanel key={c.id} config={c} />)}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <SectionTitle>All LDAP Servers</SectionTitle>
        <button style={btnPrimary} onClick={openCreate}>+ add server</button>
      </div>

      {configs.length === 0 && !showForm && (
        <div style={{ color: CM, fontSize: '0.8rem', padding: '1.5rem', border: `1px solid ${BORDER}`, textAlign: 'center' }}>
          No LDAP server configured. Directory and user import will be unavailable until one is added and activated.
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null) }}>
          <div style={{ background: SURFACE, border: `1px solid ${ERR}`, padding: '1.5rem 2rem', minWidth: 320, maxWidth: 420 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: ERR, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Delete LDAP Server</div>
            <div style={{ fontSize: '0.8rem', color: CD, marginBottom: '1.25rem' }}>
              Delete <strong style={{ color: C }}>{confirmDelete.name}</strong>? This cannot be undone.
              {confirmDelete.active && <span style={{ color: ERR, display: 'block', marginTop: '0.4rem', fontSize: '0.7rem' }}>Warning: this is the active server — all logins will fail after deletion.</span>}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => setConfirmDelete(null)}>cancel</button>
              <button style={{ ...btnPrimary, borderColor: ERR, color: ERR }} onClick={() => deleteMut.mutate(confirmDelete.id)} disabled={deleteMut.isPending}>
                {deleteMut.isPending ? 'deleting...' : 'delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {configs.map(c => (
        <div key={c.id} style={{ border: `1px solid ${c.active ? C : BORDER}`, background: SURFACE, padding: '0.875rem 1.25rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: c.active ? '0 0 12px rgba(94,234,212,0.08)' : 'none', opacity: c.active ? 1 : 0.7 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: c.active ? C : CD }}>{c.name}</span>
              {c.active && <span style={{ fontSize: '0.5rem', padding: '0.12rem 0.4rem', border: `1px solid ${C}`, color: C, letterSpacing: '0.1em', textTransform: 'uppercase' }}>active</span>}
            </div>
            <div style={{ fontSize: '0.7rem', color: CB }}>{c.url} · {c.baseDn}</div>
            <div style={{ fontSize: '0.65rem', color: CB, marginTop: '0.1rem' }}>
              {c.userObjectClass}
              {c.claimMappings && parseClaimMappings(c.claimMappings).length > 0 && (
                <span style={{ marginLeft: '0.75rem', color: CM }}>
                  {parseClaimMappings(c.claimMappings).filter(m => m.enabled).length} claims active
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!c.active && <button style={{ ...btnPrimary, padding: '0.25rem 0.6rem', fontSize: '0.6rem' }} onClick={() => activateMut.mutate(c.id)}>set active</button>}
            {c.active && <button style={{ ...btnSecondary, padding: '0.25rem 0.6rem', fontSize: '0.6rem', borderColor: CM, color: CM }} onClick={() => deactivateMut.mutate(c.id)}>disable</button>}
            <button style={{ ...btnSecondary, padding: '0.25rem 0.6rem', fontSize: '0.6rem' }} onClick={() => openEdit(c)}>edit</button>
            <button style={{ ...btnSecondary, padding: '0.25rem 0.6rem', fontSize: '0.6rem', borderColor: ERR, color: ERR }} onClick={() => setConfirmDelete(c)}>delete</button>
          </div>
        </div>
      ))}

      {showForm && (
        <div style={{ border: `1px solid ${BORDER}`, background: SURFACE, padding: '1.5rem', marginTop: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
            {isEdit ? `Edit — ${editTarget!.name}` : 'New LDAP Server'}
          </div>
          {formError && <div style={{ color: ERR, fontSize: '0.75rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', border: '1px solid rgba(255,68,68,0.3)' }}>[ERR] {formError}</div>}

          <Field label="Directory Type">
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['ad', 'openldap', 'other'] as const).map(dt => (
                <button key={dt} onClick={() => applyDirType(dt)} style={{
                  ...btnSecondary, padding: '0.35rem 0.8rem', fontSize: '0.65rem',
                  ...(dirType === dt ? { borderColor: C, color: C, background: 'var(--accent-soft)' } : {}),
                }}>
                  {dt === 'ad' ? 'Active Directory' : dt === 'openldap' ? 'OpenLDAP' : 'Other'}
                </button>
              ))}
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <Field label="Name"><input style={inputStyle} value={form.name} onChange={f('name')} placeholder="Production AD" /></Field>
            <Field label="URL"><input style={inputStyle} value={form.url} onChange={f('url')} placeholder="ldaps://ldap.ao.az:636" /></Field>
            <Field label="Base DN"><input style={inputStyle} value={form.baseDn} onChange={f('baseDn')} placeholder="DC=ao,DC=az" /></Field>
            <Field label="Service Account DN"><input style={inputStyle} value={form.serviceAccountDn} onChange={f('serviceAccountDn')} placeholder="CN=idp-svc,OU=Service,DC=ao,DC=az" /></Field>
            <Field label={isEdit ? 'Service Account Password (blank = keep)' : 'Service Account Password'}>
              <input style={inputStyle} type="password" value={form.serviceAccountPassword} onChange={f('serviceAccountPassword')} autoComplete="new-password" />
            </Field>
            <Field label="Username Attribute">
              <input style={inputStyle} value={form.usernameAttribute ?? ''} onChange={f('usernameAttribute')}
                placeholder={dirType === 'openldap' ? 'uid' : 'sAMAccountName'} />
            </Field>
            <Field label="User Object Class"><input style={inputStyle} value={form.userObjectClass} onChange={f('userObjectClass')} placeholder="user" /></Field>
            <Field label="Additional Filter (optional)"><input style={inputStyle} value={form.additionalUserFilter ?? ''} onChange={f('additionalUserFilter')} placeholder="(department=IT)" /></Field>
          </div>

          <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
            <ClaimMappingsEditor
              claims={formClaims}
              onChange={setFormClaims}
              availableAttrs={formAttrs ?? (isEdit && editTarget?.active ? availableAttrs : undefined)}
            />
          </div>

          {testResult && (
            <div style={{ padding: '0.5rem 0.75rem', border: `1px solid ${testResult.success ? 'rgba(94,234,212,0.3)' : 'rgba(255,68,68,0.3)'}`, color: testResult.success ? C : ERR, fontSize: '0.75rem', marginBottom: '1rem' }}>
              {testResult.success ? '✓' : '✗'} {testResult.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button style={btnSecondary} onClick={() => { setShowForm(false); setFormError('') }}>cancel</button>
            <button style={{ ...btnSecondary, borderColor: CM, color: CM }} onClick={handleTest} disabled={testing}>
              {testing ? 'testing...' : '> test connection'}
            </button>
            <button style={btnPrimary} onClick={handleSave} disabled={saveMut.isPending}>
              {saveMut.isPending ? 'saving...' : '> save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TokenSection() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['token-settings'], queryFn: settingsApi.tokens.get })
  const [form, setForm] = useState<TokenSettings>({ accessTokenExpiryMinutes: 15, refreshTokenExpiryDays: 7, adminTokenExpiryMinutes: 30 })
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (data) setForm(data) }, [data])

  const saveMut = useMutation({
    mutationFn: () => settingsApi.tokens.update(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['token-settings'] }); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  return (
    <div>
      <SectionTitle>Token Expiry</SectionTitle>
      {saved && <div style={{ color: C, fontSize: '0.75rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', border: '1px solid rgba(94,234,212,0.3)' }}>Saved.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {([
          { label: 'Access Token (minutes)', key: 'accessTokenExpiryMinutes', min: 1, max: 1440 },
          { label: 'Refresh Token (days)', key: 'refreshTokenExpiryDays', min: 1, max: 90 },
          { label: 'Admin Token (minutes)', key: 'adminTokenExpiryMinutes', min: 5, max: 480 },
        ] as const).map(({ label, key, min, max }) => (
          <div key={key} style={{ background: SURFACE, border: `1px solid ${BORDER}`, padding: '1rem' }}>
            <Field label={label}>
              <input style={{ ...inputStyle, fontSize: '1.25rem', textAlign: 'center', padding: '0.75rem' }}
                type="number" min={min} max={max} value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) || 0 }))} />
            </Field>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button style={btnPrimary} onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? 'saving...' : '> save token settings'}
        </button>
      </div>
    </div>
  )
}

function LdapClaimsEditor({ config }: { config: LdapServerConfig }) {
  const qc = useQueryClient()
  const [claims, setClaims] = useState<ClaimMapping[]>(() => parseClaimMappings(config.claimMappings))
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const { data: availableAttrs } = useQuery({
    queryKey: ['ldap-attributes', config.id],
    queryFn: () => settingsApi.ldap.attributesById(config.id),
    retry: false,
    staleTime: 60_000,
  })

  const saveMut = useMutation({
    mutationFn: () => settingsApi.ldap.update(config.id, {
      name: config.name, url: config.url, baseDn: config.baseDn,
      serviceAccountDn: config.serviceAccountDn, serviceAccountPassword: undefined,
      userObjectClass: config.userObjectClass,
      additionalUserFilter: config.additionalUserFilter,
      claimMappings: JSON.stringify(claims),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ldap-configs'] })
      setSaved(true); setSaveError('')
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (e: any) => setSaveError(e.response?.data?.message ?? 'Save failed'),
  })

  return (
    <div style={{ border: `1px solid ${config.active ? C : BORDER}`, background: SURFACE, padding: '1.25rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: config.active ? C : CB, boxShadow: config.active ? '0 0 5px rgba(94,234,212,0.8)' : 'none', flexShrink: 0 }} />
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: config.active ? C : CD }}>{config.name}</span>
        {config.active && <span style={{ fontSize: '0.5rem', padding: '0.1rem 0.4rem', border: `1px solid ${C}`, color: C, letterSpacing: '0.1em', textTransform: 'uppercase' }}>active</span>}
        <span style={{ fontSize: '0.65rem', color: CB, marginLeft: 'auto' }}>{config.url} · {config.baseDn}</span>
      </div>

      {saved && <div style={{ color: C, fontSize: '0.7rem', marginBottom: '0.75rem', padding: '0.4rem 0.6rem', border: '1px solid rgba(94,234,212,0.3)' }}>Saved.</div>}
      {saveError && <div style={{ color: ERR, fontSize: '0.7rem', marginBottom: '0.75rem', padding: '0.4rem 0.6rem', border: '1px solid rgba(255,68,68,0.3)' }}>[ERR] {saveError}</div>}

      <ClaimMappingsEditor
        claims={claims}
        onChange={setClaims}
        availableAttrs={config.active ? availableAttrs : undefined}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.875rem' }}>
        <button style={btnPrimary} onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? 'saving...' : '> save claims'}
        </button>
      </div>
    </div>
  )
}

function ClaimsSection() {
  const { data: configs = [] } = useQuery({ queryKey: ['ldap-configs'], queryFn: settingsApi.ldap.list })

  return (
    <div>
      <div style={{ fontSize: '0.65rem', color: CB, marginBottom: '1.25rem', padding: '0.5rem 0.75rem', border: `1px solid rgba(148,163,184,0.25)`, background: 'rgba(148,163,184,0.04)' }}>
        JWT claim mappings are configured per LDAP server. Each server can expose different attributes as JWT claims.
        <strong style={{ color: CM }}> sub</strong> (user UUID) is always included.
      </div>

      {configs.length === 0 ? (
        <div style={{ border: `1px solid ${BORDER}`, padding: '2rem', textAlign: 'center' }}>
          <div style={{ color: '#ff8800', fontSize: '0.875rem', marginBottom: '0.5rem' }}>No LDAP servers configured</div>
          <div style={{ fontSize: '0.7rem', color: CB }}>Add an LDAP server first in the LDAP Server tab.</div>
        </div>
      ) : (
        configs.map(config => <LdapClaimsEditor key={config.id} config={config} />)
      )}
    </div>
  )
}

interface LoginSettings {
  identifierType: string
  pageTitle: string
  logRetentionDays: number
  usernameAttribute: string
  emailAttribute: string
}

function LdapAttributeRow({ config }: { config: LdapServerConfig }) {
  const qc = useQueryClient()
  const defaultUsername = detectDirType(config) === 'openldap' ? 'uid' : 'sAMAccountName'
  const [usernameAttr, setUsernameAttr] = useState(config.usernameAttribute ?? defaultUsername)
  const [emailAttr, setEmailAttr] = useState(config.emailAttribute ?? 'mail')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const def = detectDirType(config) === 'openldap' ? 'uid' : 'sAMAccountName'
    setUsernameAttr(config.usernameAttribute ?? def)
    setEmailAttr(config.emailAttribute ?? 'mail')
  }, [config.usernameAttribute, config.emailAttribute, config.userObjectClass])

  const saveMut = useMutation({
    mutationFn: () => settingsApi.ldap.updateLoginAttributes(config.id, { usernameAttribute: usernameAttr, emailAttribute: emailAttr }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ldap-configs'] }); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  return (
    <div style={{ border: `1px solid ${config.active ? C : BORDER}`, background: SURFACE, padding: '0.875rem 1rem', marginBottom: '0.5rem', opacity: config.active ? 1 : 0.65 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: config.active ? C : CB, boxShadow: config.active ? '0 0 5px rgba(94,234,212,0.8)' : 'none', flexShrink: 0 }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: config.active ? C : CD }}>{config.name}</span>
        {config.active && <span style={{ fontSize: '0.5rem', padding: '0.1rem 0.35rem', border: `1px solid ${C}`, color: C, letterSpacing: '0.1em', textTransform: 'uppercase' }}>active</span>}
        <span style={{ fontSize: '0.6rem', color: CB, marginLeft: 'auto' }}>{config.url}</span>
        {saved && <span style={{ fontSize: '0.6rem', color: C }}>saved.</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
        <Field label="Username Attribute">
          <input style={inputStyle} value={usernameAttr} onChange={e => setUsernameAttr(e.target.value)} placeholder="sAMAccountName" />
        </Field>
        <Field label="Email Attribute">
          <input style={inputStyle} value={emailAttr} onChange={e => setEmailAttr(e.target.value)} placeholder="mail" />
        </Field>
        <button style={{ ...btnPrimary, marginBottom: '0.875rem' }} onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? '...' : '> save'}
        </button>
      </div>
    </div>
  )
}

function LoginSection() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['login-settings'],
    queryFn: () => apiClient.get<LoginSettings>('/settings/login').then(r => r.data),
  })
  const { data: ldapConfigs = [] } = useQuery({ queryKey: ['ldap-configs'], queryFn: settingsApi.ldap.list })
  const ldapActive = ldapConfigs.some((c: LdapServerConfig) => c.active)
  const activeLdap = ldapConfigs.find((c: LdapServerConfig) => c.active)

  const [form, setForm] = useState<LoginSettings>({ identifierType: 'any', pageTitle: 'AO ID', logRetentionDays: 10, usernameAttribute: 'sAMAccountName', emailAttribute: 'mail' })
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (data) setForm(data) }, [data])

  const saveMut = useMutation({
    mutationFn: () => apiClient.put<LoginSettings>('/settings/login', form).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['login-settings'] }); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  return (
    <div>
      <SectionTitle>Login Page Settings</SectionTitle>
      {saved && <div style={{ color: C, fontSize: '0.75rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', border: '1px solid rgba(94,234,212,0.3)' }}>Saved.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: SURFACE, border: `1px solid ${ldapActive ? BORDER : 'var(--border-faint)'}`, padding: '1rem', opacity: ldapActive ? 1 : 0.5 }}>
          <Field label="Identifier Type">
            <select
              value={form.identifierType}
              onChange={e => setForm(f => ({ ...f, identifierType: e.target.value }))}
              disabled={!ldapActive}
              style={{ ...inputStyle, cursor: ldapActive ? 'pointer' : 'not-allowed' }}
            >
              <option value="any">any — auto-detect by @</option>
              <option value="username">username — LDAP: {activeLdap?.usernameAttribute ?? 'sAMAccountName'}</option>
              <option value="email">email — LDAP: {activeLdap?.emailAttribute ?? 'mail'}</option>
            </select>
          </Field>
          {ldapActive ? (
            <div style={{ fontSize: '0.65rem', color: CB, marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <span>active server username attr: <span style={{ color: CM, fontFamily: 'monospace' }}>{activeLdap?.usernameAttribute ?? '—'}</span></span>
              <span>active server email attr: <span style={{ color: CM, fontFamily: 'monospace' }}>{activeLdap?.emailAttribute ?? '—'}</span></span>
            </div>
          ) : (
            <div style={{ fontSize: '0.65rem', color: '#ff8844', marginTop: '0.25rem' }}>
              Requires an active LDAP server.
            </div>
          )}
        </div>

        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, padding: '1rem' }}>
          <Field label="Login Page Title">
            <input style={inputStyle} value={form.pageTitle} onChange={e => setForm(f => ({ ...f, pageTitle: e.target.value }))} placeholder="AO ID" />
          </Field>
          <div style={{ fontSize: '0.65rem', color: CB, marginTop: '0.25rem' }}>
            Shown in the browser tab and page header of the login form.
          </div>
        </div>

        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, padding: '1rem' }}>
          <Field label="Log Retention (days)">
            <input
              style={{ ...inputStyle, fontSize: '1.25rem', textAlign: 'center', padding: '0.75rem' }}
              type="number" min={1} max={365} value={form.logRetentionDays}
              onChange={e => setForm(f => ({ ...f, logRetentionDays: parseInt(e.target.value) || 10 }))}
            />
          </Field>
          <div style={{ fontSize: '0.65rem', color: CB, marginTop: '0.25rem' }}>
            Audit logs older than this many days are automatically deleted at 03:00 UTC daily.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
        <button style={btnPrimary} onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? 'saving...' : '> save login settings'}
        </button>
      </div>

      <div style={{ fontSize: '0.625rem', color: CB, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>LDAP Login Attributes — per server</div>
      <div style={{ fontSize: '0.65rem', color: CB, marginBottom: '1rem', padding: '0.5rem 0.75rem', border: `1px solid rgba(148,163,184,0.25)`, background: 'rgba(148,163,184,0.04)' }}>
        Configure which LDAP attribute is used as the username and email for login, per server. Different directories can use different attribute names.
      </div>
      {ldapConfigs.length === 0 ? (
        <div style={{ border: `1px solid ${BORDER}`, padding: '1.5rem', textAlign: 'center', color: CB, fontSize: '0.8rem' }}>
          No LDAP servers configured. Add one in the LDAP Server tab first.
        </div>
      ) : (
        ldapConfigs.map((c: LdapServerConfig) => <LdapAttributeRow key={c.id} config={c} />)
      )}
    </div>
  )
}

function SecuritySection() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['security-settings'], queryFn: settingsApi.security.get })
  const [form, setForm] = useState<SecuritySettings>({
    lockoutEnabled: true, lockoutMaxAttempts: 5, lockoutWindowMinutes: 15, lockoutDurationMinutes: 30,
    sessionIdleMinutes: 30, sessionAbsoluteHours: 12,
    requirePkce: true, refreshTokenRotation: false,
    ipAllowlist: '', forceHttps: false,
  })
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { if (data) setForm(data) }, [data])

  const saveMut = useMutation({
    mutationFn: () => settingsApi.security.update(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['security-settings'] }); setSaved(true); setErr(''); setTimeout(() => setSaved(false), 2000) },
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Save failed'),
  })

  const num = (k: keyof SecuritySettings, min: number, max: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: Math.max(min, Math.min(max, parseInt(e.target.value) || 0)) }))

  const tog = (k: keyof SecuritySettings) => () => setForm(f => ({ ...f, [k]: !f[k] }))

  const Toggle = ({ value, onClick, label, hint }: { value: boolean; onClick: () => void; label: string; hint?: string }) => (
    <div onClick={onClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0' }}>
      <div style={{
        width: 28, height: 16, borderRadius: 8, position: 'relative',
        background: value ? 'var(--accent-medium)' : 'var(--accent-soft)',
        border: `1px solid ${value ? C : 'rgba(94,234,212,0.2)'}`,
        transition: 'all 0.15s',
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: 5, position: 'absolute',
          top: 2, left: value ? 14 : 2,
          background: value ? C : CB,
          boxShadow: value ? '0 0 6px rgba(94,234,212,0.8)' : 'none',
          transition: 'left 0.15s',
        }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.75rem', color: value ? CD : CM, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: '0.62rem', color: CB, marginTop: 1 }}>{hint}</div>}
      </div>
    </div>
  )

  const Card = ({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) => (
    <div style={{ background: SURFACE, border: `1px solid ${accent ?? BORDER}`, padding: '1rem 1.1rem' }}>
      <div style={{ fontSize: '0.6rem', color: accent ?? CB, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.7rem', fontWeight: 700 }}>
        {title}
      </div>
      {children}
    </div>
  )

  return (
    <div>
      <SectionTitle>Security & Hardening</SectionTitle>
      <div style={{ fontSize: '0.7rem', color: CB, marginBottom: '1rem', padding: '0.6rem 0.85rem', border: `1px solid rgba(148,163,184,0.25)`, background: 'rgba(148,163,184,0.04)' }}>
        Most settings are persisted but enforcement points are documented inline. Lockout & PKCE are the most impactful — wire them in
        <span style={{ color: CM }}> AdminAuthController/OidcController</span> by calling <code style={{ color: CD }}>settingsService.getSecuritySettings()</code>.
      </div>

      {saved && <div style={{ color: C, fontSize: '0.75rem', marginBottom: '0.75rem', padding: '0.4rem 0.75rem', border: '1px solid rgba(94,234,212,0.3)' }}>Saved.</div>}
      {err && <div style={{ color: ERR, fontSize: '0.75rem', marginBottom: '0.75rem', padding: '0.4rem 0.75rem', border: '1px solid rgba(255,68,68,0.3)' }}>[ERR] {err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        {/* Brute-force / account lockout */}
        <Card title="Brute-force / Account Lockout" accent={form.lockoutEnabled ? C : BORDER}>
          <Toggle value={form.lockoutEnabled} onClick={tog('lockoutEnabled')}
            label="Enable lockout" hint="Temporarily block a user after repeated failures" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem', marginTop: '0.6rem', opacity: form.lockoutEnabled ? 1 : 0.45, pointerEvents: form.lockoutEnabled ? 'auto' : 'none' }}>
            <Field label="Max attempts">
              <input style={inputStyle} type="number" min={1} max={20} value={form.lockoutMaxAttempts} onChange={num('lockoutMaxAttempts', 1, 20)} />
            </Field>
            <Field label="Window (min)">
              <input style={inputStyle} type="number" min={1} max={1440} value={form.lockoutWindowMinutes} onChange={num('lockoutWindowMinutes', 1, 1440)} />
            </Field>
            <Field label="Lockout (min)">
              <input style={inputStyle} type="number" min={1} max={1440} value={form.lockoutDurationMinutes} onChange={num('lockoutDurationMinutes', 1, 1440)} />
            </Field>
          </div>
        </Card>

        {/* Session timeouts */}
        <Card title="Session Timeouts">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <Field label="Idle timeout (min)">
              <input style={inputStyle} type="number" min={1} max={1440} value={form.sessionIdleMinutes} onChange={num('sessionIdleMinutes', 1, 1440)} />
            </Field>
            <Field label="Absolute max (hours)">
              <input style={inputStyle} type="number" min={1} max={720} value={form.sessionAbsoluteHours} onChange={num('sessionAbsoluteHours', 1, 720)} />
            </Field>
          </div>
          <div style={{ fontSize: '0.62rem', color: CB, marginTop: '0.25rem', lineHeight: 1.5 }}>
            Idle ⇒ logout after no activity. Absolute ⇒ hard cap regardless of activity. Enforce in JWT validation.
          </div>
        </Card>

        {/* OAuth security */}
        <Card title="OAuth / OIDC Security">
          <Toggle value={form.requirePkce} onClick={tog('requirePkce')}
            label="Require PKCE for public clients"
            hint="RFC 7636 — mandatory for SPAs and mobile. Highly recommended." />
          <Toggle value={form.refreshTokenRotation} onClick={tog('refreshTokenRotation')}
            label="Refresh token rotation"
            hint="Issue a new refresh token on each use; revoke the family on reuse." />
        </Card>

        {/* Transport */}
        <Card title="Transport / Network">
          <Toggle value={form.forceHttps} onClick={tog('forceHttps')}
            label="Force HTTPS / HSTS"
            hint="Redirect HTTP→HTTPS and emit HSTS header. Set behind a real cert." />
          <Field label="Admin IP allowlist (CIDR, comma-separated — empty = allow all)">
            <input style={inputStyle} value={form.ipAllowlist} onChange={e => setForm(f => ({ ...f, ipAllowlist: e.target.value }))}
              placeholder="10.0.0.0/8, 192.168.0.0/16" />
          </Field>
        </Card>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button style={btnPrimary} onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? 'saving...' : '> save security settings'}
        </button>
      </div>
    </div>
  )
}

function AppearanceSection() {
  const [theme, setTheme] = useState<ThemeState>(() => loadTheme())
  const [savedMsg, setSavedMsg] = useState(false)

  const update = (patch: Partial<ThemeState>) => {
    const next = { ...theme, ...patch }
    setTheme(next)
    saveTheme(next)
    applyTheme(next)
  }

  const handleSave = () => {
    saveTheme(theme)
    applyTheme(theme)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  const Card = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', padding: '1rem 1.1rem', borderRadius: 6 }}>
      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{title}</div>
      {hint && <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.85rem' }}>{hint}</div>}
      {children}
    </div>
  )

  const Seg = <T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string; icon?: React.ReactNode }[]; onChange: (v: T) => void }) => (
    <div style={{ display: 'inline-flex', padding: 2, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5 }}>
      {options.map(({ v, label, icon }) => {
        const active = value === v
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', fontSize: '0.72rem',
            background: active ? 'var(--accent-soft)' : 'transparent',
            border: 'none',
            color: active ? 'var(--accent)' : 'var(--text-dim)',
            fontFamily: 'inherit', cursor: 'pointer',
            fontWeight: active ? 600 : 400,
            borderRadius: 3,
            transition: 'all 0.12s',
          }}>
            {icon}{label}
          </button>
        )
      })}
    </div>
  )

  const SunIcon = <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="3.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M4.5 15.5l1.4-1.4M14.1 5.9l1.4-1.4" strokeLinecap="round"/></svg>
  const MoonIcon = <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 12a6 6 0 11-8-8 5 5 0 008 8z"/></svg>
  const AutoIcon = <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="16" height="11" rx="1"/><path d="M7 18h6M10 15v3" strokeLinecap="round"/></svg>

  return (
    <div>
      <SectionTitle>Appearance & Branding</SectionTitle>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '1rem', padding: '0.6rem 0.85rem', border: '1px solid var(--border)', background: 'var(--surface-1)', borderRadius: 5 }}>
        Tweaks apply immediately and persist to <code style={{ color: 'var(--accent)' }}>localStorage</code>. Light mode is wired into the
        new design tokens — chrome (sidebar, layout, theme-aware pages) flips correctly; legacy pages still using hardcoded hex values
        will be migrated incrementally.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <Card title="Theme Mode" hint="Dark by default. Auto follows your OS.">
          <Seg<ThemeState['mode']>
            value={theme.mode}
            onChange={v => update({ mode: v })}
            options={[
              { v: 'dark', label: 'Dark', icon: MoonIcon },
              { v: 'light', label: 'Light', icon: SunIcon },
              { v: 'system', label: 'Auto', icon: AutoIcon },
            ]}
          />
        </Card>

        <Card title="Density" hint="Comfortable for browsing; compact for power users.">
          <Seg<ThemeState['density']>
            value={theme.density}
            onChange={v => update({ density: v })}
            options={[
              { v: 'comfortable', label: 'Comfortable' },
              { v: 'compact', label: 'Compact' },
            ]}
          />
        </Card>

        <Card title="Corner Radius" hint="Sharp = brutalist; soft = balanced; round = playful.">
          <Seg<ThemeState['radius']>
            value={theme.radius}
            onChange={v => update({ radius: v })}
            options={[
              { v: 'sharp', label: 'Sharp' },
              { v: 'soft', label: 'Soft' },
              { v: 'round', label: 'Round' },
            ]}
          />
        </Card>

        <Card title="Font Size" hint="Sets the root font-size; everything scales from here. Affects the entire admin panel.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Seg<FontScale>
              value={theme.fontScale}
              onChange={v => update({ fontScale: v })}
              options={(Object.keys(FONT_SCALES) as FontScale[]).map(v => ({
                v, label: v.toUpperCase(),
              }))}
            />
            <div style={{ fontSize: '0.8em', color: 'var(--text-dim)' }}>
              Currently: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{FONT_SCALES[theme.fontScale].label}</span>
              <span style={{ marginLeft: 10, color: 'var(--text-muted)', fontSize: '0.92em' }}>
                Aa Bb Cc · The quick brown fox
              </span>
            </div>
          </div>
        </Card>

        <Card title="Accent Color" hint="Drives all primary buttons, links, focus rings, active states.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {ACCENT_PRESETS.map(p => {
              const active = theme.accent.toLowerCase() === p.hex.toLowerCase()
              return (
                <button
                  key={p.hex}
                  onClick={() => update({ accent: p.hex })}
                  title={p.name}
                  style={{
                    width: 28, height: 28,
                    borderRadius: '50%',
                    background: p.hex,
                    border: `2px solid ${active ? 'var(--text)' : 'transparent'}`,
                    boxShadow: active ? `0 0 0 2px ${p.hex}` : `0 0 0 1px var(--border)`,
                    cursor: 'pointer',
                    transition: 'transform 0.1s',
                    transform: active ? 'scale(1.08)' : 'scale(1)',
                  }}
                />
              )
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4 }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>HEX</span>
              <input
                type="color"
                value={theme.accent}
                onChange={e => update({ accent: e.target.value })}
                style={{ width: 24, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
              />
              <input
                type="text"
                value={theme.accent}
                onChange={e => {
                  const v = e.target.value.trim()
                  if (/^#[0-9a-f]{6}$/i.test(v)) update({ accent: v })
                  else setTheme(t => ({ ...t, accent: v }))
                }}
                style={{ width: 72, padding: '2px 6px', background: 'var(--bg)', border: '1px solid var(--border-faint)', color: 'var(--text)', fontFamily: 'monospace', fontSize: '0.7rem', outline: 'none', borderRadius: 3 }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Custom palette editor — advanced */}
      <Card title="Custom Palette · Advanced"
            hint="Override any base color for the current mode. Leave blank to use the mode default.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {([
            { k: 'bg',        label: 'Background' },
            { k: 'surface1',  label: 'Surface 1' },
            { k: 'surface2',  label: 'Surface 2' },
            { k: 'text',      label: 'Text primary' },
            { k: 'textDim',   label: 'Text secondary' },
            { k: 'border',    label: 'Border' },
          ] as const).map(({ k, label }) => {
            const cur = theme.customPalette?.[k] ?? ''
            return (
              <div key={k}>
                <label style={{ display: 'block', fontSize: '0.58rem', color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>{label}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.3rem 0.45rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3 }}>
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(cur) ? cur : '#000000'}
                    onChange={e => update({ customPalette: { ...theme.customPalette, [k]: e.target.value } })}
                    style={{ width: 24, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
                  <input type="text" value={cur} placeholder="default" onChange={e => {
                    update({ customPalette: { ...theme.customPalette, [k]: e.target.value } })
                  }}
                    style={{ flex: 1, minWidth: 0, padding: '2px 4px', background: 'transparent', border: 'none', color: 'var(--text)', fontFamily: 'monospace', fontSize: '0.7rem', outline: 'none' }} />
                  {cur && (
                    <button onClick={() => update({ customPalette: { ...theme.customPalette, [k]: '' } })}
                      title="Clear override"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.8rem', lineHeight: 1 }}>×</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button onClick={() => update({ customPalette: {} })} style={{
            padding: '4px 10px', fontSize: '0.66rem', background: 'transparent',
            color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer',
          }}>↺ clear all overrides</button>
          {/* preset palettes */}
          {([
            { name: 'Slate',  bg: '#0b1020', surface1: '#141a2e', surface2: '#1d2540' },
            { name: 'Coffee', bg: '#1c1411', surface1: '#231a16', surface2: '#2c211c' },
            { name: 'Forest', bg: '#0c1410', surface1: '#142016', surface2: '#1c2d20' },
            { name: 'Plum',   bg: '#16101a', surface1: '#211626', surface2: '#2b1d33' },
          ]).map(p => (
            <button key={p.name} onClick={() => update({ customPalette: { ...theme.customPalette, bg: p.bg, surface1: p.surface1, surface2: p.surface2 } })}
              style={{
                padding: '4px 10px', fontSize: '0.66rem',
                background: p.bg, color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer',
              }}>
              {p.name}
            </button>
          ))}
        </div>
      </Card>

      <div style={{ height: 12 }} />

      {/* Component preview */}
      <Card title="Live Preview" hint="Real components with your current settings.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <button style={{
            padding: '6px 14px', fontSize: '0.75rem', fontWeight: 600,
            background: 'var(--accent)', color: 'var(--bg)',
            border: 'none', borderRadius: 'var(--r, 5px)',
            cursor: 'pointer', boxShadow: 'var(--accent-glow)',
          }}>Primary Action</button>
          <button style={{
            padding: '6px 14px', fontSize: '0.75rem',
            background: 'transparent', color: 'var(--accent)',
            border: '1px solid var(--accent)', borderRadius: 'var(--r, 5px)', cursor: 'pointer',
          }}>Secondary</button>
          <button style={{
            padding: '6px 14px', fontSize: '0.75rem',
            background: 'transparent', color: 'var(--text-dim)',
            border: '1px solid var(--border)', borderRadius: 'var(--r, 5px)', cursor: 'pointer',
          }}>Ghost</button>
          <span style={{ padding: '3px 10px', fontSize: '0.65rem', background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)', borderRadius: 999, fontWeight: 600 }}>● active</span>
          <span style={{ padding: '3px 10px', fontSize: '0.65rem', background: 'rgba(52,211,153,0.10)', color: 'var(--success)', border: '1px solid rgba(52,211,153,0.35)', borderRadius: 999, fontWeight: 600 }}>● success</span>
          <span style={{ padding: '3px 10px', fontSize: '0.65rem', background: 'rgba(251,191,36,0.10)', color: 'var(--warning)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 999, fontWeight: 600 }}>● warning</span>
          <span style={{ padding: '3px 10px', fontSize: '0.65rem', background: 'rgba(251,113,133,0.10)', color: 'var(--danger)', border: '1px solid rgba(251,113,133,0.35)', borderRadius: 999, fontWeight: 600 }}>● danger</span>
          <input type="text" placeholder="example input" defaultValue="ao-idp" style={{
            padding: '5px 9px', fontSize: '0.75rem',
            background: 'var(--bg)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 'var(--r, 5px)',
            outline: 'none', fontFamily: 'monospace',
          }} />
        </div>
      </Card>

      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const reset: ThemeState = { mode: 'dark', accent: 'var(--accent)', density: 'comfortable', radius: 'soft', fontScale: 'base' }
              update(reset)
            }}
            style={{
              padding: '5px 10px', fontSize: '0.7rem',
              background: 'transparent', color: 'var(--text-muted)',
              border: '1px solid var(--border)', cursor: 'pointer',
              fontFamily: 'inherit', borderRadius: 4,
            }}
          >
            ↺ reset to defaults
          </button>

          {/* Export theme */}
          <button
            onClick={() => {
              const json = JSON.stringify(theme, null, 2)
              const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = 'ao-idp-theme.json'; a.click()
              URL.revokeObjectURL(url)
            }}
            style={{
              padding: '5px 10px', fontSize: '0.7rem',
              background: 'transparent', color: 'var(--text-muted)',
              border: '1px solid var(--border)', cursor: 'pointer',
              fontFamily: 'inherit', borderRadius: 4,
            }}
          >
            ↓ export theme
          </button>

          {/* Import theme */}
          <label
            style={{
              padding: '5px 10px', fontSize: '0.7rem',
              background: 'transparent', color: 'var(--text-muted)',
              border: '1px solid var(--border)', cursor: 'pointer',
              fontFamily: 'inherit', borderRadius: 4, display: 'inline-block',
            }}
            title="Import a previously exported ao-idp-theme.json"
          >
            ↑ import theme
            <input
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => {
                  try {
                    const parsed = JSON.parse(ev.target?.result as string) as Partial<ThemeState>
                    update({ ...theme, ...parsed })
                  } catch {
                    alert('Invalid theme file — could not parse JSON.')
                  }
                }
                reader.readAsText(file)
                // reset input so same file can be re-imported
                e.target.value = ''
              }}
            />
          </label>
        </div>

        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          Stored locally · per-user preference
        </span>

        <button
          onClick={handleSave}
          style={{
            padding: '6px 18px', fontSize: '0.75rem', fontWeight: 700,
            background: savedMsg ? 'var(--accent-soft)' : 'var(--accent)',
            color: savedMsg ? 'var(--accent)' : 'var(--bg)',
            border: `1px solid var(--accent)`,
            cursor: 'pointer', fontFamily: 'inherit',
            borderRadius: 5, transition: 'all 0.15s',
          }}
        >
          {savedMsg ? '✓ saved' : '> save appearance'}
        </button>
      </div>
    </div>
  )
}

const ORANGE_CSS_TEMPLATE = `/* AO IDP — Orange / Light Login Theme */
:root { --font: 'Inter', system-ui, sans-serif; }
html, body { background: #fdf6f2; font-family: var(--font); color: #1e293b; }
body::before, body::after { display: none; }
.wrap { max-width: 380px; animation: loginFadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes loginFadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
.hd-dot { border-radius:14px; background:#f05a1a; border:none; box-shadow:0 4px 16px rgba(240,90,26,0.35); }
.hd-dot svg { filter:none; stroke:#fff; }
.hd-title { font-size:1.2rem; font-weight:700; letter-spacing:0; text-transform:none; color:#1e293b; text-shadow:none; }
.hd-sub { font-size:0.78rem; letter-spacing:0; text-transform:none; color:#64748b; }
.app-banner { border-radius:14px 14px 0 0; border:none; background:linear-gradient(135deg,#f05a1a 0%,#e04510 100%); color:rgba(255,255,255,0.85); }
.app-banner svg { stroke:rgba(255,255,255,0.7); }
.app-banner strong { display:block; font-size:1.2rem; font-weight:700; color:#fff; }
.app-banner ~ .card, .app-banner + .card { border-radius:0 0 16px 16px; }
.card { background:#fff; border:none; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.12); }
.err { border-radius:8px; border:1px solid rgba(239,68,68,0.25); background:rgba(239,68,68,0.06); color:#dc2626; box-shadow:none; }
.field label { font-size:0.75rem; letter-spacing:0; text-transform:none; font-weight:600; color:#475569; }
.field input { border-radius:9px; background:rgba(240,90,26,0.05); border:1.5px solid rgba(240,90,26,0.2); color:#1e293b; font-family:var(--font); }
.field input::placeholder { color:rgba(240,90,26,0.35); }
.field input:hover { border-color:rgba(240,90,26,0.4); background:rgba(240,90,26,0.07); }
.field input:focus { border-color:#f05a1a; background:rgba(240,90,26,0.06); box-shadow:0 0 0 3px rgba(240,90,26,0.12); }
.btn { border-radius:10px; background:linear-gradient(135deg,#f05a1a 0%,#e04510 100%); border:none; color:#fff; font-family:var(--font); font-size:0.9rem; font-weight:600; letter-spacing:0; text-transform:none; box-shadow:0 2px 8px rgba(240,90,26,0.3); }
.btn:hover { background:linear-gradient(135deg,#ff6a2a 0%,#f05a1a 100%); box-shadow:0 4px 16px rgba(240,90,26,0.45); transform:translateY(-1px); color:#fff; }
.continue-panel { border-radius:12px; border:1.5px solid #e2e8f0 !important; border-left:3px solid #f05a1a !important; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
.continue-avatar { border-radius:9px; border:1.5px solid rgba(240,90,26,0.3); background:rgba(240,90,26,0.06); color:#f05a1a; font-weight:700; }
.continue-name { color:#1e293b; font-weight:600; } .continue-chevron { color:#f05a1a; }
.continue-signout { color:#94a3b8; border-left:1px solid #e2e8f0; font-family:var(--font); }
.continue-signout:hover { color:#ef4444; background:rgba(239,68,68,0.05); }
.bottom { font-size:0.72rem; letter-spacing:0; text-transform:none; color:#94a3b8; }
.wrap > .app-banner { border-radius:16px 16px 0 0; }
`

const DARK_CSS_TEMPLATE = `/* AO IDP — Dark Glassmorphism Theme */
:root { --font: 'Inter', system-ui, sans-serif; }
html, body { background:#060810; font-family:var(--font); }
body { background:radial-gradient(ellipse 80% 60% at 20% 10%,rgba(94,234,212,0.08) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 80% 100%,rgba(56,189,248,0.06) 0%,transparent 60%),#060810; }
body::before { display:none; }
.wrap { max-width:400px; animation:loginFadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes loginFadeUp { from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);} }
.hd-dot { width:52px;height:52px;border-radius:14px;border:1px solid rgba(94,234,212,0.25);background:rgba(94,234,212,0.07);backdrop-filter:blur(8px);box-shadow:0 0 0 1px rgba(94,234,212,0.08),0 8px 24px rgba(0,0,0,0.4),0 0 20px rgba(94,234,212,0.12); }
.hd-title { font-size:1.35rem;font-weight:700;letter-spacing:-0.01em;text-transform:none;color:#f0faf8;text-shadow:0 0 20px rgba(94,234,212,0.4); }
.hd-sub { font-size:0.75rem;letter-spacing:0;text-transform:none;color:rgba(148,163,184,0.7);margin-top:0.35rem; }
.card { border-radius:16px;border:1px solid rgba(94,234,212,0.12);background:rgba(15,20,30,0.75);backdrop-filter:blur(20px) saturate(1.4);padding:2rem;box-shadow:0 0 0 1px rgba(255,255,255,0.04),0 20px 60px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.06); }
.field label { text-transform:none;letter-spacing:0;font-size:0.75rem;font-weight:500;color:rgba(148,163,184,0.8); }
.field input { border-radius:8px;padding:0.65rem 0.9rem;background:rgba(255,255,255,0.04);border:1px solid rgba(94,234,212,0.15);color:#e2fdf8;font-family:var(--font);font-size:0.9rem; }
.field input:focus { border-color:rgba(94,234,212,0.55);background:rgba(94,234,212,0.04);box-shadow:0 0 0 3px rgba(94,234,212,0.08); }
.btn { border-radius:9px;background:var(--c);border:1px solid var(--c);color:#060810;font-family:var(--font);font-size:0.875rem;font-weight:700;letter-spacing:0;text-transform:none;box-shadow:0 0 20px rgba(94,234,212,0.25),0 4px 12px rgba(0,0,0,0.3); }
.btn:hover { background:#7ff4e4;border-color:#7ff4e4;box-shadow:0 0 30px rgba(94,234,212,0.5);transform:translateY(-1px); }
.continue-signout { color:rgba(94,234,212,0.3);border-left:1px solid rgba(94,234,212,0.08);font-family:var(--font); }
.continue-signout:hover { color:#f87171;background:rgba(239,68,68,0.06); }
`

const CORPORATE_BLUE_CSS = `/* AO IDP — Corporate Blue Theme */
:root { --font: 'Inter', system-ui, sans-serif; }
html, body { background:#f0f4ff; font-family:var(--font); color:#1e293b; }
body::before, body::after { display:none; }
.wrap { max-width:400px; animation:loginFadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes loginFadeUp { from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);} }
.hd-dot { border-radius:12px; background:#1e40af; border:none; box-shadow:0 4px 16px rgba(30,64,175,0.35); }
.hd-dot svg { filter:none; stroke:#fff; }
.hd-title { font-size:1.25rem; font-weight:700; letter-spacing:-0.01em; text-transform:none; color:#1e293b; text-shadow:none; }
.hd-sub { font-size:0.78rem; letter-spacing:0; text-transform:none; color:#64748b; }
.app-banner { border-radius:12px; border:none; background:#1e40af; color:rgba(255,255,255,0.85); }
.app-banner strong { color:#fff; }
.card { background:#fff; border:none; border-radius:16px; box-shadow:0 4px 24px rgba(30,64,175,0.1),0 1px 4px rgba(0,0,0,0.08); }
.field label { font-size:0.75rem; letter-spacing:0; text-transform:none; font-weight:600; color:#475569; }
.field input { border-radius:8px; background:#f8faff; border:1.5px solid #c7d2fe; color:#1e293b; font-family:var(--font); }
.field input:focus { border-color:#1e40af; background:#f0f4ff; box-shadow:0 0 0 3px rgba(30,64,175,0.1); }
.btn { border-radius:10px; background:#1e40af; border:none; color:#fff; font-family:var(--font); font-size:0.9rem; font-weight:600; letter-spacing:0; text-transform:none; box-shadow:0 2px 8px rgba(30,64,175,0.3); }
.btn:hover { background:#1d4ed8; box-shadow:0 4px 16px rgba(30,64,175,0.45); transform:translateY(-1px); color:#fff; }
.bottom { font-size:0.72rem; letter-spacing:0; text-transform:none; color:#94a3b8; }
.continue-panel { border-radius:12px; border:1.5px solid #e0e7ff !important; border-left:3px solid #1e40af !important; background:#fff; }
.continue-avatar { border-radius:8px; border:1.5px solid rgba(30,64,175,0.3); background:rgba(30,64,175,0.06); color:#1e40af; }
.continue-name { color:#1e293b; font-weight:600; } .continue-chevron { color:#1e40af; }
.continue-signout { color:#94a3b8; border-left:1px solid #e0e7ff; font-family:var(--font); }
.continue-signout:hover { color:#ef4444; background:rgba(239,68,68,0.05); }
`

const MIDNIGHT_PURPLE_CSS = `/* AO IDP — Midnight Purple Theme */
:root { --font: 'Inter', system-ui, sans-serif; }
html, body { background:#0d0b1a; font-family:var(--font); }
body { background:radial-gradient(ellipse 80% 60% at 30% 20%,rgba(139,92,246,0.1) 0%,transparent 60%),#0d0b1a; }
body::before { display:none; }
.wrap { max-width:380px; animation:loginFadeUp 0.4s ease both; }
@keyframes loginFadeUp { from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);} }
.hd-dot { border-radius:12px; background:rgba(139,92,246,0.2); border:1px solid rgba(139,92,246,0.4); box-shadow:0 0 20px rgba(139,92,246,0.3); }
.hd-dot svg { stroke:#a78bfa; filter:drop-shadow(0 0 6px rgba(139,92,246,0.8)); }
.hd-title { font-size:1.2rem; font-weight:700; letter-spacing:-0.01em; text-transform:none; color:#e9d5ff; text-shadow:0 0 20px rgba(139,92,246,0.5); }
.hd-sub { font-size:0.75rem; letter-spacing:0; text-transform:none; color:#7c3aed; }
.card { border-radius:16px; border:1px solid rgba(139,92,246,0.2); background:rgba(20,15,40,0.8); backdrop-filter:blur(16px); box-shadow:0 0 40px rgba(139,92,246,0.1); }
.field label { font-size:0.72rem; letter-spacing:0; text-transform:none; font-weight:500; color:#a78bfa; }
.field input { border-radius:8px; background:rgba(139,92,246,0.06); border:1px solid rgba(139,92,246,0.25); color:#e9d5ff; font-family:var(--font); }
.field input:focus { border-color:#8b5cf6; box-shadow:0 0 0 3px rgba(139,92,246,0.15); }
.btn { border-radius:10px; background:linear-gradient(135deg,#7c3aed,#6d28d9); border:none; color:#fff; font-family:var(--font); font-size:0.875rem; font-weight:700; letter-spacing:0; text-transform:none; box-shadow:0 0 20px rgba(139,92,246,0.3); }
.btn:hover { background:linear-gradient(135deg,#8b5cf6,#7c3aed); box-shadow:0 0 30px rgba(139,92,246,0.5); transform:translateY(-1px); }
.meta { display:none; } .bottom { color:#7c3aed; }
.continue-panel { border-radius:12px; border:1px solid rgba(139,92,246,0.2) !important; border-left:3px solid #8b5cf6 !important; background:rgba(20,15,40,0.8); }
.continue-avatar { border-radius:8px; background:rgba(139,92,246,0.15); border:1px solid rgba(139,92,246,0.3); color:#a78bfa; }
.continue-name { color:#e9d5ff; } .continue-chevron { color:#8b5cf6; }
.continue-signout { color:rgba(167,139,250,0.4); border-left:1px solid rgba(139,92,246,0.12); font-family:var(--font); }
.continue-signout:hover { color:#f87171; background:rgba(239,68,68,0.06); }
`

const FOREST_GREEN_CSS = `/* AO IDP — Forest Green Theme */
:root { --font: 'Inter', system-ui, sans-serif; }
html, body { background:#0a1a10; font-family:var(--font); }
body { background:radial-gradient(ellipse 70% 50% at 50% 30%,rgba(16,185,129,0.06) 0%,transparent 60%),#0a1a10; }
body::before { display:none; }
.wrap { max-width:380px; }
.hd-dot { border-radius:12px; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); box-shadow:0 0 16px rgba(16,185,129,0.2); }
.hd-dot svg { stroke:#34d399; filter:drop-shadow(0 0 4px rgba(16,185,129,0.6)); }
.hd-title { font-size:1.2rem; text-transform:none; letter-spacing:0; color:#d1fae5; text-shadow:0 0 16px rgba(16,185,129,0.4); }
.hd-sub { text-transform:none; letter-spacing:0; font-size:0.75rem; color:#065f46; }
.card { border-radius:14px; background:rgba(10,26,16,0.9); border:1px solid rgba(16,185,129,0.15); backdrop-filter:blur(12px); }
.field label { text-transform:none; letter-spacing:0; font-size:0.72rem; color:#34d399; }
.field input { border-radius:8px; background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.2); color:#d1fae5; font-family:var(--font); }
.field input:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,0.12); }
.btn { border-radius:8px; background:#059669; border:none; color:#fff; font-family:var(--font); font-size:0.875rem; font-weight:700; letter-spacing:0; text-transform:none; }
.btn:hover { background:#10b981; box-shadow:0 4px 20px rgba(16,185,129,0.4); transform:translateY(-1px); }
.meta { display:none; }
.continue-panel { border-radius:10px; border:1px solid rgba(16,185,129,0.15) !important; border-left:3px solid #10b981 !important; background:rgba(10,26,16,0.9); }
.continue-avatar { border-radius:8px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); color:#34d399; }
.continue-name { color:#d1fae5; } .continue-chevron { color:#10b981; }
.continue-signout { color:rgba(52,211,153,0.35); border-left:1px solid rgba(16,185,129,0.1); font-family:var(--font); }
.continue-signout:hover { color:#f87171; background:rgba(239,68,68,0.06); }
`

const ROSE_PINK_CSS = `/* AO IDP — Rose Pink Theme */
:root { --font: 'Inter', system-ui, sans-serif; }
html, body { background:#fff5f7; font-family:var(--font); color:#1e293b; }
body::before, body::after { display:none; }
.wrap { max-width:380px; animation:loginFadeUp 0.4s ease both; }
@keyframes loginFadeUp { from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);} }
.hd-dot { border-radius:50%; background:linear-gradient(135deg,#f43f5e,#e11d48); border:none; box-shadow:0 4px 16px rgba(244,63,94,0.35); }
.hd-dot svg { stroke:#fff; filter:none; }
.hd-title { text-transform:none; letter-spacing:0; font-size:1.2rem; font-weight:700; color:#1e293b; text-shadow:none; }
.hd-sub { text-transform:none; letter-spacing:0; font-size:0.78rem; color:#94a3b8; }
.card { background:#fff; border:none; border-radius:16px; box-shadow:0 4px 24px rgba(244,63,94,0.1),0 1px 4px rgba(0,0,0,0.06); }
.field label { text-transform:none; letter-spacing:0; font-size:0.72rem; font-weight:600; color:#64748b; }
.field input { border-radius:10px; background:rgba(244,63,94,0.04); border:1.5px solid rgba(244,63,94,0.2); color:#1e293b; font-family:var(--font); }
.field input:focus { border-color:#f43f5e; background:rgba(244,63,94,0.05); box-shadow:0 0 0 3px rgba(244,63,94,0.1); }
.btn { border-radius:10px; background:linear-gradient(135deg,#f43f5e,#e11d48); border:none; color:#fff; font-family:var(--font); font-size:0.9rem; font-weight:700; letter-spacing:0; text-transform:none; box-shadow:0 2px 10px rgba(244,63,94,0.3); }
.btn:hover { background:linear-gradient(135deg,#fb7185,#f43f5e); box-shadow:0 4px 20px rgba(244,63,94,0.45); transform:translateY(-1px); }
.meta { display:none; } .bottom { color:#94a3b8; text-transform:none; letter-spacing:0; }
.continue-panel { border-radius:12px; border:1.5px solid #fecdd3 !important; border-left:3px solid #f43f5e !important; background:#fff; }
.continue-avatar { border-radius:50%; background:rgba(244,63,94,0.1); border:1.5px solid rgba(244,63,94,0.3); color:#f43f5e; }
.continue-name { color:#1e293b; font-weight:600; } .continue-chevron { color:#f43f5e; }
.continue-signout { color:#94a3b8; border-left:1px solid #fecdd3; font-family:var(--font); }
.continue-signout:hover { color:#ef4444; background:rgba(239,68,68,0.05); }
`

const MINIMAL_WHITE_CSS = `/* AO IDP — Minimal White Theme */
:root { --font: 'Inter', system-ui, sans-serif; }
html, body { background:#fff; font-family:var(--font); color:#111827; }
body::before, body::after { display:none; }
.wrap { max-width:360px; }
.hd-dot { display:none; }
.hd-title { font-size:1.5rem; font-weight:700; letter-spacing:-0.02em; text-transform:none; color:#111827; text-shadow:none; }
.hd-sub { font-size:0.8rem; letter-spacing:0; text-transform:none; color:#6b7280; }
.app-banner { border-radius:8px; border:1px solid #e5e7eb; background:#f9fafb; color:#374151; border-left:3px solid #111827; }
.app-banner strong { color:#111827; }
.card { background:transparent; border:none; box-shadow:none; padding:0; }
.field label { font-size:0.8rem; letter-spacing:0; text-transform:none; font-weight:600; color:#374151; }
.field input { border-radius:6px; background:#fff; border:1.5px solid #d1d5db; color:#111827; font-family:var(--font); font-size:0.9rem; caret-color:#111827; }
.field input::placeholder { color:#9ca3af; }
.field input:focus { border-color:#111827; box-shadow:0 0 0 3px rgba(17,24,39,0.08); }
.btn { border-radius:6px; background:#111827; border:none; color:#fff; font-family:var(--font); font-size:0.875rem; font-weight:600; letter-spacing:0; text-transform:none; box-shadow:none; }
.btn:hover { background:#1f2937; box-shadow:0 2px 8px rgba(0,0,0,0.15); transform:none; }
.meta { display:none; } .divider { color:#9ca3af; } .divider::before,.divider::after { background:#e5e7eb; }
.bottom { font-size:0.75rem; letter-spacing:0; text-transform:none; color:#9ca3af; }
.continue-panel { border-radius:8px; border:1.5px solid #e5e7eb !important; border-left:3px solid #111827 !important; background:#f9fafb; box-shadow:none; }
.continue-avatar { border-radius:6px; background:#f3f4f6; border:1.5px solid #d1d5db; color:#111827; }
.continue-name { color:#111827; font-weight:600; } .continue-hint { color:#6b7280; } .continue-chevron { color:#6b7280; }
.continue-signout { color:#9ca3af; border-left:1px solid #e5e7eb; font-family:var(--font); }
.continue-signout:hover { color:#ef4444; background:rgba(239,68,68,0.05); }
.err { border-radius:6px; background:#fef2f2; border:1px solid #fecaca; color:#dc2626; box-shadow:none; }
`

const SLATE_DARK_CSS = `/* AO IDP — Slate Dark Theme */
:root { --font: 'Inter', system-ui, sans-serif; }
html, body { background:#0f172a; font-family:var(--font); }
body::before { display:none; }
.wrap { max-width:380px; }
.hd-dot { border-radius:10px; background:#1e293b; border:1px solid #334155; box-shadow:none; }
.hd-dot svg { stroke:#94a3b8; filter:none; }
.hd-title { font-size:1.2rem; font-weight:700; letter-spacing:-0.01em; text-transform:none; color:#f1f5f9; text-shadow:none; }
.hd-sub { font-size:0.75rem; letter-spacing:0; text-transform:none; color:#475569; }
.card { background:#1e293b; border:1px solid #334155; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.3); }
.field label { font-size:0.72rem; letter-spacing:0; text-transform:none; font-weight:500; color:#94a3b8; }
.field input { border-radius:8px; background:#0f172a; border:1px solid #334155; color:#f1f5f9; font-family:var(--font); }
.field input:focus { border-color:#64748b; box-shadow:0 0 0 3px rgba(100,116,139,0.15); }
.btn { border-radius:8px; background:#334155; border:1px solid #475569; color:#f1f5f9; font-family:var(--font); font-size:0.875rem; font-weight:600; letter-spacing:0; text-transform:none; box-shadow:none; }
.btn:hover { background:#475569; box-shadow:none; transform:none; color:#fff; }
.meta { display:none; } .bottom { color:#334155; text-transform:none; letter-spacing:0; }
.continue-panel { border-radius:10px; border:1px solid #334155 !important; border-left:3px solid #64748b !important; background:#1e293b; }
.continue-avatar { border-radius:6px; background:#0f172a; border:1px solid #334155; color:#94a3b8; }
.continue-name { color:#f1f5f9; } .continue-chevron { color:#64748b; }
.continue-signout { color:rgba(148,163,184,0.4); border-left:1px solid rgba(100,116,139,0.15); font-family:var(--font); }
.continue-signout:hover { color:#f87171; background:rgba(239,68,68,0.06); }
`

const OCEAN_BLUE_CSS = `/* AO IDP — Ocean Blue Theme */
:root { --font: 'Inter', system-ui, sans-serif; }
html, body { background:#041627; font-family:var(--font); }
body { background:radial-gradient(ellipse 100% 60% at 50% 0%,rgba(14,165,233,0.12) 0%,transparent 60%),#041627; }
body::before { display:none; }
.wrap { max-width:380px; }
.hd-dot { border-radius:12px; background:rgba(14,165,233,0.15); border:1px solid rgba(14,165,233,0.3); box-shadow:0 0 20px rgba(14,165,233,0.2); }
.hd-dot svg { stroke:#38bdf8; filter:drop-shadow(0 0 6px rgba(14,165,233,0.7)); }
.hd-title { text-transform:none; letter-spacing:0; font-size:1.2rem; font-weight:700; color:#e0f7ff; text-shadow:0 0 16px rgba(14,165,233,0.4); }
.hd-sub { text-transform:none; letter-spacing:0; font-size:0.75rem; color:#0284c7; }
.card { border-radius:14px; background:rgba(4,22,39,0.85); border:1px solid rgba(14,165,233,0.15); backdrop-filter:blur(12px); }
.field label { text-transform:none; letter-spacing:0; font-size:0.72rem; color:#38bdf8; }
.field input { border-radius:8px; background:rgba(14,165,233,0.05); border:1px solid rgba(14,165,233,0.2); color:#e0f7ff; font-family:var(--font); }
.field input:focus { border-color:#0ea5e9; box-shadow:0 0 0 3px rgba(14,165,233,0.12); }
.btn { border-radius:8px; background:linear-gradient(135deg,#0284c7,#0369a1); border:none; color:#fff; font-family:var(--font); font-size:0.875rem; font-weight:700; letter-spacing:0; text-transform:none; box-shadow:0 0 20px rgba(14,165,233,0.25); }
.btn:hover { background:linear-gradient(135deg,#0ea5e9,#0284c7); box-shadow:0 0 30px rgba(14,165,233,0.4); transform:translateY(-1px); }
.meta { display:none; } .bottom { color:#0284c7; text-transform:none; letter-spacing:0; }
.continue-panel { border-radius:10px; border:1px solid rgba(14,165,233,0.15) !important; border-left:3px solid #0ea5e9 !important; background:rgba(4,22,39,0.9); }
.continue-avatar { border-radius:8px; background:rgba(14,165,233,0.1); border:1px solid rgba(14,165,233,0.25); color:#38bdf8; }
.continue-name { color:#e0f7ff; } .continue-chevron { color:#0ea5e9; }
.continue-signout { color:rgba(56,189,248,0.35); border-left:1px solid rgba(14,165,233,0.12); font-family:var(--font); }
.continue-signout:hover { color:#f87171; background:rgba(239,68,68,0.06); }
`

const NEON_MATRIX_CSS = `/* AO IDP — Neon Matrix Theme */
:root { --font: 'Courier New', Courier, monospace; }
html, body { background:#000; font-family:var(--font); }
body::before { content:''; position:fixed; inset:0; pointer-events:none; background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,0,0.012) 2px,rgba(0,255,0,0.012) 4px); }
body::after { display:none; }
.wrap { max-width:380px; }
.hd-dot { border-radius:0; background:transparent; border:1px solid rgba(0,255,0,0.5); box-shadow:0 0 10px rgba(0,255,0,0.4); }
.hd-dot svg { stroke:#00ff00; filter:drop-shadow(0 0 6px rgba(0,255,0,0.9)); }
.hd-title { text-transform:uppercase; letter-spacing:0.15em; font-size:1.1rem; color:#00ff00; text-shadow:0 0 10px rgba(0,255,0,0.9),0 0 30px rgba(0,255,0,0.5); }
.hd-sub { letter-spacing:0.2em; font-size:0.6rem; color:rgba(0,255,0,0.4); }
.card { background:rgba(0,10,0,0.9); border:1px solid rgba(0,255,0,0.3); border-radius:0; box-shadow:0 0 20px rgba(0,255,0,0.08),inset 0 0 20px rgba(0,255,0,0.03); }
.field label { color:rgba(0,255,0,0.7); letter-spacing:0.15em; }
.field input { background:rgba(0,255,0,0.04); border:1px solid rgba(0,255,0,0.3); color:#00ff00; caret-color:#00ff00; border-radius:0; }
.field input::placeholder { color:rgba(0,255,0,0.2); }
.field input:focus { border-color:#00ff00; box-shadow:0 0 8px rgba(0,255,0,0.4); }
.btn { border-radius:0; background:transparent; border:1px solid #00ff00; color:#00ff00; letter-spacing:0.12em; text-transform:uppercase; box-shadow:0 0 10px rgba(0,255,0,0.3); }
.btn:hover { background:rgba(0,255,0,0.1); box-shadow:0 0 20px rgba(0,255,0,0.6); transform:none; }
.meta { display:none; } .bottom { color:rgba(0,255,0,0.3); letter-spacing:0.15em; text-transform:uppercase; }
.continue-panel { border-radius:0; border:1px solid rgba(0,255,0,0.3) !important; border-left:2px solid #00ff00 !important; background:rgba(0,10,0,0.9); }
.continue-avatar { border-radius:0; background:rgba(0,255,0,0.05); border:1px solid rgba(0,255,0,0.4); color:#00ff00; }
.continue-name { color:#00ff00; } .continue-chevron { color:#00ff00; }
.continue-signout { color:rgba(0,255,0,0.25); border-left:1px solid rgba(0,255,0,0.1); font-family:var(--font); }
.continue-signout:hover { color:#ff4444; background:rgba(255,0,0,0.06); }
`

const WARM_SAND_CSS = `/* AO IDP — Warm Sand Theme */
:root { --font: 'Inter', system-ui, sans-serif; }
html, body { background:#faf7f2; font-family:var(--font); color:#2c2416; }
body::before, body::after { display:none; }
.wrap { max-width:380px; }
.hd-dot { border-radius:10px; background:linear-gradient(135deg,#b45309,#92400e); border:none; box-shadow:0 4px 14px rgba(180,83,9,0.3); }
.hd-dot svg { stroke:#fef3c7; filter:none; }
.hd-title { text-transform:none; letter-spacing:0; font-size:1.2rem; font-weight:700; color:#2c2416; text-shadow:none; }
.hd-sub { text-transform:none; letter-spacing:0; font-size:0.78rem; color:#78716c; }
.card { background:#fff; border:1px solid #e7e0d6; border-radius:14px; box-shadow:0 2px 16px rgba(120,100,60,0.08); }
.field label { text-transform:none; letter-spacing:0; font-size:0.72rem; font-weight:600; color:#57534e; }
.field input { border-radius:8px; background:#faf7f2; border:1.5px solid #d6cfc4; color:#2c2416; font-family:var(--font); }
.field input:focus { border-color:#b45309; box-shadow:0 0 0 3px rgba(180,83,9,0.1); }
.btn { border-radius:8px; background:linear-gradient(135deg,#b45309,#92400e); border:none; color:#fef3c7; font-family:var(--font); font-size:0.9rem; font-weight:700; letter-spacing:0; text-transform:none; box-shadow:0 2px 8px rgba(180,83,9,0.25); }
.btn:hover { background:linear-gradient(135deg,#d97706,#b45309); box-shadow:0 4px 16px rgba(180,83,9,0.35); transform:translateY(-1px); }
.meta { display:none; } .bottom { color:#a8a29e; text-transform:none; letter-spacing:0; }
.continue-panel { border-radius:10px; border:1.5px solid #e7e0d6 !important; border-left:3px solid #b45309 !important; background:#fff; }
.continue-avatar { border-radius:8px; background:#fef3c7; border:1.5px solid rgba(180,83,9,0.3); color:#b45309; }
.continue-name { color:#2c2416; font-weight:600; } .continue-chevron { color:#b45309; }
.continue-signout { color:#a8a29e; border-left:1px solid #e7e0d6; font-family:var(--font); }
.continue-signout:hover { color:#ef4444; background:rgba(239,68,68,0.05); }
`

const SOFT_LAVENDER_CSS = `/* AO IDP — Soft Lavender Theme */
:root { --font: 'Inter', system-ui, sans-serif; }
html, body { background:#f5f3ff; font-family:var(--font); color:#1e1b4b; }
body::before, body::after { display:none; }
.wrap { max-width:380px; animation:loginFadeUp 0.4s ease both; }
@keyframes loginFadeUp { from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);} }
.hd-dot { border-radius:14px; background:linear-gradient(135deg,#7c3aed,#6d28d9); border:none; box-shadow:0 4px 16px rgba(124,58,237,0.3); }
.hd-dot svg { stroke:#fff; filter:none; }
.hd-title { font-size:1.25rem; font-weight:700; letter-spacing:-0.01em; text-transform:none; color:#1e1b4b; text-shadow:none; }
.hd-sub { font-size:0.78rem; letter-spacing:0; text-transform:none; color:#7c3aed; }
.app-banner { border-radius:12px; border:none; background:linear-gradient(135deg,#7c3aed,#6d28d9); color:rgba(255,255,255,0.9); }
.app-banner strong { color:#fff; }
.card { background:#fff; border:none; border-radius:16px; box-shadow:0 4px 24px rgba(124,58,237,0.1),0 1px 4px rgba(0,0,0,0.06); }
.field label { font-size:0.75rem; letter-spacing:0; text-transform:none; font-weight:600; color:#4c1d95; }
.field input { border-radius:10px; background:rgba(124,58,237,0.04); border:1.5px solid rgba(124,58,237,0.2); color:#1e1b4b; font-family:var(--font); }
.field input:focus { border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,0.1); }
.btn { border-radius:10px; background:linear-gradient(135deg,#7c3aed,#6d28d9); border:none; color:#fff; font-family:var(--font); font-size:0.9rem; font-weight:600; letter-spacing:0; text-transform:none; box-shadow:0 2px 10px rgba(124,58,237,0.3); }
.btn:hover { background:linear-gradient(135deg,#8b5cf6,#7c3aed); box-shadow:0 4px 18px rgba(124,58,237,0.45); transform:translateY(-1px); }
.bottom { color:#a78bfa; text-transform:none; letter-spacing:0; font-size:0.72rem; }
.continue-panel { border-radius:12px; border:1.5px solid #ede9fe !important; border-left:3px solid #7c3aed !important; background:#fff; box-shadow:0 2px 8px rgba(124,58,237,0.08); }
.continue-avatar { border-radius:10px; background:rgba(124,58,237,0.08); border:1.5px solid rgba(124,58,237,0.25); color:#7c3aed; font-weight:700; }
.continue-name { color:#1e1b4b; font-weight:600; } .continue-chevron { color:#7c3aed; }
.continue-signout { color:#c4b5fd; border-left:1px solid #ede9fe; font-family:var(--font); }
.continue-signout:hover { color:#ef4444; background:rgba(239,68,68,0.05); }
.err { border-radius:8px; background:#fef2f2; border:1px solid #fecaca; color:#dc2626; box-shadow:none; }
`

const MORNING_SKY_CSS = `/* AO IDP — Morning Sky Theme */
:root { --font: 'Inter', system-ui, sans-serif; }
html, body { background:#f0f9ff; font-family:var(--font); color:#0c4a6e; }
body::before, body::after { display:none; }
.wrap { max-width:380px; animation:loginFadeUp 0.4s ease both; }
@keyframes loginFadeUp { from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);} }
.hd-dot { border-radius:12px; background:linear-gradient(135deg,#0284c7,#0369a1); border:none; box-shadow:0 4px 14px rgba(2,132,199,0.3); }
.hd-dot svg { stroke:#fff; filter:none; }
.hd-title { font-size:1.25rem; font-weight:700; letter-spacing:-0.01em; text-transform:none; color:#0c4a6e; text-shadow:none; }
.hd-sub { font-size:0.78rem; letter-spacing:0; text-transform:none; color:#0284c7; }
.app-banner { border-radius:12px; border:none; background:linear-gradient(135deg,#0284c7,#0369a1); color:rgba(255,255,255,0.9); }
.app-banner strong { color:#fff; }
.card { background:#fff; border:none; border-radius:16px; box-shadow:0 4px 24px rgba(2,132,199,0.1),0 1px 4px rgba(0,0,0,0.06); }
.field label { font-size:0.75rem; letter-spacing:0; text-transform:none; font-weight:600; color:#075985; }
.field input { border-radius:10px; background:rgba(2,132,199,0.04); border:1.5px solid rgba(2,132,199,0.2); color:#0c4a6e; font-family:var(--font); }
.field input:focus { border-color:#0284c7; background:rgba(2,132,199,0.05); box-shadow:0 0 0 3px rgba(2,132,199,0.1); }
.btn { border-radius:10px; background:linear-gradient(135deg,#0284c7,#0369a1); border:none; color:#fff; font-family:var(--font); font-size:0.9rem; font-weight:600; letter-spacing:0; text-transform:none; box-shadow:0 2px 10px rgba(2,132,199,0.3); }
.btn:hover { background:linear-gradient(135deg,#0ea5e9,#0284c7); box-shadow:0 4px 18px rgba(2,132,199,0.45); transform:translateY(-1px); }
.bottom { color:#7dd3fc; text-transform:none; letter-spacing:0; font-size:0.72rem; }
.continue-panel { border-radius:12px; border:1.5px solid #bae6fd !important; border-left:3px solid #0284c7 !important; background:#fff; box-shadow:0 2px 8px rgba(2,132,199,0.08); }
.continue-avatar { border-radius:10px; background:rgba(2,132,199,0.08); border:1.5px solid rgba(2,132,199,0.25); color:#0284c7; font-weight:700; }
.continue-name { color:#0c4a6e; font-weight:600; } .continue-chevron { color:#0284c7; }
.continue-signout { color:#7dd3fc; border-left:1px solid #bae6fd; font-family:var(--font); }
.continue-signout:hover { color:#ef4444; background:rgba(239,68,68,0.05); }
.err { border-radius:8px; background:#fef2f2; border:1px solid #fecaca; color:#dc2626; box-shadow:none; }
`

const CSS_THEMES = [
  { key: 'default',         label: 'Default — Cyber Teal',    css: '' },
  { key: 'orange',          label: 'Orange Light',             css: ORANGE_CSS_TEMPLATE },
  { key: 'dark-glass',      label: 'Dark Glassmorphism',       css: DARK_CSS_TEMPLATE },
  { key: 'corporate-blue',  label: 'Corporate Blue',           css: CORPORATE_BLUE_CSS },
  { key: 'midnight-purple', label: 'Midnight Purple',          css: MIDNIGHT_PURPLE_CSS },
  { key: 'forest-green',    label: 'Forest Green',             css: FOREST_GREEN_CSS },
  { key: 'rose-pink',       label: 'Rose Pink',                css: ROSE_PINK_CSS },
  { key: 'minimal-white',   label: 'Minimal White',            css: MINIMAL_WHITE_CSS },
  { key: 'slate-dark',      label: 'Slate Dark',               css: SLATE_DARK_CSS },
  { key: 'ocean-blue',      label: 'Ocean Blue',               css: OCEAN_BLUE_CSS },
  { key: 'neon-matrix',     label: 'Neon Matrix',              css: NEON_MATRIX_CSS },
  { key: 'warm-sand',       label: 'Warm Sand',                css: WARM_SAND_CSS },
  { key: 'soft-lavender',   label: 'Soft Lavender (Light)',    css: SOFT_LAVENDER_CSS },
  { key: 'morning-sky',     label: 'Morning Sky (Light)',      css: MORNING_SKY_CSS },
]

function LoginBrandingSection() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['login-branding'], queryFn: settingsApi.loginBranding.get })
  const [form, setForm] = useState<LoginBranding>({
    logoUrl: '', primaryColor: '#5eead4', bgColor: '#0a0c10', textColor: '#e7ebf0',
    welcomeText: '', footerText: '', customCss: '', continueAsEnabled: true, fontFamily: '',
  })
  const [saved, setSaved] = useState(false)
  const [cssExpanded, setCssExpanded] = useState(false)

  useEffect(() => { if (data) setForm(data) }, [data])

  const saveMut = useMutation({
    mutationFn: () => settingsApi.loginBranding.update(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['login-branding'] }); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  const Toggle = ({ value, onClick, label, hint }: { value: boolean; onClick: () => void; label: string; hint?: string }) => (
    <div onClick={onClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0' }}>
      <div style={{
        width: 28, height: 16, borderRadius: 8, position: 'relative',
        background: value ? 'var(--accent-medium)' : 'var(--accent-soft)',
        border: `1px solid ${value ? C : 'rgba(94,234,212,0.2)'}`,
        transition: 'all 0.15s', flexShrink: 0,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: 5, position: 'absolute',
          top: 2, left: value ? 14 : 2,
          background: value ? C : CB,
          boxShadow: value ? '0 0 6px rgba(94,234,212,0.8)' : 'none',
          transition: 'left 0.15s',
        }} />
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', color: value ? CD : CM, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: '0.62rem', color: CB, marginTop: 1 }}>{hint}</div>}
      </div>
    </div>
  )

  return (
    <div>
      <SectionTitle>OAuth2 Login Page Branding</SectionTitle>
      <div style={{ fontSize: '0.72rem', color: CB, marginBottom: '0.5rem', padding: '0.6rem 0.85rem', border: `1px solid var(--border)`, background: 'var(--surface-1)', borderRadius: 5 }}>
        Customize the login page shown to end users at <code style={{ color: C }}>/login</code> (the OAuth2/OIDC user-facing page).
        These settings are stored server-side and read by the login template; updates apply on the next page load.
      </div>
      <div style={{ fontSize: '0.7rem', marginBottom: '1rem', padding: '0.55rem 0.85rem', border: `1px solid rgba(251,191,36,0.35)`, background: 'rgba(251,191,36,0.05)', borderRadius: 5, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 3L2 17h16L10 3z"/>
          <path strokeLinecap="round" d="M10 8v4M10 14h.01"/>
        </svg>
        <span>
          <strong>Global branding</strong> — all OAuth2 clients share a single login page.
          Changes saved here are immediately visible to <em>all users</em> logging in through any registered application.
        </span>
      </div>

      {saved && <div style={{ color: C, fontSize: '0.75rem', marginBottom: '0.75rem', padding: '0.4rem 0.75rem', border: '1px solid var(--accent-border)' }}>Saved.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        {/* LEFT — Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* Basic info */}
          <div style={{ background: SURFACE, border: `1px solid var(--border)`, padding: '1rem', borderRadius: 5 }}>
            <div style={{ fontSize: '0.6rem', color: CB, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.75rem' }}>Identity & Text</div>
            <Field label="Logo URL (optional)">
              <input style={inputStyle} value={form.logoUrl}
                onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))}
                placeholder="https://example.com/logo.png" />
            </Field>
            <Field label="Welcome / Heading text">
              <input style={inputStyle} value={form.welcomeText}
                onChange={e => setForm(f => ({ ...f, welcomeText: e.target.value }))}
                placeholder="Sign in to AO IDP" />
            </Field>
            <Field label="Footer text">
              <input style={inputStyle} value={form.footerText}
                onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))}
                placeholder="© 2026 AO" />
            </Field>
            <Field label="Font family">
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.fontFamily}
                onChange={e => setForm(f => ({ ...f, fontFamily: e.target.value }))}
              >
                <option value="">Default — JetBrains Mono (monospace)</option>
                <option value="Inter">Inter — Modern &amp; Clean</option>
                <option value="Outfit">Outfit — Geometric</option>
                <option value="DM Sans">DM Sans — Humanist</option>
                <option value="Nunito">Nunito — Rounded &amp; Friendly</option>
                <option value="Poppins">Poppins — Popular &amp; Geometric</option>
                <option value="Plus Jakarta Sans">Plus Jakarta Sans — Contemporary</option>
              </select>
              <div style={{ fontSize: '0.6rem', color: CB, marginTop: '0.3rem' }}>
                Served offline · applies to the entire login page
              </div>
            </Field>
          </div>

          {/* Colors */}
          <div style={{ background: SURFACE, border: `1px solid var(--border)`, padding: '1rem', borderRadius: 5 }}>
            <div style={{ fontSize: '0.6rem', color: CB, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.75rem' }}>Color Palette</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <ColorField label="Primary" value={form.primaryColor} onChange={v => setForm(f => ({ ...f, primaryColor: v }))} />
              <ColorField label="Background" value={form.bgColor} onChange={v => setForm(f => ({ ...f, bgColor: v }))} />
              <ColorField label="Text" value={form.textColor} onChange={v => setForm(f => ({ ...f, textColor: v }))} />
            </div>
          </div>

          {/* Behaviour */}
          <div style={{ background: SURFACE, border: `1px solid var(--border)`, padding: '1rem', borderRadius: 5 }}>
            <div style={{ fontSize: '0.6rem', color: CB, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>Session Behaviour</div>
            <Toggle
              value={form.continueAsEnabled}
              onClick={() => setForm(f => ({ ...f, continueAsEnabled: !f.continueAsEnabled }))}
              label="Show 'Continue as' panel"
              hint="When a user has a previous session cookie, show their profile on the login page (like Google). Disabling hides this panel entirely."
            />
          </div>

        </div>

        {/* RIGHT — Live preview */}
        <div style={{
          background: form.bgColor || '#0a0c10', color: form.textColor || '#e7ebf0',
          fontFamily: form.fontFamily ? `'${form.fontFamily}', sans-serif` : 'inherit',
          border: `1px solid var(--border)`, borderRadius: 5,
          padding: '2rem 1.5rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 400,
        }}>
          <div style={{ fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 14 }}>live preview</div>

          {/* Continue as panel (if enabled) */}
          {form.continueAsEnabled && (
            <div style={{
              width: '100%', maxWidth: 260, marginBottom: 10,
              border: `1.5px solid ${form.primaryColor}30`, borderLeft: `3px solid ${form.primaryColor}`,
              borderRadius: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${form.primaryColor}15`, border: `1px solid ${form.primaryColor}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: form.primaryColor, fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
              }}>J</div>
              <div>
                <div style={{ fontSize: '0.6rem', color: form.textColor, opacity: 0.5 }}>continue as</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: form.textColor }}>John Smith</div>
              </div>
              <div style={{ marginLeft: 'auto', color: form.primaryColor, fontSize: '0.8rem' }}>›</div>
            </div>
          )}

          {form.logoUrl ? (
            <img src={form.logoUrl} alt="logo" style={{ maxWidth: 120, maxHeight: 50, marginBottom: 14 }}
              onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
          ) : (
            <div style={{
              width: 48, height: 48, borderRadius: 10,
              background: form.primaryColor, marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: form.bgColor, fontWeight: 800, fontSize: '1.2rem',
            }}>AO</div>
          )}
          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>
            {form.welcomeText || 'Sign in to AO IDP'}
          </div>
          <div style={{ width: '100%', maxWidth: 260, marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Username" readOnly style={{
              padding: '8px 10px', borderRadius: 6, fontSize: '0.78rem',
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${form.primaryColor}33`,
              color: form.textColor, outline: 'none', fontFamily: 'inherit',
            }} />
            <input placeholder="Password" type="password" readOnly style={{
              padding: '8px 10px', borderRadius: 6, fontSize: '0.78rem',
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${form.primaryColor}33`,
              color: form.textColor, outline: 'none', fontFamily: 'inherit',
            }} />
            <button style={{
              padding: '8px 10px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700,
              background: form.primaryColor, color: form.bgColor, border: 'none', cursor: 'default',
            }}>Sign In</button>
          </div>
          <div style={{ fontSize: '0.62rem', opacity: 0.45, marginTop: 'auto', paddingTop: 20 }}>
            {form.footerText || '© AO IDP'}
          </div>
        </div>
      </div>

      {/* Custom CSS editor — full width */}
      <div style={{ background: SURFACE, border: `1px solid var(--border)`, borderRadius: 5, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.6rem 1rem', borderBottom: `1px solid var(--border)`,
          background: 'var(--surface-2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.62rem', color: CB, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>Custom CSS</span>
            <span style={{ fontSize: '0.62rem', color: CB, opacity: 0.6 }}>— injected at the end of &lt;style&gt; on the login page</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.6rem', color: CB, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Preset:</span>
            <select
              style={{ ...inputStyle, width: 'auto', padding: '3px 8px', fontSize: '0.65rem', cursor: 'pointer', color: C }}
              value={CSS_THEMES.find(t => t.css === form.customCss)?.key ?? ''}
              onChange={e => {
                const theme = CSS_THEMES.find(t => t.key === e.target.value)
                if (theme) setForm(f => ({ ...f, customCss: theme.css }))
              }}
            >
              <option value="">— select preset —</option>
              {CSS_THEMES.map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            <button style={{ ...btnSecondary, padding: '3px 9px', fontSize: '0.6rem' }}
              onClick={() => setForm(f => ({ ...f, customCss: '' }))}>
              ✕ clear
            </button>
            <button style={{ ...btnSecondary, padding: '3px 9px', fontSize: '0.6rem' }}
              onClick={() => setCssExpanded(x => !x)}>
              {cssExpanded ? '↑ collapse' : '↕ expand'}
            </button>
          </div>
        </div>
        <textarea
          value={form.customCss}
          onChange={e => setForm(f => ({ ...f, customCss: e.target.value }))}
          rows={cssExpanded ? 32 : 14}
          spellCheck={false}
          style={{
            ...inputStyle, width: '100%', display: 'block',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '0.75rem', lineHeight: 1.6,
            resize: 'vertical', border: 'none', borderRadius: 0,
            padding: '0.85rem 1rem',
            boxSizing: 'border-box',
          }}
          placeholder={`/* Paste full CSS overrides here. Example:
.card { border-radius: 16px; }
.btn { font-family: 'Inter', sans-serif; }

Click a theme button above to load a complete ready-made design. */`}
        />
        {form.customCss && (
          <div style={{ padding: '0.4rem 1rem', borderTop: `1px solid var(--border)`, background: 'var(--surface-2)', fontSize: '0.6rem', color: CB }}>
            {form.customCss.split('\n').length} lines · {form.customCss.length} chars
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button
          style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          onClick={() => window.open('/login?logged_out=1', '_blank', 'noopener,noreferrer')}
          title="Open the live login page in a new tab"
        >
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 3H4a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1v-6M13 3h4m0 0v4m0-4L9 11"/>
          </svg>
          preview login page
        </button>
        <button style={btnPrimary} onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? 'saving...' : '> save login branding'}
        </button>
      </div>
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.6rem', color: CD, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.3rem 0.45rem', background: 'var(--bg)', border: `1px solid var(--border)`, borderRadius: 3 }}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          onChange={e => onChange(e.target.value)}
          style={{ width: 24, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          style={{ flex: 1, minWidth: 0, padding: '2px 4px', background: 'transparent', border: 'none', color: 'var(--text)', fontFamily: 'monospace', fontSize: '0.7rem', outline: 'none' }} />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState<'appearance' | 'ldap' | 'tokens' | 'claims' | 'login' | 'login-branding' | 'security'>('appearance')

  const tabs = [
    { key: 'appearance', label: 'Appearance' },
    { key: 'ldap', label: 'LDAP Server' },
    { key: 'tokens', label: 'Token Expiry' },
    { key: 'claims', label: 'JWT Claims' },
    { key: 'login', label: 'Login Settings' },
    { key: 'login-branding', label: 'Login Branding' },
    { key: 'security', label: 'Security' },
  ] as const

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.625rem', color: CB, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>AO IDP</div>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: C, letterSpacing: '0.08em', textTransform: 'uppercase', textShadow: '0 0 8px rgba(94,234,212,0.5)' }}>Settings</h1>
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: '2rem' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '0.6rem 1.25rem', background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.key ? C : 'transparent'}`, color: tab === t.key ? C : CB, fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: tab === t.key ? 700 : 400, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', marginBottom: '-1px' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'appearance' && <AppearanceSection />}
      {tab === 'ldap' && <LdapSection />}
      {tab === 'tokens' && <TokenSection />}
      {tab === 'claims' && <ClaimsSection />}
      {tab === 'login' && <LoginSection />}
      {tab === 'login-branding' && <LoginBrandingSection />}
      {tab === 'security' && <SecuritySection />}
    </div>
  )
}
