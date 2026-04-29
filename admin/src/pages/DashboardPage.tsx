import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import type { SystemStats, PageResponse, AuditLog } from '../types'

const C = '#00ffff'
const CD = '#00d4e8'
const CM = '#009bb5'
const CB = '#006b8a'
const BORDER = 'rgba(0,255,255,0.2)'
const SURFACE = '#020d10'

const ACTION_STYLE: Record<string, { color: string; bg: string }> = {
  login:            { color: C, bg: 'rgba(0,255,255,0.08)' },
  login_failed:     { color: '#ff3333', bg: 'rgba(255,51,51,0.08)' },
  user_activated:   { color: CD, bg: 'rgba(0,179,204,0.08)' },
  user_deactivated: { color: '#ff8800', bg: 'rgba(255,136,0,0.08)' },
  app_registered:   { color: '#00ccff', bg: 'rgba(0,204,255,0.08)' },
  app_updated:      { color: '#00aacc', bg: 'rgba(0,170,204,0.08)' },
  app_deleted:      { color: '#ff3333', bg: 'rgba(255,51,51,0.08)' },
  token_refresh:    { color: CM, bg: 'rgba(0,122,153,0.08)' },
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="p-5 border" style={{ borderColor: BORDER, background: SURFACE }}>
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs tracking-widest uppercase" style={{ color: CB }}>{label}</div>
        {sub && <span className="text-xs tracking-wider" style={{ color: CB }}>[{sub}]</span>}
      </div>
      <div className="text-3xl font-bold tabular-nums" style={{ color: C }}>{value}</div>
    </div>
  )
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-32 truncate" style={{ color: CM }}>{label}</span>
      <div className="flex-1 h-1" style={{ background: 'rgba(0,255,255,0.08)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, boxShadow: `0 0 4px ${color}` }} />
      </div>
      <span className="text-xs w-8 text-right tabular-nums" style={{ color: CD }}>{value}</span>
    </div>
  )
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiClient.get<SystemStats>('/stats').then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: recentAudit } = useQuery({
    queryKey: ['audit-recent'],
    queryFn: () => apiClient.get<PageResponse<AuditLog>>('/audit-logs?size=10').then(r => r.data),
    refetchInterval: 30_000,
  })

  const s = stats

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs tracking-widest uppercase mb-1" style={{ color: CB }}>system status</div>
        <h1 className="text-xl font-bold tracking-wider" style={{ color: C }}>{'> '}dashboard</h1>
      </div>

      {statsLoading ? (
        <div className="text-sm" style={{ color: CM }}>{'> '}loading metrics...</div>
      ) : s ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <StatCard label="Users" value={s.total_users} />
            <StatCard label="Applications" value={s.total_apps} />
            <StatCard label="Sessions" value={s.active_sessions} sub="live" />
            <StatCard label="Events" value={s.events_today} sub="today" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <div className="p-5 border" style={{ borderColor: BORDER, background: SURFACE }}>
              <div className="text-xs tracking-widest uppercase mb-4" style={{ color: CB }}>login activity</div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'logins today', value: s.logins_today, color: C },
                  { label: 'failed today', value: s.failed_today, color: '#ff3333' },
                  { label: 'this week', value: s.logins_week, color: CD },
                  { label: 'failed week', value: s.failed_week, color: '#ff6600' },
                ].map(item => (
                  <div key={item.label} className="p-3" style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.1)' }}>
                    <div className="text-2xl font-bold tabular-nums" style={{ color: item.color }}>{item.value}</div>
                    <div className="text-xs mt-0.5 tracking-wide" style={{ color: CB }}>{item.label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                {[
                  { label: 'active today', value: s.users_active_today },
                  { label: 'active this week', value: s.users_active_week },
                  { label: 'total logins', value: s.total_logins },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-xs">
                    <span style={{ color: CM }}>{item.label}</span>
                    <span style={{ color: CD }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 border" style={{ borderColor: BORDER, background: SURFACE }}>
              <div className="text-xs tracking-widest uppercase mb-4" style={{ color: CB }}>events this week</div>
              {s.event_breakdown.length === 0 ? (
                <p className="text-xs" style={{ color: CM }}>no events this week.</p>
              ) : (
                <div className="space-y-2.5">
                  {s.event_breakdown.slice(0, 8).map(e => (
                    <MiniBar
                      key={e.action}
                      label={e.action}
                      value={e.count}
                      max={s.event_breakdown[0]?.count ?? 1}
                      color={e.action.includes('fail') || e.action.includes('delete') ? '#ff3333' :
                             e.action.includes('login') ? C :
                             e.action.includes('user') ? '#00ccff' : CM}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      <div className="border" style={{ borderColor: BORDER, background: SURFACE }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="text-xs tracking-widest uppercase" style={{ color: CB }}>recent activity</div>
          <Link to="/audit" className="text-xs tracking-wide transition-opacity hover:opacity-100" style={{ color: CD }}>view all →</Link>
        </div>
        {!recentAudit ? (
          <div className="p-5 text-xs" style={{ color: CM }}>loading...</div>
        ) : recentAudit.content.length === 0 ? (
          <div className="p-5 text-xs" style={{ color: CM }}>no audit events yet.</div>
        ) : (
          <div>
            {recentAudit.content.map(log => {
              const style = ACTION_STYLE[log.action] ?? { color: CM, bg: 'transparent' }
              return (
                <div key={log.id} className="flex items-center gap-4 px-5 py-2.5" style={{ borderBottom: `1px solid rgba(0,255,255,0.06)` }}>
                  <span className="text-xs px-2 py-0.5 whitespace-nowrap font-bold" style={{ color: style.color, background: style.bg, border: `1px solid ${style.color}33` }}>
                    {log.action}
                  </span>
                  <span className="text-xs truncate" style={{ color: CM }}>{log.actor_id}</span>
                  {log.ip_address && (
                    <span className="text-xs hidden md:block" style={{ color: CB }}>{log.ip_address}</span>
                  )}
                  <span className="text-xs ml-auto shrink-0" style={{ color: CB }}>
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
