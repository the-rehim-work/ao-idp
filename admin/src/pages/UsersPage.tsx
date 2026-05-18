import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/users'
import { appsApi } from '../api/apps'
import { settingsApi } from '../api/settings'
import { ConfirmModal } from '../components/ConfirmModal'
import type { LdapUser, Application, User, AppAccess } from '../types'

const C = {
  bg:           'var(--bg)',
  surface:      'var(--surface-1)',
  surface2:     'var(--surface-2)',
  surface3:     'var(--surface-3)',
  border:       'var(--border)',
  borderFaint:  'var(--border-faint)',
  borderHover:  'var(--border-hover)',
  green:        'var(--accent)',
  greenDim:     'var(--accent-strong)',
  accentSoft:   'var(--accent-soft)',
  text:         'var(--text)',
  textDim:      'var(--text-dim)',
  textMuted:    'var(--text-muted)',
  red:          'var(--danger)',
  amber:        'var(--warning)',
  info:         'var(--info)',
  purple:       'var(--purple)',
}
const SANS = "'Inter','Segoe UI',system-ui,-apple-system,sans-serif"

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
            style={{ background: 'var(--accent-soft)', color: C.green, border: '1px solid rgba(94,234,212,0.2)' }}>
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
              background: user.is_activated ? 'rgba(94,234,212,0.1)' : 'var(--border-faint)',
              border: `1px solid ${user.is_activated ? 'var(--accent-medium)' : C.border}`,
            }}>
              {user.is_activated ? 'activated' : 'not activated'}
            </span>
          </div>
          <div className="flex gap-3 flex-wrap mt-0.5">
            <span className="text-xs" style={{ color: C.textDim }}>{user.ldap_username}</span>
            {user.email && <span className="text-xs" style={{ color: C.textMuted }}>{user.email}</span>}
            {user.ou && <span className="text-xs" style={{ color: C.textMuted }}>[{user.ou}]</span>}
            {user.ldap_server_name && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                {user.ldap_server_name}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setShowActivate(true)}
            className="px-3 py-1.5 text-xs rounded transition-opacity hover:opacity-80"
            style={{ color: C.green, border: `1px solid rgba(94,234,212,0.3)`, background: 'var(--accent-soft)', cursor: 'pointer' }}>
            + Grant access
          </button>
        </div>
      </div>

      {showActivate && <ActivateModal user={user} apps={apps} onClose={() => setShowActivate(false)} />}
    </>
  )
}

function ServerStatusBadge({ serverId, serverName }: { serverId: string; serverName: string }) {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const test = async () => {
    setTesting(true)
    setResult(null)
    try {
      const r = await settingsApi.ldap.testById(serverId)
      setResult(r)
    } catch {
      setResult({ success: false, message: 'Request failed' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', borderRadius: 8,
      border: `1px solid ${result ? (result.success ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)') : C.borderFaint}`,
      background: result ? (result.success ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)') : C.surface2,
      fontFamily: SANS, fontSize: '0.72rem',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: result ? (result.success ? C.green : C.red) : C.textMuted,
      }} />
      <span style={{ color: C.textDim, fontWeight: 500 }}>{serverName}</span>
      {result && (
        <span style={{ color: result.success ? C.green : C.red }}>
          {result.success ? 'reachable' : result.message.slice(0, 40)}
        </span>
      )}
      <button onClick={test} disabled={testing} style={{
        marginLeft: 4, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
        border: `1px solid ${C.borderFaint}`, background: 'none',
        color: C.textMuted, fontSize: '0.68rem', fontFamily: SANS,
      }}>
        {testing ? '…' : 'Test'}
      </button>
    </div>
  )
}

const LDAP_PAGE_SIZE = 50

function DirectoryTab({ apps }: { apps: Application[] }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterActivated, setFilterActivated] = useState<'all' | 'activated' | 'not_activated'>('all')
  const [filterServer, setFilterServer] = useState<string>('all')
  const [filterOu, setFilterOu] = useState<string>('all')
  const [page, setPage] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(0) }, [filterActivated, filterServer, filterOu])

  const { data: ldapServers = [] } = useQuery({
    queryKey: ['ldap-configs'],
    queryFn: () => settingsApi.ldap.list(),
  })
  const activeServers = ldapServers.filter(s => s.active)

  const { data: allUsers = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['ldap-users', debouncedSearch],
    queryFn: () => usersApi.listLdap(debouncedSearch || undefined),
    retry: false,
  })

  const notConfigured = (error as any)?.response?.status === 503

  // Derive unique OUs from loaded users
  const uniqueOus = useMemo(() => {
    const ous = new Set<string>()
    allUsers.forEach(u => { if (u.ou) ous.add(u.ou) })
    return Array.from(ous).sort()
  }, [allUsers])

  // Derive unique servers from loaded users
  const uniqueServers = useMemo(() => {
    const srv = new Set<string>()
    allUsers.forEach(u => { if (u.ldap_server_name) srv.add(u.ldap_server_name) })
    return Array.from(srv).sort()
  }, [allUsers])

  const filtered = allUsers.filter(u => {
    if (filterActivated === 'activated' && !u.is_activated) return false
    if (filterActivated === 'not_activated' && u.is_activated) return false
    if (filterServer !== 'all' && u.ldap_server_name !== filterServer) return false
    if (filterOu !== 'all' && u.ou !== filterOu) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / LDAP_PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const paginated = filtered.slice(safePage * LDAP_PAGE_SIZE, (safePage + 1) * LDAP_PAGE_SIZE)

  const total = allUsers.length
  const activatedCount = allUsers.filter(u => u.is_activated).length

  return (
    <div style={{ fontFamily: SANS }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: total, color: C.text },
          { label: 'Activated', value: activatedCount, color: C.green },
          { label: 'Pending', value: total - activatedCount, color: C.amber },
        ].map(st => (
          <div key={st.label} style={{
            padding: '14px 16px', borderRadius: 10,
            border: `1px solid ${C.border}`, background: C.surface,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: st.color, fontVariantNumeric: 'tabular-nums' }}>{st.value}</div>
            <div style={{ fontSize: '0.7rem', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{st.label}</div>
          </div>
        ))}
      </div>

      {/* Server status row (show when no users found or when >1 active server) */}
      {(activeServers.length > 0 && (total === 0 || activeServers.length > 1)) && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 10,
          border: `1px solid ${C.borderFaint}`, background: C.surface2,
          display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.7rem', color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
            LDAP Servers
          </span>
          {activeServers.map(srv => (
            <ServerStatusBadge key={srv.id} serverId={srv.id} serverName={srv.name} />
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke={C.textMuted} strokeWidth="1.6"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="9" cy="9" r="5" /><line x1="13" y1="13" x2="17" y2="17" strokeLinecap="round" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, username, email..."
            style={{ ...inputStyle, paddingLeft: 32, width: '100%' }}
          />
        </div>

        {/* Status filter */}
        <select value={filterActivated} onChange={e => setFilterActivated(e.target.value as typeof filterActivated)}
          style={{ ...inputStyle, width: 'auto', minWidth: 130, appearance: 'none', paddingRight: 28, cursor: 'pointer' }}>
          <option value="all" style={{ background: C.surface }}>All users</option>
          <option value="activated" style={{ background: C.surface }}>✓ Activated</option>
          <option value="not_activated" style={{ background: C.surface }}>○ Not activated</option>
        </select>

        {/* Server filter — only if multiple servers have users */}
        {uniqueServers.length > 1 && (
          <select value={filterServer} onChange={e => setFilterServer(e.target.value)}
            style={{ ...inputStyle, width: 'auto', minWidth: 130, appearance: 'none', paddingRight: 28, cursor: 'pointer' }}>
            <option value="all" style={{ background: C.surface }}>All servers</option>
            {uniqueServers.map(s => (
              <option key={s} value={s} style={{ background: C.surface }}>{s}</option>
            ))}
          </select>
        )}

        {/* OU filter */}
        {uniqueOus.length > 0 && (
          <select value={filterOu} onChange={e => setFilterOu(e.target.value)}
            style={{ ...inputStyle, width: 'auto', minWidth: 130, appearance: 'none', paddingRight: 28, cursor: 'pointer' }}>
            <option value="all" style={{ background: C.surface }}>All departments</option>
            {uniqueOus.map(ou => (
              <option key={ou} value={ou} style={{ background: C.surface }}>{ou}</option>
            ))}
          </select>
        )}

        {/* Refresh button */}
        <button onClick={() => { qc.invalidateQueries({ queryKey: ['ldap-users'] }); refetch() }}
          disabled={isFetching}
          style={{
            padding: '0 14px', height: 34, borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${C.border}`, background: 'none',
            color: isFetching ? C.textMuted : C.textDim, fontSize: '0.76rem', fontFamily: SANS,
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            transition: 'color 0.15s',
          }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
            style={{ transform: isFetching ? 'rotate(360deg)' : 'none', transition: isFetching ? 'transform 0.6s linear' : 'none' }}>
            <path d="M16.5 4.5A8 8 0 1 0 18 10" strokeLinecap="round" />
            <path d="M13 2l4 2.5-2.5 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {isFetching ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {/* Active filter chips */}
      {(filterActivated !== 'all' || filterServer !== 'all' || filterOu !== 'all') && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {filterActivated !== 'all' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
              borderRadius: 20, fontSize: '0.72rem', fontFamily: SANS,
              background: C.accentSoft, color: C.green, border: '1px solid rgba(94,234,212,0.2)',
            }}>
              {filterActivated === 'activated' ? 'Activated' : 'Not activated'}
              <span onClick={() => setFilterActivated('all')} style={{ cursor: 'pointer', opacity: 0.7 }}>×</span>
            </span>
          )}
          {filterServer !== 'all' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
              borderRadius: 20, fontSize: '0.72rem', fontFamily: SANS,
              background: 'rgba(139,92,246,0.08)', color: C.purple, border: '1px solid rgba(139,92,246,0.2)',
            }}>
              {filterServer}
              <span onClick={() => setFilterServer('all')} style={{ cursor: 'pointer', opacity: 0.7 }}>×</span>
            </span>
          )}
          {filterOu !== 'all' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
              borderRadius: 20, fontSize: '0.72rem', fontFamily: SANS,
              background: 'rgba(59,130,246,0.08)', color: C.info, border: '1px solid rgba(59,130,246,0.2)',
            }}>
              {filterOu}
              <span onClick={() => setFilterOu('all')} style={{ cursor: 'pointer', opacity: 0.7 }}>×</span>
            </span>
          )}
          <button onClick={() => { setFilterActivated('all'); setFilterServer('all'); setFilterOu('all') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: '0.72rem', fontFamily: SANS }}>
            Clear all
          </button>
        </div>
      )}

      {/* Content */}
      {notConfigured ? (
        <div style={{
          borderRadius: 10, padding: '40px 20px', textAlign: 'center',
          border: `1px solid ${C.border}`, background: C.surface,
        }}>
          <div style={{ fontSize: '0.85rem', marginBottom: 8, color: C.amber, fontWeight: 600 }}>No LDAP server configured</div>
          <div style={{ fontSize: '0.75rem', color: C.textMuted }}>
            Go to <span style={{ color: C.green }}>Settings → LDAP Server</span> to add and activate an LDAP connection.
          </div>
        </div>
      ) : (
        <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: '0.78rem', color: C.textMuted }}>
              Loading directory…
            </div>
          ) : filtered.length === 0 && allUsers.length === 0 ? (
            /* Empty — likely a connection issue */
            <div style={{ padding: '32px 24px' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: '0.85rem', color: C.amber, fontWeight: 600, marginBottom: 6 }}>
                  No users returned from LDAP
                </div>
                <div style={{ fontSize: '0.75rem', color: C.textMuted, maxWidth: 400, margin: '0 auto' }}>
                  The LDAP servers are configured but returned 0 users. This usually means a connection issue,
                  wrong credentials, or incorrect base DN. Use the Test button below to diagnose each server.
                </div>
              </div>
              {activeServers.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 500, margin: '0 auto' }}>
                  {activeServers.map(srv => (
                    <ServerStatusBadge key={srv.id} serverId={srv.id} serverName={srv.name} />
                  ))}
                </div>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: '0.78rem', color: C.textMuted }}>
              No users match the current filters.{' '}
              <button onClick={() => { setFilterActivated('all'); setFilterServer('all'); setFilterOu('all'); setSearch('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, fontSize: '0.78rem', fontFamily: SANS }}>
                Clear filters
              </button>
            </div>
          ) : (() => {
            const groups = new Map<string, typeof paginated>()
            for (const u of paginated) {
              const key = u.ldap_server_name ?? 'Unknown Server'
              const grp = groups.get(key) ?? []
              grp.push(u)
              groups.set(key, grp)
            }
            return (
              <>
                {Array.from(groups.entries()).map(([serverName, users]) => (
                  <div key={serverName}>
                    <div style={{
                      padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8,
                      background: C.accentSoft, borderBottom: `1px solid ${C.borderFaint}`,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={C.green} strokeWidth="1.5">
                        <circle cx="10" cy="10" r="7.5"/><ellipse cx="10" cy="10" rx="3.5" ry="7.5"/>
                        <line x1="2.5" y1="10" x2="17.5" y2="10"/>
                      </svg>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {serverName}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: C.textMuted, fontWeight: 400 }}>
                        {users.length} user{users.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {users.map(user => <LdapUserRow key={user.ldap_username} user={user} apps={apps} />)}
                  </div>
                ))}
                {totalPages > 1 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', borderTop: `1px solid ${C.borderFaint}`,
                    background: C.surface2,
                  }}>
                    <span style={{ fontSize: '0.72rem', color: C.textMuted }}>
                      {safePage * LDAP_PAGE_SIZE + 1}–{Math.min((safePage + 1) * LDAP_PAGE_SIZE, filtered.length)} of {filtered.length}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                        style={{
                          padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
                          background: 'none', color: safePage === 0 ? C.textMuted : C.textDim,
                          fontSize: '0.72rem', fontFamily: SANS, cursor: safePage === 0 ? 'default' : 'pointer',
                        }}>
                        ← Prev
                      </button>
                      <span style={{ padding: '4px 8px', fontSize: '0.72rem', color: C.textDim }}>
                        {safePage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={safePage >= totalPages - 1}
                        style={{
                          padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
                          background: 'none', color: safePage >= totalPages - 1 ? C.textMuted : C.textDim,
                          fontSize: '0.72rem', fontFamily: SANS, cursor: safePage >= totalPages - 1 ? 'default' : 'pointer',
                        }}>
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function ActivatedTab() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [confirmUser, setConfirmUser] = useState<User | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['users', debouncedSearch],
    queryFn: () => usersApi.list({ search: debouncedSearch || undefined }),
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
                      background: user.active ? 'rgba(94,234,212,0.1)' : 'rgba(248,113,113,0.1)',
                      border: `1px solid ${user.active ? 'var(--accent-medium)' : 'rgba(248,113,113,0.25)'}`,
                    }}>
                      {user.active ? 'active' : 'blocked'}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs flex-wrap" style={{ color: C.textMuted }}>
                    <span>{user.ldapUsername}</span>
                    {user.email && <span>{user.email}</span>}
                    {user.ldapServerName && (
                      <span style={{ color: 'var(--accent)' }}>{user.ldapServerName}</span>
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
