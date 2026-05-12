import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../api/client'

const LEVEL_COLORS: Record<string, string> = {
  ERROR: '#ff4444',
  WARN: '#ffaa00',
  INFO: '#00ffff',
  DEBUG: '#006b8a',
}

type AppLogEntry = { timestamp: string; level: string; logger: string; message: string }
type AuditEntry = {
  id: string; actor_type: string; actor_id: string; action: string;
  target_type: string; target_id: string; application_id: string;
  ip_address: string; created_at: string; details: Record<string, unknown>
}

const LEVEL_BG: Record<string, string> = {
  ERROR: 'rgba(255,68,68,0.07)',
  WARN: 'rgba(255,170,0,0.06)',
}

function AppLogsTab() {
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['app-logs', debouncedSearch, level],
    queryFn: () => apiClient.get<AppLogEntry[]>(`/logs/app?limit=500${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}${level ? `&level=${level}` : ''}`).then(r => r.data),
    refetchInterval: autoRefresh ? 1000 : false,
  })

  const logs = data ?? []

  // scroll to bottom on first live enable
  useEffect(() => {
    if (autoRefresh) bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
  }, [autoRefresh])

  // scroll to bottom when new entries arrive while live
  useEffect(() => {
    if (!autoRefresh) { prevCountRef.current = logs.length; return }
    const el = containerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (logs.length > prevCountRef.current || nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevCountRef.current = logs.length
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt, autoRefresh])

  const [tick, setTick] = useState(true)
  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(() => setTick(v => !v), 800)
    return () => clearInterval(t)
  }, [autoRefresh])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
      {/* toolbar */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 0.75rem', background: '#020d10', border: '1px solid rgba(0,255,255,0.18)' }}>
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="#006b8a" strokeWidth="1.8" style={{ flexShrink: 0 }}>
            <circle cx="9" cy="9" r="5"/><line x1="13" y1="13" x2="17" y2="17" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="search message, logger..."
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#00ffff', fontFamily: 'inherit', fontSize: '0.78rem', outline: 'none' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#006b8a', cursor: 'pointer', fontSize: '0.85rem', padding: 0, lineHeight: 1 }}>×</button>
          )}
        </div>

        <select
          value={level}
          onChange={e => setLevel(e.target.value)}
          style={{ padding: '0.45rem 0.65rem', background: '#020d10', border: '1px solid rgba(0,255,255,0.18)', color: level ? (LEVEL_COLORS[level] ?? '#00ffff') : '#009bb5', fontFamily: 'inherit', fontSize: '0.75rem', outline: 'none', cursor: 'pointer' }}
        >
          <option value="">all levels</option>
          <option value="ERROR">ERROR</option>
          <option value="WARN">WARN</option>
          <option value="INFO">INFO</option>
          <option value="DEBUG">DEBUG</option>
        </select>

        {!autoRefresh && (
          <button
            onClick={() => refetch()}
            style={{ padding: '0.45rem 0.9rem', background: 'transparent', border: '1px solid rgba(0,255,255,0.2)', color: '#009bb5', fontFamily: 'inherit', fontSize: '0.72rem', cursor: 'pointer', letterSpacing: '0.06em' }}
          >
            ↻ refresh
          </button>
        )}

        <button
          onClick={() => setAutoRefresh(v => !v)}
          style={{
            padding: '0.45rem 0.9rem',
            background: autoRefresh ? 'rgba(0,255,255,0.1)' : 'transparent',
            border: `1px solid ${autoRefresh ? 'rgba(0,255,255,0.5)' : 'rgba(0,255,255,0.2)'}`,
            color: autoRefresh ? '#00ffff' : '#006b8a',
            fontFamily: 'inherit', fontSize: '0.72rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            letterSpacing: '0.06em', fontWeight: autoRefresh ? 700 : 400,
            transition: 'all 0.15s',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: autoRefresh ? '#00ffff' : '#006b8a',
            boxShadow: autoRefresh ? '0 0 8px #00ffff' : 'none',
            opacity: autoRefresh ? (tick ? 1 : 0.3) : 1,
            transition: 'opacity 0.2s',
          }} />
          {autoRefresh ? 'live' : 'live'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 0.75rem', background: '#020d10', border: '1px solid rgba(0,255,255,0.08)', fontSize: '0.7rem', color: '#006b8a' }}>
          <span style={{ color: '#009bb5', fontWeight: 700 }}>{logs.length}</span> entries
        </div>
      </div>

      {/* log level filter chips */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap' }}>
        {Object.entries(LEVEL_COLORS).map(([lvl, color]) => {
          const count = logs.filter(l => l.level === lvl).length
          if (count === 0) return null
          return (
            <button
              key={lvl}
              onClick={() => setLevel(l => l === lvl ? '' : lvl)}
              style={{
                padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700,
                background: level === lvl ? `rgba(${lvl === 'ERROR' ? '255,68,68' : lvl === 'WARN' ? '255,170,0' : '0,255,255'},0.12)` : 'transparent',
                border: `1px solid ${level === lvl ? color : 'rgba(0,255,255,0.1)'}`,
                color: level === lvl ? color : '#006b8a',
                fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '0.06em',
              }}
            >
              {lvl} <span style={{ opacity: 0.7 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* log stream */}
      <div
        ref={containerRef}
        style={{
          flex: 1, overflowY: 'auto',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontSize: '0.76rem',
          background: '#020d10',
          border: `1px solid ${autoRefresh ? 'rgba(0,255,255,0.2)' : 'rgba(0,255,255,0.1)'}`,
          transition: 'border-color 0.3s',
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#006b8a', padding: '3rem', textAlign: 'center', fontSize: '0.8rem' }}>
            {autoRefresh ? 'waiting for log entries...' : 'no log entries'}
          </div>
        ) : (
          logs.map((entry, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '155px 50px 160px 1fr',
                gap: '0 0.6rem',
                padding: '0.18rem 0.75rem',
                borderBottom: '1px solid rgba(0,255,255,0.03)',
                lineHeight: 1.55,
                background: LEVEL_BG[entry.level] ?? 'transparent',
              }}
            >
              <span style={{ color: '#005a73', fontSize: '0.7rem', letterSpacing: '-0.02em' }}>{entry.timestamp}</span>
              <span style={{ color: LEVEL_COLORS[entry.level] ?? '#009bb5', fontWeight: 700, fontSize: '0.68rem' }}>{entry.level}</span>
              <span style={{ color: '#007a97', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.7rem' }} title={entry.logger}>
                {entry.logger.includes('.') ? entry.logger.split('.').pop() : entry.logger}
              </span>
              <span style={{ color: entry.level === 'ERROR' ? '#ff7777' : entry.level === 'WARN' ? '#ffcc55' : '#00c4d8', wordBreak: 'break-all' }}>{entry.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function AuditLogsTab() {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [actorType, setActorType] = useState('')
  const [days, setDays] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const params = new URLSearchParams({ page: String(page), size: '50' })
  if (debouncedSearch) params.set('search', debouncedSearch)
  if (action) params.set('action', action)
  if (actorType) params.set('actorType', actorType)
  if (days) params.set('days', days)

  const { data } = useQuery({
    queryKey: ['audit-logs', debouncedSearch, action, actorType, days, page],
    queryFn: () => apiClient.get<{ content: AuditEntry[]; totalElements: number; totalPages: number }>(`/logs/audit?${params}`).then(r => r.data),
  })

  const { data: actions } = useQuery({
    queryKey: ['audit-actions'],
    queryFn: () => apiClient.get<string[]>('/logs/audit/actions').then(r => r.data),
    staleTime: 60000,
  })

  const entries = data?.content ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="search actor, action, target..."
          style={{ flex: 1, minWidth: 200, padding: '0.5rem 0.75rem', background: '#020d10', border: '1px solid rgba(0,255,255,0.2)', color: '#00ffff', fontFamily: 'inherit', fontSize: '0.8rem', outline: 'none' }}
        />
        <select
          value={action}
          onChange={e => { setAction(e.target.value); setPage(0) }}
          style={{ padding: '0.5rem 0.75rem', background: '#020d10', border: '1px solid rgba(0,255,255,0.2)', color: '#00ffff', fontFamily: 'inherit', fontSize: '0.8rem', outline: 'none' }}
        >
          <option value="">all actions</option>
          {(actions ?? []).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={actorType}
          onChange={e => { setActorType(e.target.value); setPage(0) }}
          style={{ padding: '0.5rem 0.75rem', background: '#020d10', border: '1px solid rgba(0,255,255,0.2)', color: '#00ffff', fontFamily: 'inherit', fontSize: '0.8rem', outline: 'none' }}
        >
          <option value="">all actors</option>
          <option value="user">user</option>
          <option value="admin">admin</option>
          <option value="system">system</option>
        </select>
        <select
          value={days}
          onChange={e => { setDays(e.target.value); setPage(0) }}
          style={{ padding: '0.5rem 0.75rem', background: '#020d10', border: '1px solid rgba(0,255,255,0.2)', color: '#00ffff', fontFamily: 'inherit', fontSize: '0.8rem', outline: 'none' }}
        >
          <option value="">all time</option>
          <option value="1">last 24h</option>
          <option value="7">last 7 days</option>
          <option value="30">last 30 days</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,255,255,0.2)' }}>
              {['time', 'actor', 'action', 'target', 'ip', ''].map(h => (
                <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#006b8a', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <>
                <tr
                  key={e.id}
                  onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  style={{ borderBottom: '1px solid rgba(0,255,255,0.06)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(0,255,255,0.04)')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '0.4rem 0.75rem', color: '#006b8a', whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString()}</td>
                  <td style={{ padding: '0.4rem 0.75rem', color: '#009bb5' }}>
                    <span style={{ fontSize: '0.65rem', color: '#006b8a', marginRight: '0.3rem' }}>[{e.actor_type}]</span>
                    {e.actor_id}
                  </td>
                  <td style={{ padding: '0.4rem 0.75rem', color: '#00ffff', fontWeight: 600 }}>{e.action}</td>
                  <td style={{ padding: '0.4rem 0.75rem', color: '#009bb5' }}>{e.target_type ? `${e.target_type}:${e.target_id ?? ''}` : '—'}</td>
                  <td style={{ padding: '0.4rem 0.75rem', color: '#006b8a', fontFamily: 'monospace', fontSize: '0.75rem' }}>{e.ip_address ?? '—'}</td>
                  <td style={{ padding: '0.4rem 0.75rem', color: '#006b8a' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: expanded === e.id ? 'rotate(180deg)' : '', transition: 'transform 0.15s' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </td>
                </tr>
                {expanded === e.id && (
                  <tr key={`${e.id}-detail`}>
                    <td colSpan={6} style={{ background: '#020d10', padding: '0.75rem 1.5rem' }}>
                      <pre style={{ margin: 0, fontSize: '0.75rem', color: '#009bb5', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#006b8a' }}>no audit events</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid rgba(0,255,255,0.2)', color: page === 0 ? '#006b8a' : '#00ffff', fontFamily: 'inherit', fontSize: '0.75rem', cursor: page === 0 ? 'default' : 'pointer' }}>prev</button>
          <span style={{ fontSize: '0.75rem', color: '#006b8a' }}>page {page + 1} / {data.totalPages}</span>
          <button disabled={page >= data.totalPages - 1} onClick={() => setPage(p => p + 1)} style={{ padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid rgba(0,255,255,0.2)', color: page >= data.totalPages - 1 ? '#006b8a' : '#00ffff', fontFamily: 'inherit', fontSize: '0.75rem', cursor: page >= data.totalPages - 1 ? 'default' : 'pointer' }}>next</button>
        </div>
      )}
    </div>
  )
}

export default function LogsPage() {
  const [tab, setTab] = useState<'app' | 'audit'>('app')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'calc(100vh - 4rem)' }}>
      <div>
        <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#006b8a', marginBottom: '0.3rem' }}>system</div>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00ffff', letterSpacing: '0.08em' }}>LOGS</h1>
      </div>

      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(0,255,255,0.12)' }}>
        {(['app', 'audit'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '0.5rem 1.25rem', background: tab === t ? '#00ffff' : 'transparent',
              border: 'none', color: tab === t ? '#000' : '#006b8a',
              fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
              borderBottom: tab === t ? '2px solid #00ffff' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t === 'app' ? 'app logs' : 'audit trail'}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'app' ? <AppLogsTab /> : <AuditLogsTab />}
      </div>
    </div>
  )
}
