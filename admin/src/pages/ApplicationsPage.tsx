import { useState, type KeyboardEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appsApi } from '../api/apps'
import { usersApi } from '../api/users'
import type { Application, User } from '../types'

const C = '#00ffff'
const CD = '#00d4e8'
const CM = '#009bb5'
const CB = '#006b8a'
const BORDER = 'rgba(0,255,255,0.2)'
const BORDER_H = 'rgba(0,255,255,0.4)'
const SURFACE = '#020d10'
const SURFACE2 = '#041520'

interface AppForm {
  name: string
  slug: string
  redirectUris: string[]
  allowedOrigins: string[]
  isPublicClient: boolean
}

const emptyForm: AppForm = { name: '', slug: '', redirectUris: [], allowedOrigins: [], isPublicClient: false }
const toSlug = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

const inputStyle = {
  width: '100%', padding: '.625rem .75rem', border: `1px solid ${BORDER}`,
  background: SURFACE2, color: C, fontFamily: 'inherit', fontSize: '.8125rem',
  outline: 'none', caretColor: C,
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="text-xs px-2 py-0.5 transition-all shrink-0"
      style={{ color: copied ? C : CM, border: `1px solid ${copied ? C : BORDER}`, background: 'transparent', cursor: 'pointer' }}
    >
      {copied ? 'copied!' : 'copy'}
    </button>
  )
}

function TagInput({ label, tags, onChange, placeholder, required }: {
  label: string; tags: string[]; onChange: (tags: string[]) => void; placeholder?: string; required?: boolean
}) {
  const [input, setInput] = useState('')

  function addTag(val: string) {
    const trimmed = val.trim()
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed])
    setInput('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input) }
    else if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1))
  }

  return (
    <div>
      <label className="block text-xs tracking-widest uppercase mb-1.5" style={{ color: CD }}>
        # {label} {required && <span style={{ color: CB }}>*</span>}
      </label>
      <div
        className="flex flex-wrap gap-1.5 p-2 cursor-text min-h-[42px]"
        style={{ border: `1px solid ${BORDER}`, background: SURFACE2 }}
        onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}
      >
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs shrink-0"
            style={{ background: 'rgba(0,255,255,0.08)', color: CD, border: `1px solid rgba(0,255,255,0.2)` }}>
            <span className="truncate max-w-[220px]">{tag}</span>
            <button type="button"
              onClick={e => { e.stopPropagation(); onChange(tags.filter(t => t !== tag)) }}
              style={{ color: CM, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0, fontSize: '0.85rem', flexShrink: 0 }}
            >×</button>
          </span>
        ))}
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          onBlur={() => { if (input.trim()) addTag(input) }}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{ flex: '1 0 140px', minWidth: 0, background: 'none', border: 'none', outline: 'none', color: C, fontFamily: 'inherit', fontSize: '0.8125rem', caretColor: C, padding: '2px 0' }}
        />
      </div>
      <p className="text-xs mt-1" style={{ color: CB }}>press Enter or comma to add</p>
    </div>
  )
}

function AppModal({ title, form, setForm, error, onSave, onClose, saving, isEdit, isPublicLocked }: {
  title: string; form: AppForm; setForm: React.Dispatch<React.SetStateAction<AppForm>>
  error: string; onSave: () => void; onClose: () => void; saving: boolean; isEdit: boolean; isPublicLocked?: boolean
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-auto border" style={{ background: '#000', borderColor: BORDER_H }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="text-sm font-bold tracking-wider" style={{ color: C }}>{'> '}{title.toLowerCase()}</div>
          <button onClick={onClose} style={{ color: CM, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
        </div>
        <div className="px-5 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 text-xs flex gap-2" style={{ color: '#ff3333', border: '1px solid rgba(255,51,51,0.3)', background: 'rgba(255,51,51,0.06)' }}>
              <span>[ERR]</span><span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs tracking-widest uppercase mb-1.5" style={{ color: CD }}># name *</label>
            <input style={inputStyle} value={form.name} onChange={e => {
              const n = e.target.value
              setForm(f => ({ ...f, name: n, slug: isEdit ? f.slug : toSlug(n) }))
            }} placeholder="my-application" autoFocus
              onFocus={e => { e.target.style.borderColor = C; e.target.style.boxShadow = '0 0 0 2px rgba(0,255,255,0.1)' }}
              onBlur={e => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none' }}
            />
          </div>

          <div>
            <label className="block text-xs tracking-widest uppercase mb-1.5" style={{ color: CD }}># slug *</label>
            <input style={{ ...inputStyle, color: isEdit ? CM : C }} value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              placeholder="my-application" disabled={isEdit}
            />
            {isEdit && <p className="text-xs mt-1" style={{ color: CB }}>slug is immutable after creation</p>}
          </div>

          <div>
            <label className="block text-xs tracking-widest uppercase mb-1.5" style={{ color: CD }}># client_type</label>
            {isPublicLocked ? (
              <div className="px-3 py-2 text-xs" style={{ border: `1px solid ${BORDER}`, background: SURFACE2, color: CM }}>
                <span style={{ color: form.isPublicClient ? '#ffaa00' : CD, fontWeight: 700 }}>
                  {form.isPublicClient ? 'public' : 'confidential'}
                </span>
                <span style={{ color: CB, marginLeft: '0.75rem' }}>· locked after creation</span>
              </div>
            ) : (
              <div className="flex gap-2">
                {[
                  { value: false, label: 'confidential', desc: 'server-side — has client_secret' },
                  { value: true, label: 'public', desc: 'SPA / native — PKCE, no secret' },
                ].map(opt => (
                  <button key={String(opt.value)} type="button"
                    onClick={() => setForm(f => ({ ...f, isPublicClient: opt.value }))}
                    className="flex-1 px-3 py-2 text-left text-xs transition-all"
                    style={{
                      border: `1px solid ${form.isPublicClient === opt.value ? C : BORDER}`,
                      background: form.isPublicClient === opt.value ? 'rgba(0,255,255,0.08)' : 'transparent',
                      color: form.isPublicClient === opt.value ? C : CM,
                      cursor: 'pointer',
                    }}
                  >
                    <div className="font-bold tracking-wide">{opt.label}</div>
                    <div className="mt-0.5 text-xs" style={{ color: CB }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <TagInput label="redirect_uris" required tags={form.redirectUris}
            onChange={uris => setForm(f => ({ ...f, redirectUris: uris }))}
            placeholder="https://app.ao.az/callback"
          />

          <TagInput label="allowed_origins" tags={form.allowedOrigins}
            onChange={origins => setForm(f => ({ ...f, allowedOrigins: origins }))}
            placeholder="https://app.ao.az"
          />

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2 text-xs tracking-wide"
              style={{ color: CM, border: `1px solid ${BORDER}`, background: 'none', cursor: 'pointer' }}>cancel</button>
            <button onClick={onSave} disabled={!form.name || !form.slug || saving}
              className="px-4 py-2 text-xs font-bold tracking-widest uppercase transition-all"
              style={{ color: '#000', background: (!form.name || !form.slug || saving) ? CM : C, border: `1px solid ${C}`, cursor: 'pointer' }}>
              {saving ? '...' : isEdit ? 'save' : 'create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ app, onDeactivate, onDelete, onClose, pending }: {
  app: Application
  onDeactivate: () => void
  onDelete: () => void
  onClose: () => void
  pending: boolean
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.88)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md border" style={{ background: '#000', borderColor: 'rgba(255,51,51,0.4)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid rgba(255,51,51,0.2)` }}>
          <div className="text-sm font-bold tracking-wider" style={{ color: '#ff3333' }}>{'> '}remove application</div>
          <button onClick={onClose} style={{ color: CM, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="text-xs space-y-1">
            <div style={{ color: C }}>application: <span className="font-bold">{app.name}</span></div>
            <div style={{ color: CM }}>client_id: <code style={{ color: CD }}>{app.client_id}</code></div>
          </div>

          <div className="space-y-2">
            <button onClick={onDeactivate} disabled={pending || !app.is_active}
              className="w-full p-3 text-left text-xs transition-all"
              style={{
                border: `1px solid rgba(255,136,0,${app.is_active ? '0.4' : '0.15'})`,
                background: 'rgba(255,136,0,0.04)',
                color: app.is_active ? '#ff8800' : CB,
                cursor: app.is_active ? 'pointer' : 'not-allowed',
              }}>
              <div className="font-bold tracking-wide mb-0.5">
                {app.is_active ? '⊘ deactivate' : '✓ already inactive'}
              </div>
              <div style={{ color: CB }}>
                {app.is_active
                  ? 'Disables login for this app. User access records preserved. Can be re-enabled.'
                  : 'This application is already inactive.'}
              </div>
            </button>

            <button onClick={onDelete} disabled={pending}
              className="w-full p-3 text-left text-xs transition-all"
              style={{ border: '1px solid rgba(255,51,51,0.4)', background: 'rgba(255,51,51,0.04)', color: '#ff3333', cursor: 'pointer' }}>
              <div className="font-bold tracking-wide mb-0.5">✕ permanently delete</div>
              <div style={{ color: CB }}>Irreversible. Deletes the app and revokes all user access records.</div>
            </button>
          </div>

          <button onClick={onClose} className="w-full py-2 text-xs tracking-wide"
            style={{ color: CM, border: `1px solid ${BORDER}`, background: 'none', cursor: 'pointer' }}>
            cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function AppUsersSection({ appId }: { appId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['app-users', appId],
    queryFn: () => usersApi.listForApp(appId, { size: 50 }),
  })

  if (isLoading) return <div className="text-xs py-1" style={{ color: CM }}>loading users...</div>
  if (!data?.content || data.content.length === 0) {
    return <div className="text-xs py-1" style={{ color: CB }}>no users have access to this app.</div>
  }

  return (
    <div className="space-y-1">
      {data.content.map((u: User) => (
        <div key={u.id} className="flex items-center justify-between px-2 py-1.5 text-xs"
          style={{ background: 'rgba(0,255,255,0.03)', border: `1px solid rgba(0,255,255,0.1)` }}>
          <span style={{ color: CD }}>{u.displayName}</span>
          <span style={{ color: CM }}>{u.ldapUsername}</span>
        </div>
      ))}
      {data.total_elements > 50 && (
        <div className="text-xs pt-1" style={{ color: CB }}>+{data.total_elements - 50} more users</div>
      )}
    </div>
  )
}

function AppCard({ app, onEdit, onRemove, onToggleActive }: {
  app: Application
  onEdit: () => void
  onRemove: () => void
  onToggleActive: () => void
}) {
  const [showSecret, setShowSecret] = useState(false)
  const [showUsers, setShowUsers] = useState(false)
  const inactive = !app.is_active

  return (
    <div className="border transition-all" style={{
      borderColor: inactive ? 'rgba(255,51,51,0.2)' : BORDER,
      background: inactive ? 'rgba(255,51,51,0.02)' : SURFACE,
      opacity: inactive ? 0.75 : 1,
    }}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-bold text-sm tracking-wide" style={{ color: inactive ? CM : C }}>{app.name}</div>
            <div className="text-xs mt-0.5" style={{ color: CB }}>{app.slug}</div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
            <span className="text-xs px-2 py-0.5 font-bold" style={{
              color: app.is_public_client ? '#ffaa00' : CD,
              border: `1px solid ${app.is_public_client ? 'rgba(255,170,0,0.3)' : 'rgba(0,179,204,0.3)'}`,
              background: app.is_public_client ? 'rgba(255,170,0,0.06)' : 'rgba(0,255,255,0.06)',
            }}>
              {app.is_public_client ? 'public' : 'confidential'}
            </span>
            <span className="text-xs px-2 py-0.5 font-bold" style={{
              color: app.is_active ? C : '#ff3333',
              border: `1px solid ${app.is_active ? 'rgba(0,255,255,0.3)' : 'rgba(255,51,51,0.3)'}`,
              background: app.is_active ? 'rgba(0,255,255,0.06)' : 'rgba(255,51,51,0.06)',
            }}>
              {app.is_active ? 'active' : 'inactive'}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs w-20 shrink-0" style={{ color: CB }}>client_id</span>
            <code className="text-xs flex-1 truncate px-2 py-1" style={{ color: CD, background: 'rgba(0,255,255,0.04)', border: `1px solid ${BORDER}` }}>{app.client_id}</code>
            <CopyButton text={app.client_id} />
          </div>
          {app.client_secret && (
            <div className="flex items-center gap-2">
              <span className="text-xs w-20 shrink-0" style={{ color: CB }}>secret</span>
              <code className="text-xs flex-1 truncate px-2 py-1" style={{ color: '#ffaa00', background: 'rgba(255,170,0,0.06)', border: '1px solid rgba(255,170,0,0.2)' }}>
                {showSecret ? app.client_secret : '•'.repeat(32)}
              </code>
              <button onClick={() => setShowSecret(s => !s)} className="text-xs shrink-0"
                style={{ color: CM, background: 'none', border: 'none', cursor: 'pointer' }}>
                {showSecret ? 'hide' : 'show'}
              </button>
              {showSecret && <CopyButton text={app.client_secret} />}
            </div>
          )}
        </div>

        {app.redirect_uris?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {app.redirect_uris.map(uri => (
              <span key={uri} className="text-xs px-2 py-0.5 truncate max-w-[200px]"
                style={{ color: CM, border: `1px solid ${BORDER}`, background: 'rgba(0,255,255,0.03)' }}>{uri}</span>
            ))}
          </div>
        )}

        {showUsers && (
          <div className="pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div className="text-xs mb-2" style={{ color: CB }}>users with access:</div>
            <AppUsersSection appId={app.id} />
          </div>
        )}
      </div>

      <div className="flex" style={{ borderTop: `1px solid ${BORDER}` }}>
        <button onClick={onEdit}
          className="flex-1 px-3 py-2 text-xs tracking-wide"
          style={{ color: CD, background: 'none', border: 'none', borderRight: `1px solid ${BORDER}`, cursor: 'pointer' }}>
          {'> '}edit
        </button>
        <button onClick={() => setShowUsers(s => !s)}
          className="flex-1 px-3 py-2 text-xs tracking-wide"
          style={{ color: CM, background: 'none', border: 'none', borderRight: `1px solid ${BORDER}`, cursor: 'pointer' }}>
          {'> '}{showUsers ? 'hide users' : 'users'}
        </button>
        {inactive ? (
          <button onClick={onToggleActive}
            className="flex-1 px-3 py-2 text-xs tracking-wide"
            style={{ color: C, background: 'none', border: 'none', borderRight: `1px solid ${BORDER}`, cursor: 'pointer' }}>
            {'> '}activate
          </button>
        ) : null}
        <button onClick={onRemove}
          className="flex-1 px-3 py-2 text-xs tracking-wide"
          style={{ color: '#ff3333', background: 'none', border: 'none', cursor: 'pointer' }}>
          {'> '}remove
        </button>
      </div>
    </div>
  )
}

export default function ApplicationsPage() {
  const qc = useQueryClient()
  const { data: apps, isLoading, error } = useQuery({ queryKey: ['apps'], queryFn: appsApi.list })
  const [showCreate, setShowCreate] = useState(false)
  const [editApp, setEditApp] = useState<Application | null>(null)
  const [removeApp, setRemoveApp] = useState<Application | null>(null)
  const [form, setForm] = useState<AppForm>(emptyForm)
  const [newSecret, setNewSecret] = useState<{ clientId: string; clientSecret: string } | null>(null)
  const [formError, setFormError] = useState('')
  const [showInactive, setShowInactive] = useState(true)

  const createMut = useMutation({
    mutationFn: (f: AppForm) => appsApi.create({
      name: f.name, slug: f.slug,
      redirectUris: f.redirectUris, allowedOrigins: f.allowedOrigins,
      isPublicClient: f.isPublicClient,
    }),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['apps'] })
      setShowCreate(false); setForm(emptyForm)
      if ((data as Application & { client_secret?: string }).client_secret) {
        setNewSecret({ clientId: (data as any).client_id, clientSecret: (data as any).client_secret })
      }
    },
    onError: (e: any) => setFormError(e.response?.data?.error_description ?? 'create failed'),
  })

  const updateMut = useMutation({
    mutationFn: (f: AppForm) => appsApi.update(editApp!.id, {
      name: f.name, slug: f.slug,
      redirectUris: f.redirectUris, allowedOrigins: f.allowedOrigins,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['apps'] }); setEditApp(null); setForm(emptyForm) },
    onError: (e: any) => setFormError(e.response?.data?.error_description ?? 'update failed'),
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => appsApi.deactivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['apps'] }); setRemoveApp(null) },
  })

  const activateMut = useMutation({
    mutationFn: (id: string) => appsApi.activate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['apps'] }) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => appsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['apps'] }); setRemoveApp(null) },
  })

  function openEdit(app: Application) {
    setForm({
      name: app.name,
      slug: app.slug,
      redirectUris: app.redirect_uris ?? [],
      allowedOrigins: app.allowed_origins ?? [],
      isPublicClient: app.is_public_client ?? false,
    })
    setFormError(''); setEditApp(app)
  }

  const displayed = apps
    ? (showInactive ? apps : apps.filter(a => a.is_active))
    : []

  const inactiveCount = apps ? apps.filter(a => !a.is_active).length : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs tracking-widest uppercase mb-1" style={{ color: CB }}>oauth2 clients</div>
          <h1 className="text-xl font-bold tracking-wider" style={{ color: C }}>{'> '}applications</h1>
        </div>
        <div className="flex items-center gap-3">
          {inactiveCount > 0 && (
            <button onClick={() => setShowInactive(s => !s)}
              className="text-xs px-3 py-1.5 tracking-wide"
              style={{ color: showInactive ? '#ff3333' : CB, border: `1px solid ${showInactive ? 'rgba(255,51,51,0.3)' : BORDER}`, background: 'none', cursor: 'pointer' }}>
              {showInactive ? `hide inactive (${inactiveCount})` : `show inactive (${inactiveCount})`}
            </button>
          )}
          <button onClick={() => { setForm(emptyForm); setFormError(''); setShowCreate(true) }}
            className="px-4 py-2 text-xs font-bold tracking-widest uppercase transition-all"
            style={{ color: '#000', background: C, border: `1px solid ${C}`, cursor: 'pointer' }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = C }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = C; (e.target as HTMLElement).style.color = '#000' }}>
            + new app
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs" style={{ color: CM }}>{'> '}loading...</div>
      ) : error ? (
        <div className="text-xs" style={{ color: '#ff3333' }}>[ERR] failed to load applications.</div>
      ) : !displayed || displayed.length === 0 ? (
        <div className="p-16 text-center border" style={{ borderColor: BORDER, background: SURFACE }}>
          <div className="text-xs tracking-wide" style={{ color: CB }}>no applications registered.</div>
          <div className="text-xs mt-1" style={{ color: CB }}>{'> '}create your first oauth2 client.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayed.map(app => (
            <AppCard key={app.id} app={app}
              onEdit={() => openEdit(app)}
              onRemove={() => setRemoveApp(app)}
              onToggleActive={() => activateMut.mutate(app.id)}
            />
          ))}
        </div>
      )}

      {(showCreate || editApp) && (
        <AppModal
          title={editApp ? 'edit application' : 'new application'}
          form={form} setForm={setForm} error={formError}
          isEdit={!!editApp}
          isPublicLocked={!!editApp}
          saving={createMut.isPending || updateMut.isPending}
          onSave={() => { setFormError(''); editApp ? updateMut.mutate(form) : createMut.mutate(form) }}
          onClose={() => { setShowCreate(false); setEditApp(null) }}
        />
      )}

      {removeApp && (
        <DeleteConfirmModal
          app={removeApp}
          pending={deactivateMut.isPending || deleteMut.isPending}
          onDeactivate={() => deactivateMut.mutate(removeApp.id)}
          onDelete={() => deleteMut.mutate(removeApp.id)}
          onClose={() => setRemoveApp(null)}
        />
      )}

      {newSecret && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div className="w-full max-w-md p-8 border" style={{ background: '#000', borderColor: C, boxShadow: `0 0 40px rgba(0,255,255,0.15)` }}>
            <div className="mb-5">
              <div className="text-xs tracking-widest uppercase mb-1" style={{ color: CB }}>application created</div>
              <div className="font-bold tracking-wider" style={{ color: C }}>save credentials now</div>
              <div className="text-xs mt-1" style={{ color: CM }}>client_secret is shown only once</div>
            </div>

            <div className="p-3 mb-5 text-xs" style={{ color: '#ffaa00', border: '1px solid rgba(255,170,0,0.3)', background: 'rgba(255,170,0,0.06)' }}>
              [WARN] store the secret securely — it cannot be retrieved again.
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs tracking-widest uppercase mb-1" style={{ color: CB }}>client_id</label>
                <div className="flex gap-2">
                  <input readOnly value={newSecret.clientId} className="flex-1 px-3 py-2 text-xs select-all"
                    style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: CD, fontFamily: 'inherit' }} />
                  <CopyButton text={newSecret.clientId} />
                </div>
              </div>
              <div>
                <label className="block text-xs tracking-widest uppercase mb-1" style={{ color: CB }}>client_secret</label>
                <div className="flex gap-2">
                  <input readOnly value={newSecret.clientSecret} className="flex-1 px-3 py-2 text-xs font-bold select-all"
                    style={{ background: 'rgba(255,170,0,0.06)', border: '1px solid rgba(255,170,0,0.3)', color: '#ffaa00', fontFamily: 'inherit' }} />
                  <CopyButton text={newSecret.clientSecret} />
                </div>
              </div>
            </div>

            <button onClick={() => setNewSecret(null)}
              className="w-full py-2.5 text-xs font-bold tracking-widest uppercase"
              style={{ color: '#000', background: C, border: `1px solid ${C}`, cursor: 'pointer' }}>
              credentials saved — close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
