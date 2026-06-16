import { useState, useEffect, type KeyboardEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appsApi } from '../api/apps'
import { usersApi } from '../api/users'
import { ldapApi } from '../api/ldap'
import { settingsApi } from '../api/settings'
import type { Application } from '../types'

const C = 'var(--accent)'
const CD = 'var(--accent-strong)'
const CM = 'var(--text-dim)'
const CB = 'var(--text-muted)'
const BORDER = 'rgba(94,234,212,0.2)'
const BORDER_H = 'rgba(94,234,212,0.4)'
const SURFACE = 'var(--surface-1)'
const SURFACE2 = 'var(--surface-2)'

interface AppFormRule {
  ruleType: 'LDAP_GROUP' | 'LDAP_OU'
  value: string
  ldapServerId: string
}

interface AppForm {
  name: string
  slug: string
  redirectUris: string[]
  allowedOrigins: string[]
  postLogoutRedirectUris: string[]
  isPublicClient: boolean
  accessMode: 'ASSIGNED' | 'PUBLIC' | 'LDAP_GROUP' | 'LDAP_OU'
  accessRules: AppFormRule[]
}

const emptyForm: AppForm = {
  name: '', slug: '', redirectUris: [], allowedOrigins: [], postLogoutRedirectUris: [],
  isPublicClient: false, accessMode: 'ASSIGNED', accessRules: [],
}
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
            style={{ background: 'var(--accent-soft)', color: CD, border: `1px solid rgba(94,234,212,0.2)` }}>
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

function GroupRuleBuilder({ form, setForm }: {
  form: AppForm; setForm: React.Dispatch<React.SetStateAction<AppForm>>
}) {
  const [filter, setFilter] = useState('')
  const { data: ldapServers = [] } = useQuery({
    queryKey: ['ldap-servers-list'],
    queryFn: () => settingsApi.ldap.list(),
    staleTime: 60_000,
  })
  const [selectedServerId, setSelectedServerId] = useState('')

  const activeServerId = selectedServerId || (ldapServers.find(s => s.active)?.id ?? '')

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['ldap-groups', activeServerId],
    queryFn: () => ldapApi.getGroups(activeServerId || undefined),
    enabled: ldapServers.length > 0,
    staleTime: 60_000,
  })

  const addedValues = new Set(form.accessRules.map(r => r.value))
  const filtered = groups.filter(g => g.toLowerCase().includes(filter.toLowerCase()))

  function toggleGroup(group: string) {
    if (addedValues.has(group)) {
      setForm(f => ({ ...f, accessRules: f.accessRules.filter(r => r.value !== group) }))
    } else {
      setForm(f => ({
        ...f,
        accessRules: [...f.accessRules, { ruleType: 'LDAP_GROUP', value: group, ldapServerId: activeServerId }],
      }))
    }
  }

  const selectedServerName = ldapServers.find(s => s.id === activeServerId)?.name ?? 'primary'

  return (
    <div>
      <label className="block text-xs tracking-widest uppercase mb-1.5" style={{ color: CD }}># ldap groups</label>

      {/* Server picker (only when multiple servers) */}
      {ldapServers.length > 1 && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs shrink-0" style={{ color: CB }}>server:</span>
          <div className="flex gap-1.5 flex-wrap">
            {ldapServers.filter(s => s.active).map(s => (
              <button key={s.id} type="button"
                onClick={() => { setSelectedServerId(s.id); setFilter('') }}
                className="text-xs px-2 py-0.5"
                style={{
                  border: `1px solid ${activeServerId === s.id ? C : BORDER}`,
                  background: activeServerId === s.id ? 'var(--accent-soft)' : 'none',
                  color: activeServerId === s.id ? C : CM,
                  cursor: 'pointer',
                }}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected groups as tags */}
      {form.accessRules.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.accessRules.map((rule, i) => {
            const sName = ldapServers.find(s => s.id === rule.ldapServerId)?.name
            return (
              <div key={i} className="inline-flex items-center gap-1.5 px-2 py-1 text-xs"
                style={{ background: 'var(--accent-soft)', border: `1px solid ${C}`, color: C }}>
                <span>✓ {rule.value}</span>
                {sName && <span style={{ color: CB, fontSize: '0.65rem' }}>@{sName}</span>}
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, accessRules: f.accessRules.filter((_, j) => j !== i) }))}
                  style={{ color: CM, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0 }}>×</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Filter */}
      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder={
          isLoading ? `loading groups from ${selectedServerName}...`
          : groups.length ? `filter ${groups.length} groups from ${selectedServerName}...`
          : `no groups found on ${selectedServerName}`
        }
        style={{ ...inputStyle, marginBottom: '0.375rem' }}
        onFocus={e => { e.target.style.borderColor = C }}
        onBlur={e => { e.target.style.borderColor = BORDER }}
      />

      {/* Scrollable list */}
      <div style={{ border: `1px solid ${BORDER}`, maxHeight: '11rem', overflowY: 'auto', background: SURFACE2 }}>
        {isLoading ? (
          <div className="px-3 py-3 text-xs" style={{ color: CM }}>loading groups from LDAP...</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-3 text-xs" style={{ color: CB }}>
            {groups.length === 0
              ? 'no groups found — check LDAP connection in Settings'
              : 'no groups match filter'}
          </div>
        ) : (
          filtered.map(g => {
            const selected = addedValues.has(g)
            return (
              <button key={g} type="button" onClick={() => toggleGroup(g)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left"
                style={{
                  background: selected ? 'var(--accent-soft)' : 'none',
                  border: 'none',
                  borderBottom: `1px solid rgba(94,234,212,0.07)`,
                  color: selected ? C : CM,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'rgba(94,234,212,0.04)' }}
                onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'none' }}>
                <span style={{ color: selected ? C : BORDER, width: '0.875rem', flexShrink: 0, fontWeight: 700 }}>{selected ? '✓' : '+'}</span>
                <span className="flex-1 truncate">{g}</span>
              </button>
            )
          })
        )}
      </div>
      <p className="text-xs mt-1" style={{ color: CB }}>click to select · user must be in at least one selected group (live LDAP check at login)</p>
    </div>
  )
}

function OuRuleBuilder({ form, setForm }: {
  form: AppForm; setForm: React.Dispatch<React.SetStateAction<AppForm>>
}) {
  const [manualDn, setManualDn] = useState('')
  const { data: ldapServers = [] } = useQuery({
    queryKey: ['ldap-servers-list'],
    queryFn: () => settingsApi.ldap.list(),
    staleTime: 60_000,
  })
  const [selectedServerId, setSelectedServerId] = useState('')
  const activeServerId = selectedServerId || (ldapServers.find(s => s.active)?.id ?? '')

  // tree state: keyed by DN, 'ROOT' for top-level children
  const [nodeCache, setNodeCache] = useState<Record<string, import('../api/ldap').LdapTreeNode[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loadingDns, setLoadingDns] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState('')

  // reset + reload root whenever the active server changes or servers first load
  useEffect(() => {
    if (ldapServers.length === 0) return
    setNodeCache({})
    setExpanded(new Set())
    setLoadError('')
    setLoadingDns(new Set(['ROOT']))
    ldapApi.getChildren(undefined, activeServerId || undefined)
      .then(nodes => { setNodeCache({ ROOT: nodes }); setLoadError('') })
      .catch(() => { setNodeCache({ ROOT: [] }); setLoadError('Could not load LDAP tree — check LDAP connection in Settings') })
      .finally(() => setLoadingDns(prev => { const s = new Set(prev); s.delete('ROOT'); return s }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerId, ldapServers.length])

  function doLoad(dn: string) {
    if (loadingDns.has(dn)) return
    setLoadingDns(prev => new Set(prev).add(dn))
    ldapApi.getChildren(dn, activeServerId || undefined)
      .then(nodes => setNodeCache(prev => ({ ...prev, [dn]: nodes })))
      .catch(() => setNodeCache(prev => ({ ...prev, [dn]: [] })))
      .finally(() => setLoadingDns(prev => { const s = new Set(prev); s.delete(dn); return s }))
  }

  function toggleExpand(dn: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(dn)) {
        next.delete(dn)
      } else {
        next.add(dn)
        doLoad(dn)
      }
      return next
    })
  }

  const addedValues = new Set(form.accessRules.map(r => r.value))

  function toggleOu(dn: string) {
    if (addedValues.has(dn)) {
      setForm(f => ({ ...f, accessRules: f.accessRules.filter(r => r.value !== dn) }))
    } else {
      setForm(f => ({
        ...f,
        accessRules: [...f.accessRules, { ruleType: 'LDAP_OU', value: dn, ldapServerId: activeServerId }],
      }))
    }
  }

  function addManual() {
    const v = manualDn.trim()
    if (!v || addedValues.has(v)) return
    setForm(f => ({ ...f, accessRules: [...f.accessRules, { ruleType: 'LDAP_OU', value: v, ldapServerId: activeServerId }] }))
    setManualDn('')
  }

  function renderNodes(parentKey: string, depth: number): React.ReactNode {
    const nodes = (nodeCache[parentKey] || []).filter(n => n.type === 'ou' || n.type === 'other')
    if (loadingDns.has(parentKey) && nodes.length === 0) {
      return <div className="py-1.5 text-xs" style={{ paddingLeft: `${depth * 16 + 28}px`, color: CB }}>loading…</div>
    }
    if (nodes.length === 0) return null
    return nodes.map(n => {
      const isExp = expanded.has(n.dn)
      const isSel = addedValues.has(n.dn)
      const isChildLoading = loadingDns.has(n.dn)
      const icon = isSel ? '✓' : n.type === 'group' ? '👥' : '📁'
      return (
        <div key={n.dn}>
          <div className="flex items-stretch" style={{ paddingLeft: `${depth * 16}px` }}>
            <button type="button"
              onClick={() => n.has_children && toggleExpand(n.dn)}
              style={{
                width: '28px', flexShrink: 0, background: 'none', border: 'none',
                borderBottom: `1px solid rgba(94,234,212,0.07)`,
                cursor: n.has_children ? 'pointer' : 'default',
                color: n.has_children ? CM : 'transparent',
                fontSize: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {n.has_children ? (isChildLoading ? '…' : isExp ? '▾' : '▸') : ''}
            </button>
            <button type="button" onClick={() => toggleOu(n.dn)} title={n.dn}
              className="flex items-center gap-1.5 flex-1 text-xs text-left"
              style={{
                background: isSel ? 'var(--accent-soft)' : 'none', border: 'none',
                borderBottom: `1px solid rgba(94,234,212,0.07)`,
                color: isSel ? C : CM, cursor: 'pointer', fontFamily: 'inherit',
                padding: '0.3rem 0.5rem 0.3rem 0.25rem', minWidth: 0, overflow: 'hidden',
              }}
              onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(94,234,212,0.04)' }}
              onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = isSel ? 'var(--accent-soft)' : 'none' }}>
              <span style={{ flexShrink: 0 }}>{icon}</span>
              <span className="font-semibold" style={{ color: isSel ? C : CD, flexShrink: 0, whiteSpace: 'nowrap', marginRight: '0.25rem' }}>
                {n.name || n.rdn}
              </span>
              <span className="truncate" style={{ color: CB, fontSize: '0.68rem' }}>{n.dn}</span>
            </button>
          </div>
          {isExp && renderNodes(n.dn, depth + 1)}
        </div>
      )
    })
  }

  const rootLoading = loadingDns.has('ROOT')
  const rootNodes = nodeCache['ROOT']
  const selectedServerName = ldapServers.find(s => s.id === activeServerId)?.name ?? 'primary'

  return (
    <div>
      <label className="block text-xs tracking-widest uppercase mb-1.5" style={{ color: CD }}># ldap folder / ou tree</label>

      {ldapServers.length > 1 && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs shrink-0" style={{ color: CB }}>server:</span>
          <div className="flex gap-1.5 flex-wrap">
            {ldapServers.filter(s => s.active).map(s => (
              <button key={s.id} type="button"
                onClick={() => setSelectedServerId(s.id)}
                className="text-xs px-2 py-0.5"
                style={{
                  border: `1px solid ${activeServerId === s.id ? C : BORDER}`,
                  background: activeServerId === s.id ? 'var(--accent-soft)' : 'none',
                  color: activeServerId === s.id ? C : CM,
                  cursor: 'pointer',
                }}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.accessRules.length > 0 && (
        <div className="space-y-1 mb-2">
          {form.accessRules.map((rule, i) => {
            const sName = ldapServers.find(s => s.id === rule.ldapServerId)?.name
            return (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 text-xs"
                style={{ border: `1px solid ${C}`, background: 'var(--accent-soft)' }}>
                <span style={{ color: CB, flexShrink: 0 }}>📁</span>
                <span className="flex-1 truncate font-mono" style={{ color: C }} title={rule.value}>{rule.value}</span>
                {sName && <span style={{ color: CB, fontSize: '0.65rem', flexShrink: 0 }}>@{sName}</span>}
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, accessRules: f.accessRules.filter((_, j) => j !== i) }))}
                  style={{ color: CM, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ border: `1px solid ${BORDER}`, maxHeight: '13rem', overflowY: 'auto', background: SURFACE2 }}>
        {rootLoading && !rootNodes ? (
          <div className="px-3 py-3 text-xs" style={{ color: CM }}>loading tree from {selectedServerName}…</div>
        ) : loadError ? (
          <div className="px-3 py-3 text-xs" style={{ color: CB }}>{loadError}</div>
        ) : rootNodes && rootNodes.filter(n => n.type !== 'user').length === 0 ? (
          <div className="px-3 py-3 text-xs" style={{ color: CB }}>no containers found on {selectedServerName}</div>
        ) : (
          renderNodes('ROOT', 0)
        )}
      </div>

      <div className="flex gap-2 mt-2">
        <input value={manualDn} onChange={e => setManualDn(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }}
          placeholder="manual DN: OU=staff,DC=corp,DC=ao"
          style={{ ...inputStyle, flex: 1, fontSize: '0.75rem' }}
          onFocus={e => { e.target.style.borderColor = C }}
          onBlur={e => { e.target.style.borderColor = BORDER }}
        />
        <button type="button" onClick={addManual} disabled={!manualDn.trim()}
          style={{
            padding: '0 0.75rem', background: manualDn.trim() ? C : CM, color: '#000', border: 'none',
            cursor: manualDn.trim() ? 'pointer' : 'not-allowed', fontSize: '0.75rem', fontWeight: 700,
          }}>
          add
        </button>
      </div>
      <p className="text-xs mt-1" style={{ color: CB }}>click to select folder · sub-folders included (DN suffix match) · expand ▸ to browse · or enter DN manually</p>
    </div>
  )
}

function AssignedUsersManager({ appId }: { appId: string }) {
  const qc = useQueryClient()
  const [userFilter, setUserFilter] = useState('')
  const [ldapSearch, setLdapSearch] = useState('')
  const [showAddPanel, setShowAddPanel] = useState(false)

  const { data: appUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['app-users', appId],
    queryFn: () => usersApi.listForApp(appId, { size: 100 }),
  })

  const { data: ldapResults = [], isFetching: fetchingLdap } = useQuery({
    queryKey: ['ldap-search-add', ldapSearch],
    queryFn: () => ldapApi.getUsers(undefined, ldapSearch || undefined),
    enabled: showAddPanel && ldapSearch.length >= 1,
    staleTime: 30_000,
  })

  const activateMut = useMutation({
    mutationFn: (ldapUsername: string) => usersApi.activateForApp(appId, ldapUsername),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-users', appId] }),
  })

  const revokeMut = useMutation({
    mutationFn: (userId: string) => usersApi.revokeAppAccess(appId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-users', appId] }),
  })

  const users = appUsers?.content ?? []
  const existingUsernames = new Set(users.map(u => u.ldapUsername))
  const filteredUsers = userFilter
    ? users.filter(u =>
        u.displayName.toLowerCase().includes(userFilter.toLowerCase()) ||
        u.ldapUsername.toLowerCase().includes(userFilter.toLowerCase())
      )
    : users

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs tracking-widest uppercase" style={{ color: CD }}># assigned users</label>
        <button type="button"
          onClick={() => setShowAddPanel(s => !s)}
          style={{
            fontSize: '0.75rem', color: showAddPanel ? CM : C,
            background: 'none', border: `1px solid ${showAddPanel ? BORDER : C}`,
            padding: '2px 10px', cursor: 'pointer',
          }}>
          {showAddPanel ? 'cancel' : '+ add user'}
        </button>
      </div>

      {/* LDAP search panel */}
      {showAddPanel && (
        <div className="mb-3 p-2.5" style={{ border: `1px solid ${C}`, background: 'rgba(94,234,212,0.03)' }}>
          <div className="text-xs mb-1.5" style={{ color: CD }}>search LDAP directory</div>
          <input
            value={ldapSearch}
            onChange={e => setLdapSearch(e.target.value)}
            placeholder="type name or username..."
            autoFocus
            style={{ ...inputStyle, marginBottom: '0.375rem' }}
            onFocus={e => { e.target.style.borderColor = C }}
            onBlur={e => { e.target.style.borderColor = BORDER }}
          />
          <div style={{ border: `1px solid ${BORDER}`, maxHeight: '9rem', overflowY: 'auto', background: SURFACE2 }}>
            {fetchingLdap ? (
              <div className="px-3 py-2 text-xs" style={{ color: CM }}>searching...</div>
            ) : ldapSearch.length === 0 ? (
              <div className="px-3 py-2 text-xs" style={{ color: CB }}>type to search LDAP users</div>
            ) : ldapResults.length === 0 ? (
              <div className="px-3 py-2 text-xs" style={{ color: CB }}>no users found</div>
            ) : (
              ldapResults.slice(0, 20).map(u => {
                const alreadyAdded = existingUsernames.has(u.ldap_username)
                return (
                  <button key={u.ldap_username} type="button"
                    disabled={alreadyAdded || activateMut.isPending}
                    onClick={() => activateMut.mutate(u.ldap_username)}
                    className="flex items-center justify-between w-full px-3 py-1.5 text-xs text-left"
                    style={{
                      background: alreadyAdded ? 'var(--accent-soft)' : 'none',
                      border: 'none',
                      borderBottom: `1px solid rgba(94,234,212,0.07)`,
                      color: alreadyAdded ? CM : C,
                      cursor: alreadyAdded ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                    }}>
                    <span>{u.display_name || u.ldap_username}</span>
                    <span style={{ color: CB }}>{alreadyAdded ? '✓ already added' : u.ldap_username}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Current assigned users */}
      {loadingUsers ? (
        <div className="text-xs py-1" style={{ color: CM }}>loading...</div>
      ) : users.length === 0 ? (
        <div className="text-xs py-2 px-3" style={{ color: CB, border: `1px solid ${BORDER}`, background: SURFACE2 }}>
          no users assigned yet — use "+ add user" above
        </div>
      ) : (
        <>
          {users.length > 5 && (
            <input value={userFilter} onChange={e => setUserFilter(e.target.value)}
              placeholder={`filter ${users.length} assigned users...`}
              style={{ ...inputStyle, marginBottom: '0.375rem' }}
              onFocus={e => { e.target.style.borderColor = C }}
              onBlur={e => { e.target.style.borderColor = BORDER }}
            />
          )}
          <div style={{ border: `1px solid ${BORDER}`, maxHeight: '10rem', overflowY: 'auto' }}>
            {filteredUsers.map(u => (
              <div key={u.id} className="flex items-center justify-between px-3 py-1.5 text-xs"
                style={{ borderBottom: `1px solid rgba(94,234,212,0.07)`, background: SURFACE2 }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate" style={{ color: CD }}>{u.displayName}</span>
                  <span style={{ color: CB }}>{u.ldapUsername}</span>
                </div>
                <button type="button"
                  onClick={() => revokeMut.mutate(u.id)}
                  disabled={revokeMut.isPending}
                  style={{
                    fontSize: '0.7rem', color: '#ff3333',
                    background: 'none', border: '1px solid rgba(255,51,51,0.3)',
                    padding: '1px 6px', cursor: 'pointer', flexShrink: 0, marginLeft: '0.5rem',
                  }}>
                  revoke
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="text-xs mt-1" style={{ color: CB }}>
        assigned users always have access regardless of mode — switching to public/group/ou keeps them
      </p>
    </div>
  )
}

function AppModal({ title, form, setForm, error, onSave, onClose, saving, isEdit, isPublicLocked, appId }: {
  title: string; form: AppForm; setForm: React.Dispatch<React.SetStateAction<AppForm>>
  error: string; onSave: () => void; onClose: () => void; saving: boolean; isEdit: boolean
  isPublicLocked?: boolean; appId?: string
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-auto border" style={{ background: 'var(--bg)', borderColor: BORDER_H }}>
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
              onFocus={e => { e.target.style.borderColor = C; e.target.style.boxShadow = '0 0 0 2px rgba(94,234,212,0.1)' }}
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
                      background: form.isPublicClient === opt.value ? 'var(--accent-soft)' : 'transparent',
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

          <TagInput label="post_logout_redirect_uris" tags={form.postLogoutRedirectUris}
            onChange={uris => setForm(f => ({ ...f, postLogoutRedirectUris: uris }))}
            placeholder="https://app.ao.az/logged-out"
          />

          {/* Access mode selector */}
          <div>
            <label className="block text-xs tracking-widest uppercase mb-1.5" style={{ color: CD }}># access_mode</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'ASSIGNED', label: 'assigned', desc: 'manual grants only' },
                { value: 'PUBLIC', label: 'public', desc: 'any LDAP user' },
                { value: 'LDAP_GROUP', label: 'ldap group', desc: 'by group membership' },
                { value: 'LDAP_OU', label: 'ldap ou', desc: 'by OU / folder path' },
              ] as const).map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(f => ({ ...f, accessMode: opt.value, accessRules: [] }))}
                  className="px-3 py-2 text-left text-xs transition-all"
                  style={{
                    border: `1px solid ${form.accessMode === opt.value ? C : BORDER}`,
                    background: form.accessMode === opt.value ? 'var(--accent-soft)' : 'transparent',
                    color: form.accessMode === opt.value ? C : CM,
                    cursor: 'pointer',
                  }}
                >
                  <div className="font-bold tracking-wide">{opt.label}</div>
                  <div className="mt-0.5" style={{ color: CB }}>{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Mode description */}
            <div className="mt-2 px-3 py-2 text-xs" style={{ background: SURFACE2, border: `1px solid ${BORDER}`, color: CB }}>
              {form.accessMode === 'ASSIGNED' && 'Only users you explicitly add below can log in to this app.'}
              {form.accessMode === 'PUBLIC' && 'Any user who authenticates against LDAP can log in — no individual grants needed. Previously assigned users keep their access.'}
              {form.accessMode === 'LDAP_GROUP' && 'Users who are members of the selected LDAP groups can log in. Manually assigned users always have access too.'}
              {form.accessMode === 'LDAP_OU' && 'Users whose LDAP DN falls under the selected OU path can log in. Manually assigned users always have access too.'}
            </div>
          </div>

          {form.accessMode === 'LDAP_GROUP' && <GroupRuleBuilder form={form} setForm={setForm} />}
          {form.accessMode === 'LDAP_OU' && <OuRuleBuilder form={form} setForm={setForm} />}

          {/* Assigned users management — only in edit mode */}
          {isEdit && appId && (
            <AssignedUsersManager appId={appId} />
          )}

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
      <div className="w-full max-w-md border" style={{ background: 'var(--bg)', borderColor: 'rgba(255,51,51,0.4)' }}>
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

function AppCard({ app, onEdit, onRemove, onToggleActive }: {
  app: Application
  onEdit: () => void
  onRemove: () => void
  onToggleActive: () => void
}) {
  const [showSecret, setShowSecret] = useState(false)
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
              background: app.is_public_client ? 'rgba(255,170,0,0.06)' : 'var(--accent-soft)',
            }}>
              {app.is_public_client ? 'public' : 'confidential'}
            </span>
            <span className="text-xs px-2 py-0.5 font-bold" style={{
              color: app.is_active ? C : '#ff3333',
              border: `1px solid ${app.is_active ? 'rgba(94,234,212,0.3)' : 'rgba(255,51,51,0.3)'}`,
              background: app.is_active ? 'var(--accent-soft)' : 'rgba(255,51,51,0.06)',
            }}>
              {app.is_active ? 'active' : 'inactive'}
            </span>
            {app.access_mode && app.access_mode !== 'ASSIGNED' && (
              <span className="text-xs px-2 py-0.5 font-bold" style={{
                color: '#a78bfa',
                border: '1px solid rgba(167,139,250,0.3)',
                background: 'rgba(167,139,250,0.06)',
              }}>
                {app.access_mode === 'PUBLIC' ? 'public access'
                  : app.access_mode === 'LDAP_GROUP' ? `ldap group (${app.access_rules?.length ?? 0})`
                  : `ldap ou (${app.access_rules?.length ?? 0})`}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs w-20 shrink-0" style={{ color: CB }}>client_id</span>
            <code className="text-xs flex-1 truncate px-2 py-1" style={{ color: CD, background: 'var(--accent-soft)', border: `1px solid ${BORDER}` }}>{app.client_id}</code>
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
          <div className="mb-2">
            <div className="text-xs mb-1" style={{ color: CB }}>redirect_uris</div>
            <div className="flex flex-wrap gap-1.5">
              {app.redirect_uris.map(uri => (
                <span key={uri} className="text-xs px-2 py-0.5 truncate max-w-[200px]"
                  style={{ color: CM, border: `1px solid ${BORDER}`, background: 'var(--accent-soft)' }}>{uri}</span>
              ))}
            </div>
          </div>
        )}
        {app.post_logout_redirect_uris?.length > 0 && (
          <div className="mb-3">
            <div className="text-xs mb-1" style={{ color: CB }}>post_logout_redirect_uris</div>
            <div className="flex flex-wrap gap-1.5">
              {app.post_logout_redirect_uris.map(uri => (
                <span key={uri} className="text-xs px-2 py-0.5 truncate max-w-[200px]"
                  style={{ color: CM, border: `1px solid rgba(94,234,212,0.15)`, background: 'rgba(94,234,212,0.04)' }}>{uri}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex" style={{ borderTop: `1px solid ${BORDER}` }}>
        <button onClick={onEdit}
          className="flex-1 px-3 py-2 text-xs tracking-wide"
          style={{ color: CD, background: 'none', border: 'none', borderRight: `1px solid ${BORDER}`, cursor: 'pointer' }}>
          {'> '}edit
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
  const { data: apps, isLoading, error } = useQuery({ queryKey: ['applications'], queryFn: appsApi.list })
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
      postLogoutRedirectUris: f.postLogoutRedirectUris,
      isPublicClient: f.isPublicClient,
      accessMode: f.accessMode,
      accessRules: f.accessRules.map(r => ({ ruleType: r.ruleType, value: r.value, ldapServerId: r.ldapServerId || null })),
    }),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['applications'] })
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
      postLogoutRedirectUris: f.postLogoutRedirectUris,
      accessMode: f.accessMode,
      accessRules: f.accessRules.map(r => ({ ruleType: r.ruleType, value: r.value, ldapServerId: r.ldapServerId || null })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); setEditApp(null); setForm(emptyForm) },
    onError: (e: any) => setFormError(e.response?.data?.error_description ?? 'update failed'),
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => appsApi.deactivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); setRemoveApp(null) },
  })

  const activateMut = useMutation({
    mutationFn: (id: string) => appsApi.activate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => appsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); setRemoveApp(null) },
  })

  function openEdit(app: Application) {
    setForm({
      name: app.name,
      slug: app.slug,
      redirectUris: app.redirect_uris ?? [],
      allowedOrigins: app.allowed_origins ?? [],
      postLogoutRedirectUris: app.post_logout_redirect_uris ?? [],
      isPublicClient: app.is_public_client ?? false,
      accessMode: app.access_mode ?? 'ASSIGNED',
      accessRules: (app.access_rules ?? []).map(r => ({
        ruleType: r.rule_type,
        value: r.value,
        ldapServerId: r.ldap_server_id ?? '',
      })),
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
          appId={editApp?.id}
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
          <div className="w-full max-w-md p-8 border" style={{ background: 'var(--bg)', borderColor: C, boxShadow: `0 0 40px rgba(94,234,212,0.15)` }}>
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
