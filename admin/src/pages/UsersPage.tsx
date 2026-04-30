import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/users'
import { appsApi } from '../api/apps'
import { ConfirmModal } from '../components/ConfirmModal'
import type { LdapUser, Application, User, AppAccess } from '../types'

const C = {
  bg: '#000',
  surface: '#020d10',
  surface2: '#041520',
  border: 'rgba(0,255,255,0.15)',
  borderHover: 'rgba(0,255,255,0.35)',
  green: '#00ffff',
  greenDim: '#00d4e8',
  text: '#00ffff',
  textDim: '#009bb5',
  textMuted: '#006b8a',
  red: '#ff3333',
  amber: '#ff8800',
}

const inputStyle = {
  padding: '.5rem .75rem', border: `1px solid ${C.border}`,
  borderRadius: 6, background: C.surface2, color: C.text, fontFamily: 'inherit', fontSize: '.8125rem',
  outline: 'none', width: '100%',
}

function ActivateModal({ user, apps, onClose }: { user: LdapUser; apps: Application[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [appId, setAppId] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => usersApi.activateForApp(appId, user.ldap_username),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['ldap-users'] })
      onClose()
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setError(e.response?.data?.message ?? 'Activation failed')
    },
  })

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md rounded-lg border" style={{ background: C.surface, borderColor: C.borderHover }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.border }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: C.text }}>Grant App Access</div>
            <div className="text-xs mt-0.5" style={{ color: C.textDim }}>{user.display_name} · {user.ldap_username}</div>
          </div>
          <button onClick={onClose} style={{ color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="p-3 rounded border text-xs" style={{ background: C.surface2, borderColor: C.border }}>
            {user.email && <div><span style={{ color: C.textMuted }}>email: </span><span style={{ color: C.textDim }}>{user.email}</span></div>}
            {user.title && <div className="mt-1"><span style={{ color: C.textMuted }}>title: </span><span style={{ color: C.textDim }}>{user.title}</span></div>}
            {user.ou && <div className="mt-1"><span style={{ color: C.textMuted }}>ou: </span><span style={{ color: C.textDim }}>{user.ou}</span></div>}
          </div>

          {error && (
            <div className="px-3 py-2 text-xs rounded border" style={{ color: C.red, borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.06)' }}>{error}</div>
          )}

          <div>
            <label className="block text-xs mb-1.5" style={{ color: C.textDim }}>Application</label>
            <select style={{ ...inputStyle, appearance: 'none' }} value={appId} onChange={e => setAppId(e.target.value)}>
              <option value="" style={{ background: C.surface }}>Select application...</option>
              {apps.map(a => <option key={a.id} value={a.id} style={{ background: C.surface }}>{a.name}</option>)}
            </select>
          </div>

          <p className="text-xs" style={{ color: C.textMuted }}>
            This grants the user access to authenticate with this application via AO ID.
          </p>

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2 text-xs rounded"
              style={{ color: C.textDim, border: `1px solid ${C.border}`, background: 'none', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => mutation.mutate()} disabled={!appId || mutation.isPending}
              className="px-4 py-2 text-xs font-semibold rounded"
              style={{ color: '#000', background: (!appId || mutation.isPending) ? C.greenDim : C.green, border: 'none', cursor: 'pointer' }}>
              {mutation.isPending ? 'Granting...' : 'Grant Access'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppAccessChips({ userId }: { userId: string }) {
  const qc = useQueryClient()
  const [confirmRevoke, setConfirmRevoke] = useState<AppAccess | null>(null)

  const { data: accesses = [], isLoading } = useQuery({
    queryKey: ['user-app-access', userId],
    queryFn: () => usersApi.getUserAppAccess(userId),
  })

  const revokeMutation = useMutation({
    mutationFn: (access: AppAccess) => usersApi.revokeAppAccess(access.appId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-app-access', userId] })
      qc.invalidateQueries({ queryKey: ['ldap-users'] })
      setConfirmRevoke(null)
    },
  })

  if (isLoading) return <span className="text-xs" style={{ color: C.textMuted }}>Loading...</span>
  if (accesses.length === 0) return <span className="text-xs" style={{ color: C.textMuted }}>No app access</span>

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {accesses.map(a => (
          <span key={a.appId} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
            style={{ background: 'rgba(0,255,255,0.08)', color: C.green, border: '1px solid rgba(0,255,255,0.2)' }}>
            {a.appName}
            <button onClick={() => setConfirmRevoke(a)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.greenDim, lineHeight: 1, padding: 0, fontSize: '0.75rem' }}
              title={`Revoke access to ${a.appName}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      {confirmRevoke && (
        <ConfirmModal
          title="Revoke App Access"
          message={`Remove access to ${confirmRevoke.appName}? The user won't be able to log in via this app.`}
          itemName={confirmRevoke.appName}
          confirmLabel="Revoke"
          isPending={revokeMutation.isPending}
          onConfirm={() => revokeMutation.mutate(confirmRevoke)}
          onClose={() => setConfirmRevoke(null)}
        />
      )}
    </>
  )
}

function LdapUserRow({ user, apps }: { user: LdapUser; apps: Application[] }) {
  const [showActivate, setShowActivate] = useState(false)

  return (
    <>
      <div className="flex gap-4 items-center px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: user.is_activated ? C.green : C.textDim }}>{user.display_name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
              color: user.is_activated ? C.green : C.textMuted,
              background: user.is_activated ? 'rgba(0,255,255,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${user.is_activated ? 'rgba(0,255,255,0.25)' : C.border}`,
            }}>
              {user.is_activated ? 'activated' : 'not activated'}
            </span>
          </div>
          <div className="flex gap-3 flex-wrap mt-0.5">
            <span className="text-xs" style={{ color: C.textDim }}>{user.ldap_username}</span>
            {user.email && <span className="text-xs" style={{ color: C.textMuted }}>{user.email}</span>}
            {user.ou && <span className="text-xs" style={{ color: C.textMuted }}>[{user.ou}]</span>}
            {user.ldap_server_name && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,204,255,0.08)', color: '#00ccff', border: '1px solid rgba(0,204,255,0.2)' }}>
                {user.ldap_server_name}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setShowActivate(true)}
            className="px-3 py-1.5 text-xs rounded transition-opacity hover:opacity-80"
            style={{ color: C.green, border: `1px solid rgba(0,255,255,0.3)`, background: 'rgba(0,255,255,0.06)', cursor: 'pointer' }}>
            + Grant access
          </button>
        </div>
      </div>

      {showActivate && <ActivateModal user={user} apps={apps} onClose={() => setShowActivate(false)} />}
    </>
  )
}

function DirectoryTab({ apps }: { apps: Application[] }) {
  const [search, setSearch] = useState('')
  const [filterActivated, setFilterActivated] = useState<'all' | 'activated' | 'not_activated'>('all')

  const { data: allUsers = [], isLoading, error } = useQuery({
    queryKey: ['ldap-users', search],
    queryFn: () => usersApi.listLdap(search || undefined),
    retry: false,
  })

  const notConfigured = (error as any)?.response?.status === 503

  const filtered = allUsers.filter(u => {
    if (filterActivated === 'activated') return u.is_activated
    if (filterActivated === 'not_activated') return !u.is_activated
    return true
  })

  const total = allUsers.length
  const activatedCount = allUsers.filter(u => u.is_activated).length

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total', value: total },
          { label: 'Activated', value: activatedCount, accent: true },
          { label: 'Pending', value: total - activatedCount },
        ].map(st => (
          <div key={st.label} className="p-4 rounded border" style={{ background: C.surface, borderColor: C.border }}>
            <div className="text-2xl font-bold tabular-nums" style={{ color: st.accent ? C.green : C.text }}>{st.value}</div>
            <div className="text-xs mt-0.5" style={{ color: C.textMuted }}>{st.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, username, email..."
          style={{ ...inputStyle, width: '18rem' }}
        />
        <select value={filterActivated} onChange={e => setFilterActivated(e.target.value as typeof filterActivated)}
          style={{ ...inputStyle, width: 'auto', appearance: 'none' }}>
          <option value="all" style={{ background: C.surface }}>All users</option>
          <option value="activated" style={{ background: C.surface }}>Activated</option>
          <option value="not_activated" style={{ background: C.surface }}>Not activated</option>
        </select>
      </div>

      {notConfigured ? (
        <div className="rounded border p-10 text-center" style={{ borderColor: C.border, background: C.surface }}>
          <div className="text-sm mb-2" style={{ color: '#ff8800' }}>No LDAP server configured</div>
          <div className="text-xs" style={{ color: C.textMuted }}>
            Go to <span style={{ color: C.green }}>Settings → LDAP Server</span> to add and activate an LDAP connection.
          </div>
        </div>
      ) : (
        <div className="rounded border overflow-hidden" style={{ borderColor: C.border, background: C.surface }}>
          {isLoading ? (
            <div className="p-6 text-xs" style={{ color: C.textMuted }}>Loading directory...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-xs" style={{ color: C.textMuted }}>No users found.</div>
          ) : (() => {
            const groups = new Map<string, typeof filtered>()
            for (const u of filtered) {
              const key = u.ldap_server_name ?? 'Unknown Server'
              const grp = groups.get(key) ?? []
              grp.push(u)
              groups.set(key, grp)
            }
            return Array.from(groups.entries()).map(([serverName, users]) => (
              <div key={serverName}>
                <div className="px-4 py-2 text-xs font-semibold tracking-widest uppercase" style={{ background: 'rgba(0,204,255,0.06)', color: '#00ccff', borderBottom: `1px solid rgba(0,204,255,0.15)` }}>
                  {serverName} <span style={{ color: C.textMuted, fontWeight: 400 }}>({users.length})</span>
                </div>
                {users.map(user => <LdapUserRow key={user.ldap_username} user={user} apps={apps} />)}
              </div>
            ))
          })()}
        </div>
      )}
    </div>
  )
}

function ActivatedTab() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [confirmUser, setConfirmUser] = useState<User | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => usersApi.list({ search: search || undefined }),
  })

  const blockMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['ldap-users'] })
      setConfirmUser(null)
    },
  })

  return (
    <div>
      <div className="mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search activated users..."
          style={{ ...inputStyle, width: '18rem' }}
        />
      </div>

      <div className="rounded border overflow-hidden" style={{ borderColor: C.border, background: C.surface }}>
        {isLoading ? (
          <div className="p-8 text-center text-xs" style={{ color: C.textMuted }}>Loading...</div>
        ) : !data?.content || data.content.length === 0 ? (
          <div className="p-10 text-center text-xs" style={{ color: C.textMuted }}>
            No activated users. Grant access from the Directory tab.
          </div>
        ) : (
          data.content.map(user => (
            <div key={user.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: user.active ? C.text : C.textMuted }}>{user.displayName}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                      color: user.active ? C.green : C.red,
                      background: user.active ? 'rgba(0,255,255,0.1)' : 'rgba(248,113,113,0.1)',
                      border: `1px solid ${user.active ? 'rgba(0,255,255,0.25)' : 'rgba(248,113,113,0.25)'}`,
                    }}>
                      {user.active ? 'active' : 'blocked'}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs flex-wrap" style={{ color: C.textMuted }}>
                    <span>{user.ldapUsername}</span>
                    {user.email && <span>{user.email}</span>}
                    {user.ldapServerName && (
                      <span style={{ color: '#00ccff' }}>{user.ldapServerName}</span>
                    )}
                    <span>Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'never'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                    className="px-3 py-1.5 text-xs rounded transition-opacity hover:opacity-80"
                    style={{ color: C.textDim, border: `1px solid ${C.border}`, background: 'none', cursor: 'pointer' }}>
                    {expandedUser === user.id ? 'Hide' : 'App access'}
                  </button>
                  {user.active && (
                    <button onClick={() => setConfirmUser(user)}
                      className="px-3 py-1.5 text-xs rounded"
                      style={{ color: C.red, border: '1px solid rgba(248,113,113,0.25)', background: 'none', cursor: 'pointer' }}>
                      Block all
                    </button>
                  )}
                </div>
              </div>

              {expandedUser === user.id && (
                <div className="px-4 pb-3">
                  <div className="text-xs mb-2" style={{ color: C.textMuted }}>App access (click × to revoke per app):</div>
                  <AppAccessChips userId={user.id} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {confirmUser && (
        <ConfirmModal
          title="Block User"
          message="This will block the user from all applications. Their per-app access records remain intact."
          itemName={confirmUser.ldapUsername}
          confirmLabel="Block"
          isPending={blockMutation.isPending}
          onConfirm={() => blockMutation.mutate(confirmUser.id)}
          onClose={() => setConfirmUser(null)}
        />
      )}
    </div>
  )
}

type Tab = 'directory' | 'activated'

export default function UsersPage() {
  const [tab, setTab] = useState<Tab>('directory')

  const { data: allApps = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => appsApi.list(),
  })
  const apps = allApps.filter(a => a.is_active)

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs tracking-widest uppercase mb-1" style={{ color: C.textMuted }}>ldap / idp</div>
        <h1 className="text-xl font-bold" style={{ color: C.green }}>Users</h1>
      </div>

      <div className="flex gap-1 mb-6">
        {(['directory', 'activated'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2 text-xs font-semibold rounded transition-all capitalize"
            style={{
              color: tab === t ? '#000' : C.textDim,
              background: tab === t ? C.green : 'transparent',
              border: `1px solid ${tab === t ? C.green : C.border}`,
              cursor: 'pointer',
            }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'directory' && <DirectoryTab apps={apps} />}
      {tab === 'activated' && <ActivatedTab />}
    </div>
  )
}
