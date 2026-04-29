import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { AuditLog, PageResponse } from '../types'

const C = '#00ffff'
const CD = '#00d4e8'
const CM = '#009bb5'
const CB = '#006b8a'
const BORDER = 'rgba(0,255,255,0.2)'
const SURFACE = '#020d10'
const SURFACE2 = '#041520'

const ACTION_COLOR: Record<string, string> = {
  login:               C,
  logout:              CM,
  login_failed:        '#ff3333',
  user_activated:      '#00ccff',
  user_deactivated:    '#ff8800',
  app_registered:      CD,
  app_updated:         CD,
  app_deactivated:     '#ff8800',
  app_activated:       '#00ccff',
  app_deleted:         '#ff3333',
  token_refresh:       CM,
  token_issued:        CM,
  app_access_granted:  '#00ccff',
  app_access_revoked:  '#ff8800',
  admin_login:         '#cc99ff',
  admin_created:       '#aa77ff',
}

function colorForAction(action: string): string {
  return ACTION_COLOR[action] ?? CM
}

function buildDescription(log: AuditLog): string {
  const d = log.details as Record<string, string> | null
  const name = d?.display_name || d?.ldap_username || log.actor_id
  const app = d?.app_name || log.target_id || ''

  switch (log.action) {
    case 'login':
      return `${name} (${d?.ldap_username ?? ''}) authenticated successfully` + (app ? ` → ${app}` : '')
    case 'login_failed': {
      const reason = d?.reason === 'invalid_credentials'
        ? `wrong password (${d?.remaining_attempts ?? '?'} attempts left)`
        : d?.reason === 'no_app_access'
        ? `not authorized for ${app}`
        : (d?.reason ?? 'unknown reason')
      return `Login attempt failed for ${d?.ldap_username ?? log.actor_id}: ${reason}`
    }
    case 'logout':
      return `User session terminated` + (app ? ` from ${app}` : '')
    case 'token_refresh':
      return `Access token refreshed for ${name}` + (app ? ` via ${app}` : '')
    case 'token_issued':
      return `Access token issued to ${name}`
    case 'user_activated':
      return `User account created: ${d?.display_name ?? ''} (${d?.ldap_username ?? ''}) — ${d?.email ?? ''}` +
        (d?.user_id ? ` [${d.user_id.slice(0, 8)}...]` : '')
    case 'user_deactivated':
      return `User account blocked: ${d?.display_name ?? ''} (${d?.ldap_username ?? ''})` +
        (d?.user_id ? ` [${d.user_id.slice(0, 8)}...]` : '')
    case 'app_access_granted': {
      const grantedUser = d?.user_display_name
        ? `${d.user_display_name} (${d.user_ldap_username ?? d.user_id?.slice(0, 8) ?? ''})`
        : `user ${d?.user_id?.slice(0, 8) ?? ''}...`
      return `App access granted to ${grantedUser} for application "${d?.app_name ?? app}"`
    }
    case 'app_access_revoked': {
      const revokedUser = d?.user_display_name
        ? `${d.user_display_name} (${d.user_ldap_username ?? d.user_id?.slice(0, 8) ?? ''})`
        : `user ${d?.user_id?.slice(0, 8) ?? ''}...`
      return `App access revoked from ${revokedUser} for application "${d?.app_name ?? app}"`
    }
    case 'app_registered':
      return `New ${d?.type ?? 'confidential'} app registered: "${d?.app_name ?? ''}" · client_id: ${d?.client_id ?? ''} · slug: ${d?.slug ?? ''}`
    case 'app_updated':
      return `Application "${d?.app_name ?? ''}" (${d?.slug ?? d?.client_id ?? ''}) settings updated · type: ${d?.type ?? '?'}`
    case 'app_deactivated': {
      const affected = d?.affected_users ? ` · ${d.affected_users} users blocked` : ''
      return `Application "${d?.app_name ?? ''}" (${d?.client_id ?? ''}) deactivated${affected}`
    }
    case 'app_activated':
      return `Application "${d?.app_name ?? ''}" (${d?.client_id ?? ''}) re-activated`
    case 'app_deleted': {
      const wasActive = String(d?.was_active) === 'true' ? ' · was active' : ' · was inactive'
      const revoked = d?.revoked_user_access_count ? ` · ${d.revoked_user_access_count} access records deleted` : ''
      return `Application "${d?.app_name ?? ''}" permanently deleted (client_id: ${d?.client_id ?? ''})${wasActive}${revoked}`
    }
    case 'admin_login':
      return `Admin "${d?.admin_username ?? ''}" [${d?.admin_type ?? ''}] signed in to management console`
    case 'admin_created':
      return `New admin account created: "${d?.admin_username ?? ''}" with role ${d?.admin_type ?? ''}`
    default:
      return `${log.action} by ${log.actor_type}:${log.actor_id}` + (log.target_id ? ` on ${log.target_type}:${log.target_id}` : '')
  }
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const inputStyle = {
  padding: '.5rem .75rem', border: `1px solid ${BORDER}`,
  background: SURFACE2, color: C, fontFamily: 'inherit', fontSize: '.75rem',
  outline: 'none', caretColor: C, width: '100%',
}

function DetailModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const color = colorForAction(log.action)
  const description = buildDescription(log)

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xl max-h-[90vh] overflow-auto border" style={{ background: '#000', borderColor: `${color}55` }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid rgba(0,255,255,0.12)`, background: 'rgba(0,255,255,0.02)' }}>
          <div>
            <div className="text-xs tracking-widest uppercase mb-0.5" style={{ color: CB }}>[audit] event detail</div>
            <span className="text-sm font-bold px-2 py-0.5" style={{ color, border: `1px solid ${color}44`, background: `${color}0d` }}>
              {log.action}
            </span>
          </div>
          <button onClick={onClose} style={{ color: CM, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="p-3 text-xs leading-relaxed" style={{ background: 'rgba(0,255,255,0.04)', border: `1px solid ${BORDER}`, color: CD }}>
            <span style={{ color: CB }}>{'> '}</span>{description}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <Field label="event_id" value={log.id} mono />
            <Field label="timestamp" value={new Date(log.created_at).toLocaleString()} />
            <Field label="actor_type" value={log.actor_type} />
            <Field label="actor_id" value={log.actor_id} mono />
            {log.target_type && <Field label="target_type" value={log.target_type} />}
            {log.target_id && <Field label="target_id" value={log.target_id} mono />}
            {log.application_id && <Field label="application_id" value={log.application_id} mono />}
            {log.ip_address && <Field label="ip_address" value={log.ip_address} mono />}
          </div>

          {log.user_agent && (
            <div>
              <div className="text-xs tracking-widest uppercase mb-1" style={{ color: CB }}>user_agent</div>
              <div className="text-xs break-all" style={{ color: CM }}>{log.user_agent}</div>
            </div>
          )}

          {log.details && Object.keys(log.details).length > 0 && (
            <div>
              <div className="text-xs tracking-widest uppercase mb-2" style={{ color: CB }}>event_payload</div>
              <div className="space-y-1.5">
                {Object.entries(log.details).map(([k, v]) => (
                  <div key={k} className="flex gap-3 text-xs">
                    <span className="shrink-0 w-36 truncate" style={{ color: CB }}>{k}</span>
                    <span className="break-all" style={{ color: CD }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs tracking-widest uppercase mb-0.5" style={{ color: CB, fontSize: '0.6rem' }}>{label}</div>
      <div className={`text-xs break-all ${mono ? 'font-mono' : ''}`} style={{ color: CD }}>{value}</div>
    </div>
  )
}

export default function AuditPage() {
  const [page, setPage] = useState(0)
  const [action, setAction] = useState('')
  const [actorId, setActorId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [detail, setDetail] = useState<AuditLog | null>(null)

  const params = new URLSearchParams({ page: String(page), size: '25' })
  if (action) params.set('action', action)
  if (actorId) params.set('actorId', actorId)
  if (from) params.set('from', new Date(from).toISOString())
  if (to) params.set('to', new Date(to + 'T23:59:59').toISOString())

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, action, actorId, from, to],
    queryFn: () => apiClient.get<PageResponse<AuditLog>>(`/audit-logs?${params}`).then(r => r.data),
    placeholderData: prev => prev,
  })

  const { data: eventTypes = [] } = useQuery({
    queryKey: ['audit-event-types'],
    queryFn: () => apiClient.get<string[]>('/audit-logs/event-types').then(r => r.data),
    staleTime: 60_000,
  })

  function resetFilters() {
    setAction(''); setActorId(''); setFrom(''); setTo(''); setPage(0)
  }

  const hasFilters = action || actorId || from || to

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs tracking-widest uppercase mb-1" style={{ color: CB }}>event trail</div>
        <h1 className="text-xl font-bold tracking-wider" style={{ color: C }}>{'> '}audit logs</h1>
      </div>

      <div className="p-4 mb-5 border" style={{ borderColor: BORDER, background: SURFACE }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs tracking-widest uppercase mb-1" style={{ color: CB }}># event_type</label>
            <select style={{ ...inputStyle, appearance: 'none' }} value={action} onChange={e => { setAction(e.target.value); setPage(0) }}
              onFocus={e => e.target.style.borderColor = C}
              onBlur={e => e.target.style.borderColor = BORDER}>
              <option value="" style={{ background: '#000' }}>all events</option>
              {eventTypes.map(t => <option key={t} value={t} style={{ background: '#000' }}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase mb-1" style={{ color: CB }}># actor_id</label>
            <input style={inputStyle} value={actorId} onChange={e => { setActorId(e.target.value); setPage(0) }}
              placeholder="filter by actor..."
              onFocus={e => e.target.style.borderColor = C}
              onBlur={e => e.target.style.borderColor = BORDER}
            />
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase mb-1" style={{ color: CB }}># from</label>
            <input type="date" style={{ ...inputStyle, colorScheme: 'dark' }} value={from} onChange={e => { setFrom(e.target.value); setPage(0) }}
              onFocus={e => e.target.style.borderColor = C}
              onBlur={e => e.target.style.borderColor = BORDER}
            />
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase mb-1" style={{ color: CB }}># to</label>
            <input type="date" style={{ ...inputStyle, colorScheme: 'dark' }} value={to} onChange={e => { setTo(e.target.value); setPage(0) }}
              onFocus={e => e.target.style.borderColor = C}
              onBlur={e => e.target.style.borderColor = BORDER}
            />
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs" style={{ color: CM }}>filters active</span>
            <button onClick={resetFilters} className="text-xs" style={{ color: CD, background: 'none', border: 'none', cursor: 'pointer' }}>
              clear all →
            </button>
          </div>
        )}
      </div>

      <div className="border overflow-hidden" style={{ borderColor: BORDER, background: SURFACE }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: SURFACE2, borderBottom: `1px solid ${BORDER}` }}>
                {['time', 'event', 'description', 'ip', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs tracking-widest uppercase" style={{ color: CB }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-xs" style={{ color: CM }}>loading...</td></tr>
              ) : data?.content.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-xs" style={{ color: CB }}>no events match filters.</td></tr>
              ) : data?.content.map(log => {
                const color = colorForAction(log.action)
                const desc = buildDescription(log)
                return (
                  <tr key={log.id} style={{ borderBottom: `1px solid rgba(0,255,255,0.06)`, cursor: 'pointer' }}
                    onClick={() => setDetail(log)}>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: CB }}>
                      <div style={{ color: CM }}>{new Date(log.created_at).toLocaleDateString()}</div>
                      <div>{new Date(log.created_at).toLocaleTimeString()}</div>
                      <div className="text-xs mt-0.5" style={{ color: CB, fontSize: '0.6rem' }}>{timeAgo(log.created_at)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-bold px-1.5 py-0.5" style={{ color, border: `1px solid ${color}44`, background: `${color}0d` }}>
                        {log.action}
                      </span>
                      <div className="text-xs mt-1" style={{ color: CB, fontSize: '0.65rem' }}>
                        {log.actor_type}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-xs" style={{ color: CM }}>
                      <div className="truncate" title={desc}>{desc}</div>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: CB }}>
                      {log.ip_address ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={e => { e.stopPropagation(); setDetail(log) }} className="text-xs whitespace-nowrap"
                        style={{ color: CD, background: 'none', border: 'none', cursor: 'pointer' }}>
                        details →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
            <span className="text-xs" style={{ color: CB }}>
              {data.total_elements} total · page {data.page + 1} of {data.total_pages}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1 text-xs transition-all disabled:opacity-30"
                style={{ color: CD, border: `1px solid ${BORDER}`, background: 'none', cursor: 'pointer' }}>
                ← prev
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={data.last}
                className="px-3 py-1 text-xs transition-all disabled:opacity-30"
                style={{ color: CD, border: `1px solid ${BORDER}`, background: 'none', cursor: 'pointer' }}>
                next →
              </button>
            </div>
          </div>
        )}
      </div>

      {detail && <DetailModal log={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
