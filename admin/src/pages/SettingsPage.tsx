import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi, LdapServerConfig, LdapConfigRequest, TokenSettings, ClaimMapping } from '../api/settings'

const C = '#00ffff', CD = '#00d4e8', CM = '#009bb5', CB = '#006b8a', ERR = '#ff4444'
const BORDER = 'rgba(0,255,255,0.18)', SURFACE = '#020d10'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem', background: '#000',
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
                      border: `1px solid ${used ? 'rgba(0,255,255,0.1)' : BORDER}`,
                      background: used ? 'rgba(0,255,255,0.04)' : 'transparent',
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
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 36px', borderBottom: `1px solid rgba(0,255,255,0.06)`, padding: '0.3rem 0.5rem', alignItems: 'center', gap: '0.25rem' }}>
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

const emptyLdapForm = (): LdapConfigRequest => ({
  name: '', url: 'ldaps://', baseDn: 'DC=ao,DC=az',
  serviceAccountDn: '', serviceAccountPassword: '',
  usernameAttribute: 'sAMAccountName', userObjectClass: 'user',
  additionalUserFilter: '', claimMappings: undefined,
})

function ActiveConnectionPanel({ config }: { config: LdapServerConfig }) {
  return (
    <div style={{ border: `1px solid ${C}`, background: 'rgba(0,255,255,0.03)', padding: '1rem 1.25rem', marginBottom: '1.5rem', boxShadow: '0 0 16px rgba(0,255,255,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: C, boxShadow: '0 0 6px rgba(0,255,255,0.8)', flexShrink: 0 }} />
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Active Connection — {config.name}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem 2rem' }}>
        {[
          { label: 'URL', value: config.url },
          { label: 'Base DN', value: config.baseDn },
          { label: 'Service Account', value: config.serviceAccountDn },
          { label: 'Username Attribute', value: config.usernameAttribute },
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
  const [form, setForm] = useState<LdapConfigRequest>(emptyLdapForm())
  const [formClaims, setFormClaims] = useState<ClaimMapping[]>([])
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [formError, setFormError] = useState('')
  const [testing, setTesting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<LdapServerConfig | null>(null)
  const [formAttrs, setFormAttrs] = useState<Record<string, string> | undefined>(undefined)

  const activeConfig = configs.find(c => c.active)
  const isEdit = !!editTarget

  const { data: availableAttrs } = useQuery({
    queryKey: ['ldap-attributes'],
    queryFn: settingsApi.ldap.attributes,
    enabled: !!activeConfig,
    retry: false,
    staleTime: 60_000,
  })

  const openCreate = () => {
    setEditTarget(null); setForm(emptyLdapForm()); setFormClaims([]); setTestResult(null); setFormError(''); setFormAttrs(undefined); setShowForm(true)
  }
  const openEdit = (c: LdapServerConfig) => {
    setEditTarget(c)
    setForm({
      name: c.name, url: c.url, baseDn: c.baseDn, serviceAccountDn: c.serviceAccountDn,
      serviceAccountPassword: '', usernameAttribute: c.usernameAttribute,
      userObjectClass: c.userObjectClass, additionalUserFilter: c.additionalUserFilter ?? '',
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
      {activeConfig && <ActiveConnectionPanel config={activeConfig} />}

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
        <div key={c.id} style={{ border: `1px solid ${c.active ? C : BORDER}`, background: SURFACE, padding: '0.875rem 1.25rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: c.active ? '0 0 12px rgba(0,255,255,0.08)' : 'none', opacity: c.active ? 1 : 0.7 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: c.active ? C : CD }}>{c.name}</span>
              {c.active && <span style={{ fontSize: '0.5rem', padding: '0.12rem 0.4rem', border: `1px solid ${C}`, color: C, letterSpacing: '0.1em', textTransform: 'uppercase' }}>active</span>}
            </div>
            <div style={{ fontSize: '0.7rem', color: CB }}>{c.url} · {c.baseDn}</div>
            <div style={{ fontSize: '0.65rem', color: CB, marginTop: '0.1rem' }}>
              {c.usernameAttribute} / {c.userObjectClass}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <Field label="Name"><input style={inputStyle} value={form.name} onChange={f('name')} placeholder="Production AD" /></Field>
            <Field label="URL"><input style={inputStyle} value={form.url} onChange={f('url')} placeholder="ldaps://ldap.ao.az:636" /></Field>
            <Field label="Base DN"><input style={inputStyle} value={form.baseDn} onChange={f('baseDn')} placeholder="DC=ao,DC=az" /></Field>
            <Field label="Service Account DN"><input style={inputStyle} value={form.serviceAccountDn} onChange={f('serviceAccountDn')} placeholder="CN=idp-svc,OU=Service,DC=ao,DC=az" /></Field>
            <Field label={isEdit ? 'Service Account Password (blank = keep)' : 'Service Account Password'}>
              <input style={inputStyle} type="password" value={form.serviceAccountPassword} onChange={f('serviceAccountPassword')} autoComplete="new-password" />
            </Field>
            <Field label="Username Attribute"><input style={inputStyle} value={form.usernameAttribute} onChange={f('usernameAttribute')} placeholder="sAMAccountName" /></Field>
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
            <div style={{ padding: '0.5rem 0.75rem', border: `1px solid ${testResult.success ? 'rgba(0,255,255,0.3)' : 'rgba(255,68,68,0.3)'}`, color: testResult.success ? C : ERR, fontSize: '0.75rem', marginBottom: '1rem' }}>
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
      {saved && <div style={{ color: C, fontSize: '0.75rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', border: '1px solid rgba(0,255,255,0.3)' }}>Saved.</div>}
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
    queryFn: () => settingsApi.ldap.attributes(),
    enabled: config.active,
    retry: false,
    staleTime: 60_000,
  })

  const saveMut = useMutation({
    mutationFn: () => settingsApi.ldap.update(config.id, {
      name: config.name, url: config.url, baseDn: config.baseDn,
      serviceAccountDn: config.serviceAccountDn, serviceAccountPassword: undefined,
      usernameAttribute: config.usernameAttribute, userObjectClass: config.userObjectClass,
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
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: config.active ? C : CB, boxShadow: config.active ? '0 0 5px rgba(0,255,255,0.8)' : 'none', flexShrink: 0 }} />
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: config.active ? C : CD }}>{config.name}</span>
        {config.active && <span style={{ fontSize: '0.5rem', padding: '0.1rem 0.4rem', border: `1px solid ${C}`, color: C, letterSpacing: '0.1em', textTransform: 'uppercase' }}>active</span>}
        <span style={{ fontSize: '0.65rem', color: CB, marginLeft: 'auto' }}>{config.url} · {config.baseDn}</span>
      </div>

      {saved && <div style={{ color: C, fontSize: '0.7rem', marginBottom: '0.75rem', padding: '0.4rem 0.6rem', border: '1px solid rgba(0,255,255,0.3)' }}>Saved.</div>}
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
      <div style={{ fontSize: '0.65rem', color: CB, marginBottom: '1.25rem', padding: '0.5rem 0.75rem', border: `1px solid rgba(0,153,181,0.25)`, background: 'rgba(0,153,181,0.04)' }}>
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

export default function SettingsPage() {
  const [tab, setTab] = useState<'ldap' | 'tokens' | 'claims'>('ldap')

  const tabs = [
    { key: 'ldap', label: 'LDAP Server' },
    { key: 'tokens', label: 'Token Expiry' },
    { key: 'claims', label: 'JWT Claims' },
  ] as const

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.625rem', color: CB, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>AO IDP</div>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: C, letterSpacing: '0.08em', textTransform: 'uppercase', textShadow: '0 0 8px rgba(0,255,255,0.5)' }}>Settings</h1>
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: '2rem' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '0.6rem 1.25rem', background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.key ? C : 'transparent'}`, color: tab === t.key ? C : CB, fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: tab === t.key ? 700 : 400, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', marginBottom: '-1px' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ldap' && <LdapSection />}
      {tab === 'tokens' && <TokenSection />}
      {tab === 'claims' && <ClaimsSection />}
    </div>
  )
}
