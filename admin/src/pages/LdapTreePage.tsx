import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import { usersApi } from '../api/users'
import { appsApi } from '../api/apps'
import { settingsApi, LdapServerConfig } from '../api/settings'
import type { Application } from '../types'

interface TreeNode {
  dn: string
  rdn: string
  type: 'ou' | 'user' | 'group' | 'other'
  name: string
  ldap_username?: string
  email?: string
  title?: string
  has_children: boolean
  is_activated: boolean
  groups?: string[]
  children?: TreeNode[]
}

const C = {
  bg: '#000',
  surface: '#020d10',
  surface2: '#041520',
  border: 'rgba(0,255,255,0.15)',
  borderHover: 'rgba(0,255,255,0.35)',
  green: '#00ffff',
  greenDim: '#00d4e8',
  greenMuted: 'rgba(0,255,255,0.1)',
  text: '#00ffff',
  textDim: '#009bb5',
  textMuted: '#006b8a',
  blue: '#00ccff',
  purple: '#aa88ff',
  amber: '#ff8800',
  red: '#ff3333',
}

function NodeIcon({ type, expanded }: { type: string; expanded?: boolean }) {
  if (type === 'ou') return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" style={{ color: C.blue, flexShrink: 0 }}>
      {expanded
        ? <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
        : <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd"/>
      }
    </svg>
  )
  if (type === 'group') return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" style={{ color: C.purple, flexShrink: 0 }}>
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
    </svg>
  )
  if (type === 'user') return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" style={{ color: C.green, flexShrink: 0 }}>
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
    </svg>
  )
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" style={{ color: C.textMuted, flexShrink: 0 }}>
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"
      style={{ color: C.textMuted, flexShrink: 0, transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
      <path fillRule="evenodd" d="M7.293 4.707a1 1 0 010 1.414L3.414 10l3.879 3.879a1 1 0 01-1.414 1.414l-4.586-4.586a1 1 0 010-1.414l4.586-4.586a1 1 0 011.414 0z" clipRule="evenodd" transform="rotate(180 10 10)"/>
    </svg>
  )
}

function ActivateModal({ node, apps, onClose }: { node: TreeNode; apps: Application[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [appId, setAppId] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => usersApi.activateForApp(appId, node.ldap_username!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ldap-tree'] })
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
      <div className="w-full max-w-md border rounded-lg" style={{ background: C.surface, borderColor: C.borderHover }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.border }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: C.text }}>Grant App Access</div>
            <div className="text-xs mt-0.5" style={{ color: C.textDim }}>{node.name}</div>
          </div>
          <button onClick={onClose} style={{ color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
        </div>
        <div className="px-5 py-5 space-y-4">
          {node.email && (
            <div className="p-3 rounded border text-xs" style={{ background: C.surface2, borderColor: C.border }}>
              <div style={{ color: C.textMuted }}>email</div>
              <div className="mt-0.5" style={{ color: C.textDim }}>{node.email}</div>
              {node.title && <>
                <div className="mt-2" style={{ color: C.textMuted }}>title</div>
                <div className="mt-0.5" style={{ color: C.textDim }}>{node.title}</div>
              </>}
            </div>
          )}
          {error && (
            <div className="px-3 py-2 text-xs rounded border" style={{ color: C.red, borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.06)' }}>
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: C.textDim }}>Application</label>
            <select value={appId} onChange={e => setAppId(e.target.value)}
              style={{ width: '100%', padding: '.5rem .75rem', border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface2, color: C.text, fontFamily: 'inherit', fontSize: '.8125rem', outline: 'none' }}>
              <option value="" style={{ background: C.surface }}>Select application...</option>
              {apps.map(a => <option key={a.id} value={a.id} style={{ background: C.surface }}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2 text-xs rounded"
              style={{ color: C.textDim, border: `1px solid ${C.border}`, background: 'none', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => mutation.mutate()} disabled={!appId || mutation.isPending} className="px-4 py-2 text-xs font-semibold rounded"
              style={{ color: '#000', background: (!appId || mutation.isPending) ? C.greenDim : C.green, border: 'none', cursor: 'pointer' }}>
              {mutation.isPending ? 'Granting...' : 'Grant Access'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UserDetail({ node, onActivate }: { node: TreeNode; onActivate: () => void }) {
  return (
    <div className="ml-7 mb-1 px-3 py-2.5 rounded border text-xs" style={{ background: C.surface, borderColor: C.border }}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          {node.ldap_username && (
            <div className="flex items-center gap-2">
              <span style={{ color: C.textMuted }}>uid</span>
              <span style={{ color: C.text }}>{node.ldap_username}</span>
            </div>
          )}
          {node.email && (
            <div className="flex items-center gap-2">
              <span style={{ color: C.textMuted }}>mail</span>
              <span style={{ color: C.textDim }}>{node.email}</span>
            </div>
          )}
          {node.title && (
            <div className="flex items-center gap-2">
              <span style={{ color: C.textMuted }}>title</span>
              <span style={{ color: C.textDim }}>{node.title}</span>
            </div>
          )}
          {node.groups && node.groups.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ color: C.textMuted }}>groups</span>
              {node.groups.map(g => (
                <span key={g} className="px-1.5 py-0.5 rounded text-xs"
                  style={{ background: 'rgba(167,139,250,0.1)', color: C.purple, border: '1px solid rgba(167,139,250,0.2)' }}>
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <button onClick={onActivate} className="px-2.5 py-1 rounded text-xs"
            style={{ color: C.green, border: `1px solid rgba(0,255,255,0.3)`, background: 'rgba(0,255,255,0.06)', cursor: 'pointer' }}>
            + Grant access
          </button>
        </div>
      </div>
    </div>
  )
}

function TreeNodeRow({ node, depth, apps, expandedDns, toggleNode, loadChildren, childMap, configId }: {
  node: TreeNode; depth: number; apps: Application[]; configId: string;
  expandedDns: Set<string>; toggleNode: (dn: string) => void;
  loadChildren: (dn: string) => void; childMap: Map<string, TreeNode[]>;
}) {
  const [showDetail, setShowDetail] = useState(false)
  const [showActivate, setShowActivate] = useState(false)
  const isExpanded = expandedDns.has(node.dn)
  const children = childMap.get(node.dn) ?? []

  const handleClick = () => {
    if (node.type === 'user') {
      setShowDetail(s => !s)
    } else if (node.has_children) {
      if (!isExpanded) loadChildren(node.dn)
      toggleNode(node.dn)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 py-1.5 px-2 rounded cursor-pointer transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        {node.has_children
          ? <ChevronIcon expanded={isExpanded} />
          : <span style={{ width: 12, flexShrink: 0 }} />
        }
        <NodeIcon type={node.type} expanded={isExpanded} />
        <span className="text-sm truncate" style={{ color: C.text }}>
          {node.name}
        </span>
        {node.type === 'ou' && <span className="text-xs ml-1 flex-shrink-0" style={{ color: C.textMuted }}>OU</span>}
        {node.type === 'group' && <span className="text-xs ml-1 flex-shrink-0" style={{ color: C.textMuted }}>group</span>}
      </div>
      {node.type === 'user' && showDetail && (
        <UserDetail node={node} onActivate={() => { setShowDetail(false); setShowActivate(true) }} />
      )}
      {showActivate && <ActivateModal node={node} apps={apps} onClose={() => setShowActivate(false)} />}
      {isExpanded && children.map(child => (
        <TreeNodeRow key={child.dn} node={child} depth={depth + 1} apps={apps} configId={configId}
          expandedDns={expandedDns} toggleNode={toggleNode} loadChildren={loadChildren} childMap={childMap} />
      ))}
    </div>
  )
}

function ConfigTree({ config, apps }: { config: LdapServerConfig; apps: Application[] }) {
  const [expanded, setExpanded] = useState(true)
  const [expandedDns, setExpandedDns] = useState<Set<string>>(new Set())
  const [childMap, setChildMap] = useState<Map<string, TreeNode[]>>(new Map())
  const [loadingDns, setLoadingDns] = useState<Set<string>>(new Set())

  const { data: roots = [], isLoading, error } = useQuery({
    queryKey: ['ldap-tree', config.id, 'root'],
    queryFn: () => apiClient.get<TreeNode[]>('/ldap/tree', { params: { configId: config.id } }).then(r => r.data),
    retry: false,
    enabled: expanded,
  })

  const notConfigured = (error as any)?.response?.status === 503

  function toggleNode(dn: string) {
    setExpandedDns(prev => {
      const next = new Set(prev)
      if (next.has(dn)) next.delete(dn)
      else next.add(dn)
      return next
    })
  }

  async function loadChildren(dn: string) {
    if (childMap.has(dn) || loadingDns.has(dn)) return
    setLoadingDns(prev => new Set(prev).add(dn))
    try {
      const res = await apiClient.get<TreeNode[]>('/ldap/tree', { params: { dn, configId: config.id } })
      setChildMap(prev => new Map(prev).set(dn, res.data))
    } finally {
      setLoadingDns(prev => { const n = new Set(prev); n.delete(dn); return n })
    }
  }

  return (
    <div style={{ marginBottom: '1.25rem', border: `1px solid ${config.active ? C.green : C.border}`, borderRadius: 4, overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: C.surface2, cursor: 'pointer', borderBottom: expanded ? `1px solid ${C.border}` : 'none' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,255,255,0.04)')}
        onMouseLeave={e => (e.currentTarget.style.background = C.surface2)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ChevronIcon expanded={expanded} />
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ color: C.blue, flexShrink: 0 }}>
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
          </svg>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: config.active ? C.green : C.text }}>{config.name}</span>
          {config.active && (
            <span style={{ fontSize: '0.5rem', padding: '0.1rem 0.4rem', border: `1px solid ${C.green}`, color: C.green, letterSpacing: '0.1em', textTransform: 'uppercase' }}>active</span>
          )}
        </div>
        <span style={{ fontSize: '0.65rem', color: C.textMuted }}>{config.url} · {config.baseDn}</span>
      </div>

      {expanded && (
        <div style={{ background: C.surface }}>
          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.75rem', color: C.textMuted }}>Loading directory...</div>
          ) : notConfigured ? (
            <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.75rem', color: C.amber }}>Connection error for this LDAP server</div>
          ) : roots.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.75rem', color: C.textMuted }}>No entries found</div>
          ) : (
            <div style={{ padding: '0.5rem' }}>
              {roots.map(node => (
                <TreeNodeRow key={node.dn} node={node} depth={0} apps={apps} configId={config.id}
                  expandedDns={expandedDns} toggleNode={toggleNode} loadChildren={loadChildren} childMap={childMap} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function LdapTreePage() {
  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ['ldap-configs'],
    queryFn: settingsApi.ldap.list,
  })

  const activeConfigs = configs.filter(c => c.active)

  const { data: apps = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => appsApi.list(),
  })

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs tracking-widest uppercase mb-1" style={{ color: C.textMuted }}>ldap</div>
        <h1 className="text-xl font-bold" style={{ color: C.green }}>Directory</h1>
        <p className="text-xs mt-1" style={{ color: C.textMuted }}>
          {activeConfigs.length > 1 ? `${activeConfigs.length} active LDAP servers — each shown as a separate tree.` : 'Click an OU to expand. Click a user to see details and grant access.'}
        </p>
      </div>

      {configsLoading ? (
        <div style={{ padding: '3rem', textAlign: 'center', fontSize: '0.75rem', color: C.textMuted }}>Loading...</div>
      ) : activeConfigs.length === 0 ? (
        <div className="rounded border p-10 text-center" style={{ background: C.surface, borderColor: C.border }}>
          <div className="text-sm mb-2" style={{ color: C.amber }}>No active LDAP server configured</div>
          <div className="text-xs" style={{ color: C.textMuted }}>
            Go to <span style={{ color: C.green }}>Settings → LDAP Server</span> to add and activate an LDAP connection.
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: activeConfigs.length > 1 ? 'repeat(2, 1fr)' : '1fr',
          gap: '1.25rem',
          alignItems: 'start',
        }}>
          {activeConfigs.map(config => (
            <ConfigTree key={config.id} config={config} apps={apps} />
          ))}
        </div>
      )}
    </div>
  )
}
