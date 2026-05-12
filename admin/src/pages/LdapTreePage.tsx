import React, { useState, useEffect, useMemo, useRef, useCallback, useReducer } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import { usersApi } from '../api/users'
import { appsApi } from '../api/apps'
import { settingsApi, LdapServerConfig } from '../api/settings'
import { ldapApi, LdapSearchHit } from '../api/ldap'
import type { Application } from '../types'

/* ======================================================================
   Type definitions
   ====================================================================== */

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
}

interface FlatNode {
  node: TreeNode
  depth: number
  configId: string
  isLast: boolean
  parentDepthFlags: boolean[]
  kind: 'node' | 'skeleton' | 'empty' | 'config'
  configRef?: LdapServerConfig
}

interface Selection {
  configId: string
  node: TreeNode
}

interface PinnedRef {
  node: TreeNode
  configId: string
}

interface RecentRef {
  node: TreeNode
  configId: string
  ts: number
}

/* ======================================================================
   Color palette / fonts
   ====================================================================== */

// "Quanta" design system — refined dark with semantic color, not neon-monoculture.
// Surfaces are layered warm graphite (not pure black); accents are color-coded by meaning.
const C = {
  // Base layers — warm graphite, layered for depth (no pure black, no flat panels)
  bg:         '#0a0c10',
  surface:    '#12161e',
  surface2:   '#1a1f29',
  surface3:   '#242a36',
  // Borders — opacity-based off white so they adapt to any background
  border:       'rgba(255,255,255,0.08)',
  borderHover:  'rgba(255,255,255,0.18)',
  borderFaint:  'rgba(255,255,255,0.04)',
  // Primary accent — soft mint (NOT neon cyan). Reserved for active state, focus, primary action.
  cyan:     '#5eead4',
  cyanDim:  '#2dd4bf',
  // Text hierarchy via lightness, not hue
  text:       '#e7ebf0',
  textDim:    '#a3acb9',
  textMuted:  '#6b7383',
  // Semantic accents — each entity class gets a distinct, refined hue
  blue:          '#7dd3fc',  // info / sky
  ouGold:        '#fbbf24',  // organizational unit — amber/gold
  containerBlue: '#7dd3fc',  // container — sky
  purple:        '#c4b5fd',  // group — lavender
  amber:         '#fb923c',  // warning — peach
  red:           '#fb7185',  // danger — coral
  green:         '#34d399',  // success — emerald
  slate:         '#94a3b8',
}

const FONT = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const ROW_H = 26
const INDENT = 16
const LINE_COLOR = 'rgba(255,255,255,0.05)'
const OVERSCAN = 5

const LS_PINNED = 'ldap-pinned'
const LS_FAVORITES = 'ldap-favorites'
const LS_RECENT = 'ldap-recent'
const LS_PANEL_WIDTH = 'ldap-panel-width'

/* ======================================================================
   Icons
   ====================================================================== */

function Spinner({ size = 12, color = C.cyan }: { size?: number; color?: string }) {
  const [angle, setAngle] = useState(0)
  const ref = useRef<number | null>(null)
  useEffect(() => {
    const tick = () => {
      setAngle(a => (a + 6) % 360)
      ref.current = requestAnimationFrame(tick)
    }
    ref.current = requestAnimationFrame(tick)
    return () => { if (ref.current) cancelAnimationFrame(ref.current) }
  }, [])
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, transform: `rotate(${angle}deg)` }}>
      <circle cx="12" cy="12" r="10" fill="none" stroke={C.borderFaint} strokeWidth="2.5" />
      <path d="M12 2 A10 10 0 0 1 22 12" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function DomainIcon({ size = 14, color = C.cyan }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.4" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="7.5" />
      <ellipse cx="10" cy="10" rx="3.5" ry="7.5" />
      <line x1="2.5" y1="10" x2="17.5" y2="10" />
      <line x1="10" y1="2.5" x2="10" y2="17.5" />
    </svg>
  )
}

function OuFolderIcon({ expanded, size = 14 }: { expanded: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
      {expanded ? (
        <>
          <path d="M2 5.5a1.5 1.5 0 011.5-1.5h4l1.6 1.7H16a1.5 1.5 0 011.5 1.5v.8H4.5a1.5 1.5 0 00-1.45 1.1L2 12.5V5.5z" fill={C.ouGold} opacity="0.55" />
          <path d="M3.2 9.2a1.2 1.2 0 011.16-.9h13.5a1 1 0 01.97 1.27l-1.6 5.7A1.5 1.5 0 0115.78 16.4H3.5A1.5 1.5 0 012 14.9V14L3.2 9.2z" fill={C.ouGold} />
          <path d="M3.2 9.2a1.2 1.2 0 011.16-.9h13.5a1 1 0 01.97 1.27l-1.6 5.7A1.5 1.5 0 0115.78 16.4H3.5A1.5 1.5 0 012 14.9V14L3.2 9.2z" fill="none" stroke="#a87a0a" strokeWidth="0.5" opacity="0.4" />
        </>
      ) : (
        <>
          <path d="M2 5.5a1.5 1.5 0 011.5-1.5h4.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H16a1.5 1.5 0 011.5 1.5V14.5A1.5 1.5 0 0116 16H3.5A1.5 1.5 0 012 14.5V5.5z" fill={C.ouGold} />
          <path d="M2 7.4h15.5V8.1H2z" fill="#a87a0a" opacity="0.5" />
        </>
      )}
    </svg>
  )
}

function ContainerIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={C.containerBlue} strokeWidth="1.4" style={{ flexShrink: 0 }}>
      <rect x="3" y="5" width="14" height="11" rx="1" />
      <line x1="3" y1="9" x2="17" y2="9" />
      <circle cx="6" cy="7" r="0.5" fill={C.containerBlue} />
      <circle cx="8" cy="7" r="0.5" fill={C.containerBlue} />
    </svg>
  )
}

function UserIcon({ activated, size = 13 }: { activated: boolean; size?: number }) {
  const color = activated ? C.cyan : C.textMuted
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="6.5" r="3" fill="none" stroke={color} strokeWidth="1.4" />
      <path d="M3.5 17.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      {activated && <circle cx="15.5" cy="14.5" r="2.6" fill={C.bg} stroke={C.green} strokeWidth="1.2" />}
      {activated && <path d="M14.2 14.5l1 1 1.6-1.7" fill="none" stroke={C.green} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

function GroupShieldIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
      <path d="M10 1.5l6 2.2v5.1c0 3.6-2.5 7-6 8.2-3.5-1.2-6-4.6-6-8.2V3.7L10 1.5z" fill="none" stroke={C.purple} strokeWidth="1.3" />
      <circle cx="10" cy="8" r="1.8" fill={C.purple} opacity="0.85" />
      <path d="M6.8 13.2c.6-1.5 1.9-2.4 3.2-2.4s2.6.9 3.2 2.4" fill="none" stroke={C.purple} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function OtherIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={C.textMuted} strokeWidth="1.4" style={{ flexShrink: 0 }}>
      <rect x="4" y="4" width="12" height="12" rx="1" />
      <line x1="4" y1="8" x2="16" y2="8" />
    </svg>
  )
}

function ComputerIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={C.slate} strokeWidth="1.3" style={{ flexShrink: 0 }}>
      <rect x="2.5" y="3.5" width="15" height="10" rx="1" />
      <line x1="2.5" y1="11.5" x2="17.5" y2="11.5" />
      <path d="M7.5 16.5h5M10 13.5v3" strokeLinecap="round" />
    </svg>
  )
}

function GPOIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={C.blue} strokeWidth="1.3" style={{ flexShrink: 0 }}>
      <path d="M4 2.5h8l4 4v11a1 1 0 01-1 1H4a1 1 0 01-1-1V3.5a1 1 0 011-1z" />
      <path d="M12 2.5v4h4" />
      <circle cx="10" cy="13" r="2" />
      <path d="M10 10v1.5M10 14.5V16M7 13h1.5M11.5 13H13" strokeLinecap="round" />
    </svg>
  )
}

function ServiceAccountIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={C.amber} strokeWidth="1.3" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="6.5" r="2.5" />
      <path d="M2.5 16c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" strokeLinecap="round" />
      <circle cx="15" cy="14" r="2.5" fill={C.bg} />
      <path d="M15 12.5v.5M15 15v.5M13.5 14h.5M16 14h.5" strokeLinecap="round" />
    </svg>
  )
}

function DNSIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={C.green} strokeWidth="1.3" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10h14M10 3c2 2 3 4.5 3 7s-1 5-3 7c-2-2-3-4.5-3-7s1-5 3-7z" />
    </svg>
  )
}

function Chevron({ expanded, size = 10 }: { expanded: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor"
      style={{ color: C.textMuted, flexShrink: 0, transition: 'transform 0.15s ease', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  )
}

function SearchIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="5" />
      <line x1="13" y1="13" x2="17" y2="17" strokeLinecap="round" />
    </svg>
  )
}

function StarIcon({ filled, size = 11 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
      <path
        d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L10 14.9 4.7 17.7l1.1-5.9L1.5 7.7l5.9-.8L10 1.5z"
        fill={filled ? C.amber : 'none'}
        stroke={filled ? C.amber : C.textMuted}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PinIcon({ size = 11, color = C.cyan }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.4" style={{ flexShrink: 0 }}>
      <path d="M10 13v5M6 8h8v-2l-2-3H8L6 6v2zM6 8l-1 4h10l-1-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ======================================================================
   Helpers
   ====================================================================== */

function deriveDomain(baseDn: string): string {
  if (!baseDn) return ''
  const parts = baseDn.split(',').map(p => p.trim())
  const dcs = parts.filter(p => p.toLowerCase().startsWith('dc=')).map(p => p.slice(3))
  if (dcs.length > 0) return dcs.join('.')
  return baseDn
}

function nowStamp(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function classifyOther(node: TreeNode): 'computer' | 'gpo' | 'service' | 'dns' | 'container' | 'other' {
  const rdn = node.rdn.toLowerCase()
  const name = node.name.toLowerCase()
  if (rdn.includes('cn=computers') || name.includes('computer')) return 'computer'
  if (rdn.includes('cn=policies') || name.includes('polic')) return 'gpo'
  if (name.includes('service') || name.includes('svc')) return 'service'
  if (name.includes('dns') || rdn.includes('dns')) return 'dns'
  if (rdn.startsWith('cn=system') || rdn.startsWith('cn=builtin') || rdn.startsWith('cn=')) return 'container'
  return 'other'
}

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeLS(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota errors */
  }
}

function dnAncestors(dn: string): string[] {
  // Splits at top-level commas (no nested escaping handling, but adequate for AD)
  const parts: string[] = []
  let buf = ''
  let escaped = false
  for (let i = 0; i < dn.length; i++) {
    const c = dn[i]
    if (escaped) { buf += c; escaped = false; continue }
    if (c === '\\') { buf += c; escaped = true; continue }
    if (c === ',') { parts.push(buf.trim()); buf = ''; continue }
    buf += c
  }
  if (buf) parts.push(buf.trim())
  // Build ancestors: for parts [cn=John, ou=IT, ou=Corp, dc=corp, dc=example, dc=com],
  // ancestors are joins of [1..], [2..], etc.
  const ancestors: string[] = []
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(i).join(','))
  }
  return ancestors
}

/* ======================================================================
   Tree state reducer
   ====================================================================== */

interface TreeState {
  expandedDns: Set<string>
  childMap: Map<string, TreeNode[]>
  loadingDns: Set<string>
  searchQuery: string
  debouncedSearch: string
  selection: Selection | null
  favorites: Set<string>
  pinnedNodes: Map<string, PinnedRef>
  recentNodes: RecentRef[]
  multiSelected: Set<string>
}

type TreeAction =
  | { type: 'TOGGLE_EXPAND'; dn: string }
  | { type: 'EXPAND'; dn: string }
  | { type: 'COLLAPSE'; dn: string }
  | { type: 'SET_CHILDREN'; dn: string; children: TreeNode[] }
  | { type: 'SET_LOADING'; dn: string; loading: boolean }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SET_DEBOUNCED_SEARCH'; query: string }
  | { type: 'SELECT'; configId: string; node: TreeNode }
  | { type: 'CLEAR_SELECT' }
  | { type: 'TOGGLE_FAVORITE'; dn: string }
  | { type: 'PIN_NODE'; dn: string; ref: PinnedRef }
  | { type: 'UNPIN_NODE'; dn: string }
  | { type: 'ADD_RECENT'; node: TreeNode; configId: string }
  | { type: 'SET_MULTISELECT'; dns: Set<string> }
  | { type: 'TOGGLE_MULTISELECT'; dn: string }
  | { type: 'CLEAR_MULTISELECT' }
  | { type: 'HYDRATE_PERSIST'; favorites: Set<string>; pinned: Map<string, PinnedRef>; recent: RecentRef[] }

function initState(): TreeState {
  return {
    expandedDns: new Set<string>(),
    childMap: new Map<string, TreeNode[]>(),
    loadingDns: new Set<string>(),
    searchQuery: '',
    debouncedSearch: '',
    selection: null,
    favorites: new Set<string>(),
    pinnedNodes: new Map<string, PinnedRef>(),
    recentNodes: [],
    multiSelected: new Set<string>(),
  }
}

function treeReducer(state: TreeState, action: TreeAction): TreeState {
  switch (action.type) {
    case 'TOGGLE_EXPAND': {
      const next = new Set(state.expandedDns)
      if (next.has(action.dn)) next.delete(action.dn)
      else next.add(action.dn)
      return { ...state, expandedDns: next }
    }
    case 'EXPAND': {
      if (state.expandedDns.has(action.dn)) return state
      const next = new Set(state.expandedDns)
      next.add(action.dn)
      return { ...state, expandedDns: next }
    }
    case 'COLLAPSE': {
      if (!state.expandedDns.has(action.dn)) return state
      const next = new Set(state.expandedDns)
      next.delete(action.dn)
      return { ...state, expandedDns: next }
    }
    case 'SET_CHILDREN': {
      const m = new Map(state.childMap)
      m.set(action.dn, action.children)
      return { ...state, childMap: m }
    }
    case 'SET_LOADING': {
      const next = new Set(state.loadingDns)
      if (action.loading) next.add(action.dn)
      else next.delete(action.dn)
      return { ...state, loadingDns: next }
    }
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query }
    case 'SET_DEBOUNCED_SEARCH':
      return { ...state, debouncedSearch: action.query }
    case 'SELECT':
      return { ...state, selection: { configId: action.configId, node: action.node } }
    case 'CLEAR_SELECT':
      return { ...state, selection: null }
    case 'TOGGLE_FAVORITE': {
      const next = new Set(state.favorites)
      if (next.has(action.dn)) next.delete(action.dn)
      else next.add(action.dn)
      return { ...state, favorites: next }
    }
    case 'PIN_NODE': {
      const m = new Map(state.pinnedNodes)
      m.set(action.dn, action.ref)
      return { ...state, pinnedNodes: m }
    }
    case 'UNPIN_NODE': {
      const m = new Map(state.pinnedNodes)
      m.delete(action.dn)
      return { ...state, pinnedNodes: m }
    }
    case 'ADD_RECENT': {
      const filtered = state.recentNodes.filter(r => r.node.dn !== action.node.dn)
      const next = [{ node: action.node, configId: action.configId, ts: Date.now() }, ...filtered].slice(0, 10)
      return { ...state, recentNodes: next }
    }
    case 'SET_MULTISELECT':
      return { ...state, multiSelected: action.dns }
    case 'TOGGLE_MULTISELECT': {
      const next = new Set(state.multiSelected)
      if (next.has(action.dn)) next.delete(action.dn)
      else next.add(action.dn)
      return { ...state, multiSelected: next }
    }
    case 'CLEAR_MULTISELECT':
      return { ...state, multiSelected: new Set<string>() }
    case 'HYDRATE_PERSIST':
      return {
        ...state,
        favorites: action.favorites,
        pinnedNodes: action.pinned,
        recentNodes: action.recent,
      }
    default:
      return state
  }
}

/* ======================================================================
   Per-config root loader (small wrapper hook used inside main page)
   ====================================================================== */

/* ======================================================================
   Activate modal
   ====================================================================== */

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
      setError(e.response?.data?.message ?? 'Operation failed')
    },
  })

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(2px)',
        animation: 'ldapFadeIn 0.15s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 460,
        border: `1px solid ${C.borderHover}`,
        background: C.surface,
        boxShadow: '0 0 0 1px rgba(94,234,212,0.08), 0 30px 80px rgba(94,234,212,0.06)',
        fontFamily: FONT,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.875rem 1.125rem',
          borderBottom: `1px solid ${C.border}`,
          background: `linear-gradient(180deg, ${C.surface3} 0%, ${C.surface2} 100%)`,
        }}>
          <div>
            <div style={{ fontSize: '0.625rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: C.textMuted }}>
              modal &middot; grant_access
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: C.cyan, marginTop: 2 }}>
              {node.name}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer',
            color: C.textDim, fontSize: '0.875rem', lineHeight: 1, padding: '4px 8px',
            fontFamily: FONT,
          }}>×</button>
        </div>

        <div style={{ padding: '1.125rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div style={{
            padding: '0.625rem 0.75rem', border: `1px solid ${C.border}`,
            background: C.bg, fontSize: '0.7rem', lineHeight: 1.7,
          }}>
            {node.ldap_username && <div style={{ color: C.textMuted }}>uid&nbsp;&nbsp;= <span style={{ color: C.cyan }}>{node.ldap_username}</span></div>}
            {node.email && <div style={{ color: C.textMuted }}>mail = <span style={{ color: C.textDim }}>{node.email}</span></div>}
            {node.title && <div style={{ color: C.textMuted }}>title = <span style={{ color: C.textDim }}>{node.title}</span></div>}
          </div>

          {error && (
            <div style={{
              padding: '0.5rem 0.75rem', fontSize: '0.7rem',
              border: '1px solid rgba(255,51,51,0.35)', background: 'rgba(255,51,51,0.08)',
              color: C.red,
            }}>
              ! {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.625rem', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, color: C.textMuted }}>
              target_application
            </label>
            <select
              value={appId}
              onChange={e => setAppId(e.target.value)}
              style={{
                width: '100%', padding: '0.5rem 0.75rem',
                border: `1px solid ${C.border}`, background: C.bg,
                color: C.cyan, fontFamily: FONT, fontSize: '0.8125rem', outline: 'none',
              }}
            >
              <option value="" style={{ background: C.surface }}>— select application —</option>
              {apps.map(a => (
                <option key={a.id} value={a.id} style={{ background: C.surface }}>{a.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.45rem 1rem', fontSize: '0.75rem',
                border: `1px solid ${C.border}`, background: 'none',
                color: C.textDim, cursor: 'pointer', fontFamily: FONT,
              }}
            >
              cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!appId || mutation.isPending}
              style={{
                padding: '0.45rem 1rem', fontSize: '0.75rem', fontWeight: 700,
                border: `1px solid ${(!appId || mutation.isPending) ? C.border : C.cyan}`,
                background: (!appId || mutation.isPending) ? 'transparent' : C.cyan,
                color: (!appId || mutation.isPending) ? C.textMuted : '#000',
                cursor: (!appId || mutation.isPending) ? 'not-allowed' : 'pointer',
                fontFamily: FONT,
                letterSpacing: '0.05em',
              }}
            >
              {mutation.isPending ? 'granting...' : '> grant_access'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ======================================================================
   Bulk grant modal
   ====================================================================== */

function BulkGrantModal({
  users, apps, onClose,
}: {
  users: TreeNode[]
  apps: Application[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [appId, setAppId] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number; errors: string[] }>({ done: 0, total: 0, errors: [] })
  const [running, setRunning] = useState(false)

  const run = async () => {
    if (!appId) return
    setRunning(true)
    setProgress({ done: 0, total: users.length, errors: [] })
    for (let i = 0; i < users.length; i++) {
      const u = users[i]
      if (!u.ldap_username) {
        setProgress(p => ({ ...p, done: p.done + 1, errors: [...p.errors, `${u.name}: missing uid`] }))
        continue
      }
      try {
        await usersApi.activateForApp(appId, u.ldap_username)
        setProgress(p => ({ ...p, done: p.done + 1 }))
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'failed'
        setProgress(p => ({ ...p, done: p.done + 1, errors: [...p.errors, `${u.name}: ${msg}`] }))
      }
    }
    qc.invalidateQueries({ queryKey: ['ldap-tree'] })
    setRunning(false)
  }

  const finished = progress.total > 0 && progress.done === progress.total

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(2px)', animation: 'ldapFadeIn 0.15s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget && !running) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 540,
        border: `1px solid ${C.borderHover}`, background: C.surface,
        boxShadow: '0 0 0 1px rgba(94,234,212,0.08), 0 30px 80px rgba(94,234,212,0.06)',
        fontFamily: FONT,
      }}>
        <div style={{
          padding: '0.875rem 1.125rem',
          borderBottom: `1px solid ${C.border}`,
          background: `linear-gradient(180deg, ${C.surface3} 0%, ${C.surface2} 100%)`,
        }}>
          <div style={{ fontSize: '0.625rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: C.textMuted }}>
            modal &middot; bulk_grant_access
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: C.cyan, marginTop: 2 }}>
            {users.length} user{users.length === 1 ? '' : 's'} selected
          </div>
        </div>
        <div style={{ padding: '1.125rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div style={{
            maxHeight: 160, overflow: 'auto',
            border: `1px solid ${C.border}`, background: C.bg,
          }}>
            {users.map(u => (
              <div key={u.dn} style={{
                padding: '4px 10px', fontSize: '0.7rem',
                color: C.textDim, borderBottom: `1px solid ${C.borderFaint}`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <UserIcon activated={u.is_activated} size={11} />
                <span style={{ color: C.cyan }}>{u.name}</span>
                <span style={{ color: C.textMuted, marginLeft: 'auto' }}>{u.ldap_username ?? '—'}</span>
              </div>
            ))}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.625rem', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, color: C.textMuted }}>
              target_application
            </label>
            <select
              value={appId}
              onChange={e => setAppId(e.target.value)}
              disabled={running}
              style={{
                width: '100%', padding: '0.5rem 0.75rem',
                border: `1px solid ${C.border}`, background: C.bg,
                color: C.cyan, fontFamily: FONT, fontSize: '0.8125rem', outline: 'none',
              }}
            >
              <option value="" style={{ background: C.surface }}>— select application —</option>
              {apps.map(a => (
                <option key={a.id} value={a.id} style={{ background: C.surface }}>{a.name}</option>
              ))}
            </select>
          </div>
          {progress.total > 0 && (
            <div style={{ border: `1px solid ${C.border}`, background: C.bg, padding: '0.5rem 0.75rem' }}>
              <div style={{ fontSize: '0.65rem', color: C.textMuted, display: 'flex', justifyContent: 'space-between' }}>
                <span>progress</span>
                <span style={{ color: C.cyan, fontVariantNumeric: 'tabular-nums' }}>{progress.done} / {progress.total}</span>
              </div>
              <div style={{ height: 4, background: C.surface2, marginTop: 6, position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${(progress.done / progress.total) * 100}%`,
                  background: finished && progress.errors.length === 0 ? C.green : C.cyan,
                  transition: 'width 0.2s ease',
                }} />
              </div>
              {progress.errors.length > 0 && (
                <div style={{ marginTop: 8, fontSize: '0.65rem', color: C.red, maxHeight: 80, overflow: 'auto' }}>
                  {progress.errors.map((e, i) => <div key={i}>! {e}</div>)}
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} disabled={running} style={{
              padding: '0.45rem 1rem', fontSize: '0.75rem',
              border: `1px solid ${C.border}`, background: 'none',
              color: C.textDim, cursor: running ? 'not-allowed' : 'pointer', fontFamily: FONT,
            }}>{finished ? 'close' : 'cancel'}</button>
            {!finished && (
              <button onClick={run} disabled={!appId || running} style={{
                padding: '0.45rem 1rem', fontSize: '0.75rem', fontWeight: 700,
                border: `1px solid ${(!appId || running) ? C.border : C.cyan}`,
                background: (!appId || running) ? 'transparent' : C.cyan,
                color: (!appId || running) ? C.textMuted : '#000',
                cursor: (!appId || running) ? 'not-allowed' : 'pointer',
                fontFamily: FONT, letterSpacing: '0.05em',
              }}>{running ? 'granting...' : `> grant_to_${users.length}`}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ======================================================================
   Context menu
   ====================================================================== */

interface ContextMenuItem {
  label: string
  onClick: () => void
  hint?: string
  danger?: boolean
  disabled?: boolean
}

function ContextMenu({
  x, y, items, onClose,
}: {
  x: number; y: number
  items: ContextMenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', handler)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', esc)
    }
  }, [onClose])

  // Adjust position if off-screen
  const [adj, setAdj] = useState({ x, y })
  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    let nx = x, ny = y
    if (x + rect.width > window.innerWidth) nx = window.innerWidth - rect.width - 4
    if (y + rect.height > window.innerHeight) ny = window.innerHeight - rect.height - 4
    setAdj({ x: nx, y: ny })
  }, [x, y])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: adj.x, top: adj.y, zIndex: 80,
        minWidth: 200,
        background: C.surface,
        border: `1px solid ${C.borderHover}`,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(94,234,212,0.08)',
        fontFamily: FONT,
        animation: 'ldapFadeIn 0.1s ease',
      }}
    >
      <div style={{
        padding: '4px 10px', fontSize: '0.55rem', letterSpacing: '0.18em',
        textTransform: 'uppercase', color: C.textMuted,
        borderBottom: `1px solid ${C.borderFaint}`, background: C.surface2,
      }}>
        actions
      </div>
      {items.map((it, i) => (
        <div
          key={i}
          onClick={() => { if (!it.disabled) { it.onClick(); onClose() } }}
          style={{
            padding: '6px 10px', fontSize: '0.72rem',
            cursor: it.disabled ? 'not-allowed' : 'pointer',
            color: it.disabled ? C.textMuted : it.danger ? C.red : C.textDim,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: i === items.length - 1 ? 'none' : `1px solid ${C.borderFaint}`,
            opacity: it.disabled ? 0.5 : 1,
          }}
          onMouseEnter={e => { if (!it.disabled) e.currentTarget.style.background = 'rgba(94,234,212,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <span>{it.label}</span>
          {it.hint && <span style={{ color: C.textMuted, fontSize: '0.6rem', marginLeft: 12 }}>{it.hint}</span>}
        </div>
      ))}
    </div>
  )
}

/* ======================================================================
   Highlight match
   ====================================================================== */

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(94,234,212,0.25)', color: C.cyan, padding: 0 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

/* ======================================================================
   FlatTreeRow — memoized single row renderer
   ====================================================================== */

interface FlatTreeRowProps {
  flatNode: FlatNode
  isSelected: boolean
  isFocused: boolean
  isMultiSelected: boolean
  isExpanded: boolean
  isLoading: boolean
  isFavorite: boolean
  isPinned: boolean
  searchQuery: string
  onToggle: (dn: string) => void
  onSelect: (configId: string, node: TreeNode, e: React.MouseEvent) => void
  onContextMenu: (configId: string, node: TreeNode, x: number, y: number) => void
  onConfigToggle?: (configId: string) => void
}

const FlatTreeRow = React.memo(function FlatTreeRow(props: FlatTreeRowProps) {
  const {
    flatNode, isSelected, isFocused, isMultiSelected,
    isExpanded, isLoading, isFavorite, isPinned, searchQuery,
    onToggle, onSelect, onContextMenu, onConfigToggle,
  } = props

  if (flatNode.kind === 'skeleton') {
    return (
      <div style={{
        height: ROW_H,
        display: 'flex', alignItems: 'center',
        paddingLeft: flatNode.depth * INDENT + 28,
      }}>
        <div style={{
          height: 10, width: `${40 + (flatNode.depth * 17) % 40}%`,
          background: 'rgba(94,234,212,0.08)', borderRadius: 2,
          animation: 'ldapSkeleton 1.2s ease infinite',
        }} />
      </div>
    )
  }

  if (flatNode.kind === 'empty') {
    return (
      <div style={{
        paddingLeft: flatNode.depth * INDENT + 30,
        height: ROW_H,
        display: 'flex', alignItems: 'center',
        fontSize: '0.65rem', color: C.textMuted, fontStyle: 'italic',
      }}>
        (empty)
      </div>
    )
  }

  if (flatNode.kind === 'config' && flatNode.configRef) {
    const cfg = flatNode.configRef
    return (
      <div
        onClick={() => onConfigToggle && onConfigToggle(cfg.id)}
        style={{
          height: ROW_H + 8,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 10px',
          cursor: 'pointer', userSelect: 'none',
          borderTop: `1px solid ${C.borderFaint}`,
          borderBottom: `1px solid ${C.borderFaint}`,
          background: C.surface2,
        }}
      >
        <Chevron expanded={isExpanded} size={11} />
        <DomainIcon size={13} color={cfg.active ? C.cyan : C.textMuted} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.72rem', fontWeight: 700,
            color: cfg.active ? C.cyan : C.textDim,
            letterSpacing: '0.02em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {deriveDomain(cfg.baseDn)}
          </div>
        </div>
        <span style={{
          flexShrink: 0, width: 6, height: 6, borderRadius: '50%',
          background: cfg.active ? C.green : C.textMuted,
          boxShadow: cfg.active ? `0 0 6px ${C.green}` : 'none',
        }} />
      </div>
    )
  }

  const node = flatNode.node
  const depth = flatNode.depth
  const isUser = node.type === 'user'
  const isOu = node.type === 'ou'
  const isGroup = node.type === 'group'
  const isExpandable = node.has_children && !isUser

  const otherKind = !isOu && !isUser && !isGroup ? classifyOther(node) : 'other'

  const handleClick = (e: React.MouseEvent) => {
    onSelect(flatNode.configId, node, e)
    if (isExpandable && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      onToggle(node.dn)
    }
  }

  const handleCtx = (e: React.MouseEvent) => {
    e.preventDefault()
    onContextMenu(flatNode.configId, node, e.clientX, e.clientY)
  }

  return (
    <div
      onClick={handleClick}
      onContextMenu={handleCtx}
      style={{
        display: 'flex', alignItems: 'center',
        cursor: 'pointer',
        height: ROW_H,
        position: 'relative',
        paddingRight: 8,
        background: isSelected
          ? 'linear-gradient(90deg, rgba(94,234,212,0.10) 0%, rgba(94,234,212,0.03) 100%)'
          : isMultiSelected
          ? 'rgba(170,136,255,0.10)'
          : isFocused
          ? 'rgba(94,234,212,0.04)'
          : 'transparent',
        borderLeft: isSelected ? `2px solid ${C.cyan}`
          : isMultiSelected ? `2px solid ${C.purple}`
          : isFocused ? `2px solid ${C.borderHover}`
          : '2px solid transparent',
        transition: 'background 0.08s ease',
      }}
    >
      {/* Tree guide lines for ancestor levels */}
      {flatNode.parentDepthFlags.map((hasLine, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${i * INDENT + 12}px`,
          top: 0, bottom: 0,
          width: 1,
          background: hasLine ? LINE_COLOR : 'transparent',
          pointerEvents: 'none',
        }} />
      ))}

      {depth > 0 && (
        <>
          <div style={{
            position: 'absolute',
            left: `${(depth - 1) * INDENT + 12}px`,
            top: 0,
            height: flatNode.isLast ? '50%' : '100%',
            width: 1,
            background: LINE_COLOR,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute',
            left: `${(depth - 1) * INDENT + 12}px`,
            top: '50%',
            width: INDENT - 4,
            height: 1,
            background: LINE_COLOR,
            pointerEvents: 'none',
          }} />
        </>
      )}

      <div style={{ width: depth * INDENT + (depth > 0 ? 10 : 4), flexShrink: 0 }} />

      <div style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isExpandable && (isLoading ? <Spinner size={10} /> : <Chevron expanded={isExpanded} />)}
      </div>

      <div style={{ marginLeft: 4, marginRight: 6, display: 'flex', alignItems: 'center' }}>
        {isOu && <OuFolderIcon expanded={isExpanded} />}
        {isUser && <UserIcon activated={node.is_activated} />}
        {isGroup && <GroupShieldIcon />}
        {!isOu && !isUser && !isGroup && otherKind === 'computer' && <ComputerIcon />}
        {!isOu && !isUser && !isGroup && otherKind === 'gpo' && <GPOIcon />}
        {!isOu && !isUser && !isGroup && otherKind === 'service' && <ServiceAccountIcon />}
        {!isOu && !isUser && !isGroup && otherKind === 'dns' && <DNSIcon />}
        {!isOu && !isUser && !isGroup && otherKind === 'container' && <ContainerIcon />}
        {!isOu && !isUser && !isGroup && otherKind === 'other' && <OtherIcon />}
      </div>

      <span style={{
        fontSize: '0.75rem',
        color: isSelected ? C.cyan
          : isOu ? C.ouGold
          : isUser ? (node.is_activated ? C.cyan : C.textDim)
          : isGroup ? C.purple
          : C.textDim,
        fontWeight: isOu ? 600 : isSelected ? 600 : 400,
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        <Highlight text={node.name} query={searchQuery} />
      </span>

      {isPinned && (
        <span style={{ marginLeft: 6, flexShrink: 0, display: 'flex' }}>
          <PinIcon size={10} color={C.cyanDim} />
        </span>
      )}
      {isFavorite && (
        <span style={{ marginLeft: 4, flexShrink: 0, display: 'flex' }}>
          <StarIcon filled size={10} />
        </span>
      )}
      {isUser && node.is_activated && (
        <span style={{
          marginLeft: 6, flexShrink: 0,
          width: 6, height: 6, borderRadius: '50%',
          background: C.green,
          boxShadow: `0 0 6px ${C.green}`,
        }} />
      )}
    </div>
  )
})

/* ======================================================================
   Detail panel pieces
   ====================================================================== */

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{
      border: `1px solid ${C.border}`,
      background: C.surface,
      padding: '0.75rem 0.875rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, height: 2, width: '100%',
        background: `linear-gradient(90deg, ${accent} 0%, transparent 100%)`,
        opacity: 0.6,
      }} />
      <div style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: C.textMuted }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accent, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        {value.toLocaleString()}
      </div>
    </div>
  )
}

function Section({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase',
        color: C.textMuted, marginBottom: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{label}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

function Mini({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{
      padding: '0.5rem 0.75rem',
      border: `1px solid ${C.border}`,
      background: C.surface,
      minWidth: 80,
    }}>
      <div style={{ fontSize: '0.55rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textMuted }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

function KV({ label, value, mono, color }: { label: string; value?: string; mono?: boolean; color?: string }) {
  return (
    <div style={{
      padding: '0.625rem 0.875rem',
      borderRight: `1px solid ${C.borderFaint}`,
      borderBottom: `1px solid ${C.borderFaint}`,
    }}>
      <div style={{ fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: C.textMuted }}>
        {label}
      </div>
      <div style={{
        fontSize: '0.8125rem', marginTop: 3,
        color: value ? (color ?? C.textDim) : C.textMuted,
        fontFamily: mono ? FONT : 'inherit',
        wordBreak: 'break-word',
      }}>
        {value || <span style={{ color: C.textMuted, fontStyle: 'italic' }}>—</span>}
      </div>
    </div>
  )
}

function ContainerDetail({ node, configId }: { node: TreeNode; configId: string }) {
  const isOu = node.type === 'ou'
  const isGroup = node.type === 'group'

  const { data: children, isFetching } = useQuery({
    queryKey: ['ldap-tree', configId, 'detail', node.dn],
    queryFn: () => apiClient.get<TreeNode[]>('/ldap/tree', { params: { dn: node.dn, configId } }).then(r => r.data),
    enabled: node.has_children,
    retry: false,
  })

  const childOuCount = children?.filter(c => c.type === 'ou').length ?? 0
  const childUserCount = children?.filter(c => c.type === 'user').length ?? 0
  const childGroupCount = children?.filter(c => c.type === 'group').length ?? 0

  return (
    <div style={{ padding: '1.75rem 2rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
        <div style={{
          width: 52, height: 52, flexShrink: 0,
          border: `1px solid ${isOu ? 'rgba(240,180,41,0.35)' : isGroup ? 'rgba(170,136,255,0.35)' : C.border}`,
          background: C.surface,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isOu ? <OuFolderIcon expanded size={24} />
            : isGroup ? <GroupShieldIcon size={22} />
            : <ContainerIcon size={22} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.625rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: C.textMuted }}>
            {isOu ? 'organizationalunit' : isGroup ? 'security_group' : 'container'}
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: isOu ? C.ouGold : isGroup ? C.purple : C.cyan, marginTop: 2, wordBreak: 'break-word' }}>
            {node.name}
          </div>
        </div>
      </div>

      <Section label="distinguished_name">
        <code style={{
          display: 'block', padding: '0.5rem 0.75rem',
          fontSize: '0.7rem', color: C.cyanDim, fontFamily: FONT,
          background: C.bg, border: `1px solid ${C.border}`,
          wordBreak: 'break-all', lineHeight: 1.6,
        }}>
          {node.dn}
        </code>
      </Section>

      <Section label="rdn">
        <div style={{ fontSize: '0.75rem', color: C.cyan }}>{node.rdn}</div>
      </Section>

      {node.has_children && (
        <Section label="direct_members">
          {isFetching ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem', color: C.textMuted }}>
              <Spinner size={11} /> enumerating...
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Mini label="OUs" value={childOuCount} accent={C.ouGold} />
              <Mini label="users" value={childUserCount} accent={C.cyan} />
              <Mini label="groups" value={childGroupCount} accent={C.purple} />
              <Mini label="total" value={children?.length ?? 0} accent={C.textDim} />
            </div>
          )}
        </Section>
      )}
    </div>
  )
}

function UserDetail({
  node, apps, isFavorite, isPinned, onActivate, onToggleFavorite, onTogglePin,
}: {
  node: TreeNode
  apps: Application[]
  isFavorite: boolean
  isPinned: boolean
  onActivate: () => void
  onToggleFavorite: () => void
  onTogglePin: () => void
}) {
  return (
    <div style={{ padding: '1.75rem 2rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <div style={{
          width: 64, height: 64, flexShrink: 0,
          border: `1px solid ${node.is_activated ? 'rgba(94,234,212,0.4)' : C.border}`,
          background: `linear-gradient(135deg, ${C.surface2} 0%, ${C.surface} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          boxShadow: node.is_activated ? '0 0 0 1px rgba(94,234,212,0.1), 0 0 24px rgba(94,234,212,0.08)' : 'none',
        }}>
          <UserIcon activated={node.is_activated} size={32} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.625rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: C.textMuted }}>
            user &middot; {node.is_activated ? 'activated' : 'not_activated'}
          </div>
          <div style={{
            fontSize: '1.35rem', fontWeight: 700,
            color: node.is_activated ? C.cyan : C.textDim,
            marginTop: 2, wordBreak: 'break-word',
          }}>
            {node.name}
          </div>
          {node.title && (
            <div style={{ fontSize: '0.75rem', color: C.textDim, marginTop: 2 }}>{node.title}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.625rem', letterSpacing: '0.12em', textTransform: 'uppercase',
              padding: '3px 8px',
              border: `1px solid ${node.is_activated ? C.green : C.border}`,
              color: node.is_activated ? C.green : C.textMuted,
              background: node.is_activated ? 'rgba(0,255,136,0.06)' : 'transparent',
            }}>
              {node.is_activated ? '● activated' : '○ inactive'}
            </span>
            {apps.length > 0 && (
              <button
                onClick={onActivate}
                disabled={!node.ldap_username}
                style={{
                  fontSize: '0.7rem', padding: '0.4rem 0.875rem',
                  border: `1px solid ${C.cyan}`,
                  background: C.cyan, color: '#000',
                  cursor: 'pointer', fontFamily: FONT, fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                + grant_app_access
              </button>
            )}
            <button onClick={onToggleFavorite} style={{
              fontSize: '0.65rem', padding: '0.35rem 0.6rem',
              border: `1px solid ${isFavorite ? C.amber : C.border}`,
              background: 'none', color: isFavorite ? C.amber : C.textDim,
              cursor: 'pointer', fontFamily: FONT,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <StarIcon filled={isFavorite} size={10} />
              {isFavorite ? 'favorited' : 'favorite'}
            </button>
            <button onClick={onTogglePin} style={{
              fontSize: '0.65rem', padding: '0.35rem 0.6rem',
              border: `1px solid ${isPinned ? C.cyan : C.border}`,
              background: 'none', color: isPinned ? C.cyan : C.textDim,
              cursor: 'pointer', fontFamily: FONT,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <PinIcon size={10} color={isPinned ? C.cyan : C.textDim} />
              {isPinned ? 'pinned' : 'pin'}
            </button>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 0,
        border: `1px solid ${C.border}`,
        background: C.surface,
        marginBottom: 18,
      }}>
        <KV label="uid" value={node.ldap_username} mono color={C.cyan} />
        <KV label="mail" value={node.email} />
        <KV label="title" value={node.title} />
        <KV label="cn" value={node.rdn} mono />
      </div>

      <Section label="distinguished_name">
        <code style={{
          display: 'block', padding: '0.5rem 0.75rem',
          fontSize: '0.7rem', color: C.cyanDim, fontFamily: FONT,
          background: C.bg, border: `1px solid ${C.border}`,
          wordBreak: 'break-all', lineHeight: 1.6,
        }}>
          {node.dn}
        </code>
      </Section>

      {node.groups && node.groups.length > 0 && (
        <Section label={`memberof (${node.groups.length})`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {node.groups.map(g => (
              <span
                key={g}
                title={g}
                style={{
                  fontSize: '0.7rem',
                  padding: '4px 10px',
                  border: '1px solid rgba(170,136,255,0.3)',
                  background: 'rgba(170,136,255,0.08)',
                  color: C.purple,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                <GroupShieldIcon size={11} />
                {g}
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function NoSelectionPanel({
  totals, configs,
  pinned, favorites, recent,
  onJump, onUnpin, onUnfavorite,
}: {
  totals: { ous: number; users: number; groups: number; servers: number; activeUsers: number }
  configs: LdapServerConfig[]
  pinned: PinnedRef[]
  favorites: PinnedRef[]
  recent: RecentRef[]
  onJump: (configId: string, node: TreeNode) => void
  onUnpin: (dn: string) => void
  onUnfavorite: (dn: string) => void
}) {
  return (
    <div style={{ padding: '2rem 2.25rem', maxWidth: 820 }}>
      <div style={{ fontSize: '0.625rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: C.textMuted }}>
        directory_overview
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: C.cyan, marginTop: 4, letterSpacing: '-0.01em' }}>
        Active Directory
      </div>
      <div style={{ fontSize: '0.75rem', color: C.textDim, marginTop: 6, maxWidth: 540, lineHeight: 1.6 }}>
        Browse organizational units, users and security groups across your federated LDAP servers.
        Press <kbd style={kbdStyle}>/</kbd> to focus search,
        <kbd style={kbdStyle}>↑</kbd>/<kbd style={kbdStyle}>↓</kbd> to navigate,
        <kbd style={kbdStyle}>→</kbd> to expand. Right-click any object for actions.
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10, marginTop: 24,
      }}>
        <Stat label="domains" value={totals.servers} accent={C.cyan} />
        <Stat label="org_units" value={totals.ous} accent={C.ouGold} />
        <Stat label="users" value={totals.users} accent={C.cyan} />
        <Stat label="groups" value={totals.groups} accent={C.purple} />
        <Stat label="activated" value={totals.activeUsers} accent={C.green} />
      </div>

      {pinned.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{
            fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase',
            color: C.cyanDim, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <PinIcon size={11} /> pinned ({pinned.length})
          </div>
          <div style={{ border: `1px solid ${C.border}`, background: C.surface }}>
            {pinned.map((p, i) => (
              <NodeRefRow
                key={p.node.dn}
                ref_={p}
                onJump={onJump}
                onRemove={() => onUnpin(p.node.dn)}
                last={i === pinned.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {favorites.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{
            fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase',
            color: C.amber, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <StarIcon filled size={11} /> favorites ({favorites.length})
          </div>
          <div style={{ border: `1px solid ${C.border}`, background: C.surface }}>
            {favorites.map((p, i) => (
              <NodeRefRow
                key={p.node.dn}
                ref_={p}
                onJump={onJump}
                onRemove={() => onUnfavorite(p.node.dn)}
                last={i === favorites.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{
            fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase',
            color: C.textMuted, marginBottom: 8,
          }}>
            recently viewed ({recent.length})
          </div>
          <div style={{ border: `1px solid ${C.border}`, background: C.surface }}>
            {recent.map((r, i) => (
              <NodeRefRow
                key={r.node.dn + r.ts}
                ref_={r}
                onJump={onJump}
                last={i === recent.length - 1}
                ts={r.ts}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{
        marginTop: 32,
        border: `1px solid ${C.border}`,
        background: C.surface,
      }}>
        <div style={{
          padding: '0.55rem 0.875rem',
          borderBottom: `1px solid ${C.border}`,
          fontSize: '0.625rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: C.textMuted,
          background: C.surface2,
        }}>
          configured_servers
        </div>
        <div>
          {configs.map((c, i) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '0.625rem 0.875rem',
              borderBottom: i === configs.length - 1 ? 'none' : `1px solid ${C.borderFaint}`,
              fontSize: '0.75rem',
            }}>
              <DomainIcon size={13} color={c.active ? C.cyan : C.textMuted} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: c.active ? C.cyan : C.textDim, fontWeight: 600 }}>{c.name}</div>
                <div style={{ color: C.textMuted, fontSize: '0.65rem', marginTop: 1 }}>{c.url} &middot; {c.baseDn}</div>
              </div>
              <span style={{
                fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase',
                padding: '2px 6px',
                border: `1px solid ${c.active ? C.cyan : C.border}`,
                color: c.active ? C.cyan : C.textMuted,
              }}>
                {c.active ? 'active' : 'disabled'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 5px',
  margin: '0 3px',
  fontSize: '0.65rem',
  fontFamily: FONT,
  border: `1px solid ${C.border}`,
  background: C.surface2,
  color: C.cyan,
  borderRadius: 2,
}

function NodeRefRow({
  ref_, onJump, onRemove, last, ts,
}: {
  ref_: PinnedRef | RecentRef
  onJump: (configId: string, node: TreeNode) => void
  onRemove?: () => void
  last: boolean
  ts?: number
}) {
  const node = ref_.node
  const isOu = node.type === 'ou'
  const isUser = node.type === 'user'
  const isGroup = node.type === 'group'
  return (
    <div
      onClick={() => onJump(ref_.configId, node)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0.5rem 0.875rem',
        borderBottom: last ? 'none' : `1px solid ${C.borderFaint}`,
        fontSize: '0.72rem', cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(94,234,212,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {isOu && <OuFolderIcon expanded={false} size={12} />}
        {isUser && <UserIcon activated={node.is_activated} size={12} />}
        {isGroup && <GroupShieldIcon size={12} />}
        {!isOu && !isUser && !isGroup && <OtherIcon size={12} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: isOu ? C.ouGold : isGroup ? C.purple : isUser ? (node.is_activated ? C.cyan : C.textDim) : C.textDim,
          fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {node.name}
        </div>
        <div style={{
          color: C.textMuted, fontSize: '0.6rem', marginTop: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {node.dn}
        </div>
      </div>
      {ts !== undefined && (
        <span style={{ color: C.textMuted, fontSize: '0.6rem', flexShrink: 0 }}>
          {relTime(ts)}
        </span>
      )}
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.textMuted, fontSize: '0.85rem', padding: '0 4px',
            fontFamily: FONT,
          }}
          title="remove"
        >×</button>
      )}
    </div>
  )
}

function relTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / 86_400_000)}d`
}

/* ======================================================================
   Breadcrumb
   ====================================================================== */

function Breadcrumb({
  selection, configs, onJump, expandedDns, childMap,
}: {
  selection: Selection
  configs: LdapServerConfig[]
  onJump: (configId: string, node: TreeNode) => void
  expandedDns: Set<string>
  childMap: Map<string, TreeNode[]>
}) {
  const cfg = configs.find(c => c.id === selection.configId)
  const domain = cfg ? deriveDomain(cfg.baseDn) : ''
  const ancestors = useMemo(() => {
    const list = dnAncestors(selection.node.dn)
    // limit to within baseDn (approximate by keeping ones longer than the baseDn excluded)
    if (cfg) {
      const baseLower = cfg.baseDn.toLowerCase()
      return list.filter(a => a.toLowerCase() !== baseLower && a.toLowerCase().endsWith(baseLower))
    }
    return list
  }, [selection.node.dn, cfg])

  // resolve nodes for ancestors from childMap
  const allNodes = useMemo(() => {
    const m = new Map<string, TreeNode>()
    childMap.forEach(arr => arr.forEach(n => m.set(n.dn, n)))
    return m
  }, [childMap])

  // ancestors in order from top → near
  const ordered = [...ancestors].reverse()

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0.4rem 1rem',
      fontSize: '0.7rem',
      color: C.textDim,
      borderBottom: `1px solid ${C.borderFaint}`,
      background: C.surface,
      flexShrink: 0,
      minHeight: 32,
      overflowX: 'auto',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ color: C.cyanDim, fontWeight: 600 }}>{domain}</span>
      {ordered.map(dn => {
        const n = allNodes.get(dn)
        const label = n ? n.name : dn.split(',')[0]
        const clickable = !!n
        return (
          <React.Fragment key={dn}>
            <span style={{ color: C.textMuted }}>/</span>
            <span
              onClick={() => { if (n) onJump(selection.configId, n) }}
              style={{
                cursor: clickable ? 'pointer' : 'default',
                color: clickable ? C.textDim : C.textMuted,
                fontWeight: 500,
              }}
              onMouseEnter={e => { if (clickable) e.currentTarget.style.color = C.cyan }}
              onMouseLeave={e => { if (clickable) e.currentTarget.style.color = C.textDim }}
            >
              {label}
            </span>
          </React.Fragment>
        )
      })}
      <span style={{ color: C.textMuted }}>/</span>
      <span style={{ color: C.cyan, fontWeight: 700 }}>{selection.node.name}</span>
      {/* unused expandedDns kept for future highlighting */}
      <span style={{ display: 'none' }}>{expandedDns.size}</span>
    </div>
  )
}

/* ======================================================================
   AttributePicker — custom dropdown to replace the broken native <select>.
   Renders a styled trigger; on click, a portal-less floating panel
   appears with a search input and grouped options.
   ====================================================================== */

interface AttrOption { value: string; label: string; sample?: string }

function AttributePicker({
  value, onChange, quickOptions, schema,
}: {
  value: string
  onChange: (v: string) => void
  quickOptions: AttrOption[]
  schema: Record<string, string> | undefined
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => searchRef.current?.focus())
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const HIDDEN_ATTRS = new Set([
    'name', 'cn', 'uid', 'sAMAccountName', 'mail', 'title',
    'objectClass', 'objectGUID', 'objectSid', 'uSNCreated', 'uSNChanged',
    'whenCreated', 'whenChanged', 'dSCorePropagationData', 'distinguishedName',
  ])
  const schemaOpts: AttrOption[] = useMemo(() => {
    if (!schema) return []
    return Object.entries(schema)
      .filter(([k]) => !HIDDEN_ATTRS.has(k))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ value: k, label: k, sample: v === '[binary]' ? undefined : v }))
  }, [schema])

  const ql = q.trim().toLowerCase()
  const filterFn = (o: AttrOption) =>
    !ql || o.label.toLowerCase().includes(ql) || (o.sample?.toLowerCase().includes(ql) ?? false)
  const quickFiltered = quickOptions.filter(filterFn)
  const schemaFiltered = schemaOpts.filter(filterFn)
  const flatList = [...quickFiltered, ...schemaFiltered]

  // Active option helper
  const selected = quickOptions.concat(schemaOpts).find(o => o.value === value)
  const triggerLabel = selected?.label ?? value

  useEffect(() => { if (open) setActiveIdx(0) }, [open, ql])

  return (
    <div ref={wrapRef} style={{ position: 'relative', minWidth: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={selected?.sample ? `sample: ${selected.sample}` : selected?.label}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px 4px 9px',
          background: value !== 'all' ? 'rgba(94,234,212,0.08)' : C.surface2,
          border: `1px solid ${open ? C.borderHover : value !== 'all' ? 'rgba(94,234,212,0.35)' : C.border}`,
          color: value !== 'all' ? C.cyan : C.textDim,
          fontFamily: FONT, fontSize: '0.7rem',
          cursor: 'pointer', borderRadius: 4,
          transition: 'all 0.12s ease', maxWidth: 200,
        }}
      >
        <span style={{ fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textMuted }}>attr</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{triggerLabel}</span>
        <svg width="9" height="9" viewBox="0 0 10 10" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.15s' }}>
          <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 250,
            width: 280, maxHeight: 360,
            background: C.surface,
            border: `1px solid ${C.borderHover}`,
            borderRadius: 6,
            boxShadow: '0 12px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)',
            display: 'flex', flexDirection: 'column',
            animation: 'ldapFadeIn 0.12s ease',
          }}
        >
          {/* search */}
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.borderFaint}` }}>
            <input
              ref={searchRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && flatList[activeIdx]) {
                  onChange(flatList[activeIdx].value); setOpen(false)
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault(); setActiveIdx(i => Math.min(flatList.length - 1, i + 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1))
                }
              }}
              placeholder={`filter ${schemaOpts.length} attributes...`}
              style={{
                width: '100%', padding: '5px 8px',
                background: C.bg, border: `1px solid ${C.borderFaint}`,
                color: C.text, fontFamily: FONT, fontSize: '0.72rem',
                outline: 'none', borderRadius: 3,
              }}
            />
          </div>

          {/* list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {quickFiltered.length > 0 && (
              <>
                <div style={{ padding: '6px 12px 3px', fontSize: '0.55rem', color: C.textMuted, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                  Quick
                </div>
                {quickFiltered.map((o, i) => (
                  <AttrRow key={o.value} opt={o} active={value === o.value} hover={activeIdx === i}
                    onPick={() => { onChange(o.value); setOpen(false) }}
                    onHover={() => setActiveIdx(i)}
                  />
                ))}
              </>
            )}
            {schemaFiltered.length > 0 && (
              <>
                <div style={{ padding: '6px 12px 3px', fontSize: '0.55rem', color: C.textMuted, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                  Server Schema · {schemaFiltered.length}
                </div>
                {schemaFiltered.map((o, i) => (
                  <AttrRow key={o.value} opt={o} active={value === o.value}
                    hover={activeIdx === (quickFiltered.length + i)}
                    onPick={() => { onChange(o.value); setOpen(false) }}
                    onHover={() => setActiveIdx(quickFiltered.length + i)}
                  />
                ))}
              </>
            )}
            {flatList.length === 0 && (
              <div style={{ padding: '14px 12px', fontSize: '0.7rem', color: C.textMuted, textAlign: 'center' }}>
                no matches
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AttrRow({ opt, active, hover, onPick, onHover }: {
  opt: AttrOption; active: boolean; hover: boolean
  onPick: () => void; onHover: () => void
}) {
  return (
    <div
      onClick={onPick}
      onMouseEnter={onHover}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 12px',
        background: hover ? 'rgba(94,234,212,0.06)' : active ? 'rgba(94,234,212,0.04)' : 'transparent',
        borderLeft: `2px solid ${active ? C.cyan : 'transparent'}`,
        cursor: 'pointer', fontSize: '0.72rem',
        transition: 'background 0.08s',
      }}
    >
      <span style={{
        color: active ? C.cyan : C.text,
        fontWeight: active ? 600 : 400,
        fontFamily: FONT,
        flexShrink: 0,
      }}>
        {opt.label}
      </span>
      {opt.sample && (
        <span style={{
          color: C.textMuted, fontSize: '0.62rem',
          marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 130,
        }}>
          {opt.sample}
        </span>
      )}
    </div>
  )
}

/* ======================================================================
   Server-side LDAP search results
   ====================================================================== */

function ServerSearchResults({
  query, attr, hits, loading, onPick,
}: {
  query: string
  attr: string
  hits: LdapSearchHit[]
  loading: boolean
  onPick: (hit: LdapSearchHit) => void
}) {
  if (!query.trim()) {
    return (
      <div style={{ padding: '1.5rem 1rem', fontSize: '0.7rem', color: C.textMuted, lineHeight: 1.7 }}>
        <div style={{ color: C.amber, marginBottom: 6 }}>● LDAP server search</div>
        Type a query to search the directory server directly.
        {attr !== 'all' && (
          <div style={{ marginTop: 6, color: C.textDim }}>
            Filtering by <code style={{ color: C.cyanDim }}>{attr === 'name' ? 'cn' : attr === 'username' ? 'uid/sAMAccountName' : attr === 'email' ? 'mail' : attr}</code>
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: '0.62rem', color: C.textMuted }}>
          Tip: pick an attribute above to scope the LDAP filter (e.g. <code style={{ color: C.cyanDim }}>department</code>).
        </div>
      </div>
    )
  }
  if (loading) {
    return (
      <div style={{ padding: '1.5rem 1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Spinner size={12} color={C.amber} />
        <span style={{ fontSize: '0.7rem', color: C.textMuted }}>querying directory for "{query}"...</span>
      </div>
    )
  }
  if (hits.length === 0) {
    return (
      <div style={{ padding: '1.5rem 1rem', fontSize: '0.7rem', color: C.textMuted }}>
        no LDAP matches for "{query}"
      </div>
    )
  }
  return (
    <div>
      <div style={{
        padding: '0.4rem 0.75rem',
        background: 'rgba(255,136,0,0.06)',
        borderBottom: `1px solid ${C.borderFaint}`,
        fontSize: '0.62rem', color: C.amber, letterSpacing: '0.1em', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>LDAP search · {hits.length} {hits.length === 1 ? 'result' : 'results'}</span>
        <span style={{ color: C.textMuted, letterSpacing: '0.04em', textTransform: 'none' }}>
          {attr !== 'all' ? `attr=${attr}` : 'all attrs'}
        </span>
      </div>
      <div>
        {hits.map(hit => (
          <div
            key={hit.ldap_username}
            onClick={() => onPick(hit)}
            style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              padding: '0.5rem 0.75rem',
              borderBottom: `1px solid ${C.borderFaint}`,
              fontSize: '0.72rem', cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(94,234,212,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserIcon activated={hit.is_activated} size={12} />
              <span style={{ color: hit.is_activated ? C.cyan : C.textDim, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hit.display_name || hit.ldap_username}
              </span>
              {hit.is_activated && (
                <span style={{ fontSize: '0.55rem', color: C.green, letterSpacing: '0.06em' }}>● ACTIVE</span>
              )}
            </div>
            <div style={{ fontSize: '0.62rem', color: C.textMuted, paddingLeft: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ color: C.textDim }}>{hit.ldap_username}</span>
              {hit.email && <> · {hit.email}</>}
              {hit.title && <> · {hit.title}</>}
            </div>
            {(hit.ou || hit.ldap_server_name) && (
              <div style={{ fontSize: '0.58rem', color: C.textMuted, paddingLeft: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hit.ldap_server_name && <span style={{ color: C.cyanDim }}>[{hit.ldap_server_name}]</span>}
                {hit.ou && <> {hit.ou}</>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ======================================================================
   Per-config root query hook (one query per active config)
   ====================================================================== */

function useConfigRoots(config: LdapServerConfig, enabled: boolean) {
  return useQuery({
    queryKey: ['ldap-tree', config.id, 'root'],
    queryFn: () => apiClient.get<TreeNode[]>('/ldap/tree', { params: { configId: config.id } }).then(r => r.data),
    retry: false,
    enabled,
  })
}

/* ======================================================================
   Main page
   ====================================================================== */

export default function LdapTreePage() {
  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ['ldap-configs'],
    queryFn: settingsApi.ldap.list,
  })

  const { data: apps = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => appsApi.list(),
  })

  const activeConfigs = useMemo(() => configs.filter(c => c.active), [configs])

  const [state, dispatch] = useReducer(treeReducer, undefined, initState)
  const [showActivate, setShowActivate] = useState(false)
  const [showBulkGrant, setShowBulkGrant] = useState(false)
  const [stamp, setStamp] = useState(nowStamp())
  const [collapsedConfigs, setCollapsedConfigs] = useState<Set<string>>(new Set())
  const [focusedDn, setFocusedDn] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; configId: string; node: TreeNode } | null>(null)
  const [lastClickedDn, setLastClickedDn] = useState<string | null>(null)

  // Filter bar state
  const [filterType, setFilterType] = useState<'all' | 'ou' | 'user' | 'group'>('all')
  const [filterActivated, setFilterActivated] = useState<'all' | 'active' | 'inactive'>('all')
  // searchAttr 'all' = match across all loaded fields; otherwise must match the LDAP attribute name
  // 'name' | 'username' | 'email' | 'title' map to the TreeNode fields; any other value is a raw LDAP attribute name (server-side only)
  const [searchAttr, setSearchAttr] = useState<string>('all')
  // 'tree' = filter what's already loaded; 'server' = call /ldap/users for a directory-wide LDAP search
  const [searchScope, setSearchScope] = useState<'tree' | 'server'>('tree')

  // Panel width (resizable)
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem(LS_PANEL_WIDTH)
    if (saved) {
      const n = parseInt(saved, 10)
      if (!Number.isNaN(n)) return Math.max(200, Math.min(600, n))
    }
    return 340
  })
  const [isDragging, setIsDragging] = useState(false)

  // Hydrate persisted state
  useEffect(() => {
    const fav = readLS<string[]>(LS_FAVORITES, [])
    const pinnedArr = readLS<Array<[string, PinnedRef]>>(LS_PINNED, [])
    const recent = readLS<RecentRef[]>(LS_RECENT, [])
    dispatch({
      type: 'HYDRATE_PERSIST',
      favorites: new Set(fav),
      pinned: new Map(pinnedArr),
      recent,
    })
  }, [])

  // Persist
  useEffect(() => {
    writeLS(LS_FAVORITES, Array.from(state.favorites))
  }, [state.favorites])
  useEffect(() => {
    writeLS(LS_PINNED, Array.from(state.pinnedNodes.entries()))
  }, [state.pinnedNodes])
  useEffect(() => {
    writeLS(LS_RECENT, state.recentNodes)
  }, [state.recentNodes])

  // Debounce search
  const debounceTimer = useRef<number | null>(null)
  useEffect(() => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current)
    debounceTimer.current = window.setTimeout(() => {
      dispatch({ type: 'SET_DEBOUNCED_SEARCH', query: state.searchQuery })
    }, 220)
    return () => { if (debounceTimer.current) window.clearTimeout(debounceTimer.current) }
  }, [state.searchQuery])

  // Live timestamp
  useEffect(() => {
    const t = setInterval(() => setStamp(nowStamp()), 1000)
    return () => clearInterval(t)
  }, [])

  // Resize drag handlers
  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      const w = Math.max(200, Math.min(600, e.clientX))
      setPanelWidth(w)
    }
    const onUp = () => {
      setIsDragging(false)
      writeLS(LS_PANEL_WIDTH, panelWidth)
      try { localStorage.setItem(LS_PANEL_WIDTH, String(panelWidth)) } catch { /* ignore */ }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging, panelWidth])

  // Per-config root queries
  const rootQueries = activeConfigs.map(cfg => {
    /* eslint-disable react-hooks/rules-of-hooks */
    return useConfigRoots(cfg, !collapsedConfigs.has(cfg.id))
    /* eslint-enable react-hooks/rules-of-hooks */
  })

  // Roots map
  const rootsMap = useMemo(() => {
    const m = new Map<string, { roots: TreeNode[]; isLoading: boolean; error: unknown }>()
    activeConfigs.forEach((cfg, i) => {
      const q = rootQueries[i]
      m.set(cfg.id, { roots: q.data ?? [], isLoading: q.isLoading, error: q.error })
    })
    return m
  }, [activeConfigs, rootQueries])

  // Real LDAP schema attributes for the first active config (drives the searchable-attribute dropdown)
  const primaryConfigId = activeConfigs[0]?.id
  const { data: serverAttrs } = useQuery({
    queryKey: ['ldap-attrs', primaryConfigId],
    queryFn: () => ldapApi.attributesById(primaryConfigId!),
    enabled: !!primaryConfigId,
    staleTime: 60_000,
    retry: false,
  })

  // Server-side LDAP search (only enabled when scope=server and there is a query)
  const { data: serverHits = [], isFetching: serverSearching } = useQuery({
    queryKey: ['ldap-server-search', state.debouncedSearch, searchAttr],
    queryFn: () => {
      // For non-default attribute, encode an LDAP filter clause in the search param
      const q = searchAttr === 'all' || ['name', 'username', 'email', 'title'].includes(searchAttr)
        ? state.debouncedSearch
        : `${searchAttr}=${state.debouncedSearch}`
      return ldapApi.getUsers(undefined, q)
    },
    enabled: searchScope === 'server' && !!state.debouncedSearch.trim(),
    staleTime: 5_000,
  })

  // Counts derived from queries (for status bar / summary)
  const counts = useMemo(() => {
    const map: Record<string, { ous: number; users: number; groups: number; status: 'ok' | 'error' | 'loading' }> = {}
    activeConfigs.forEach((cfg, i) => {
      const q = rootQueries[i]
      const roots = q.data ?? []
      map[cfg.id] = {
        ous: roots.filter(n => n.type === 'ou').length,
        users: roots.filter(n => n.type === 'user').length,
        groups: roots.filter(n => n.type === 'group').length,
        status: q.isLoading ? 'loading' : q.error ? 'error' : 'ok',
      }
    })
    return map
  }, [activeConfigs, rootQueries])

  const totals = useMemo(() => {
    const arr = Object.values(counts)
    return {
      ous: arr.reduce((a, b) => a + b.ous, 0),
      users: arr.reduce((a, b) => a + b.users, 0),
      groups: arr.reduce((a, b) => a + b.groups, 0),
      servers: activeConfigs.length,
      activeUsers: 0,
    }
  }, [counts, activeConfigs.length])

  // Load children
  const loadChildren = useCallback(async (configId: string, dn: string) => {
    if (state.childMap.has(dn) || state.loadingDns.has(dn)) return
    dispatch({ type: 'SET_LOADING', dn, loading: true })
    try {
      const res = await apiClient.get<TreeNode[]>('/ldap/tree', { params: { dn, configId } })
      dispatch({ type: 'SET_CHILDREN', dn, children: res.data })
    } catch {
      dispatch({ type: 'SET_CHILDREN', dn, children: [] })
    } finally {
      dispatch({ type: 'SET_LOADING', dn, loading: false })
    }
  }, [state.childMap, state.loadingDns])

  // Build flat node list
  const flatNodes = useMemo<FlatNode[]>(() => {
    const out: FlatNode[] = []
    const search = state.debouncedSearch.trim().toLowerCase()

    activeConfigs.forEach(cfg => {
      const collapsed = collapsedConfigs.has(cfg.id)
      const cfgNode: FlatNode = {
        node: { dn: '__cfg:' + cfg.id, rdn: '', type: 'other', name: cfg.name, has_children: true, is_activated: false },
        depth: 0,
        configId: cfg.id,
        isLast: false,
        parentDepthFlags: [],
        kind: 'config',
        configRef: cfg,
      }
      out.push(cfgNode)
      if (collapsed) return

      const rootInfo = rootsMap.get(cfg.id)
      if (!rootInfo) return
      const { roots, isLoading } = rootInfo
      if (isLoading) {
        for (let i = 0; i < 3; i++) {
          out.push({
            node: { dn: `__skel:${cfg.id}:${i}`, rdn: '', type: 'other', name: '', has_children: false, is_activated: false },
            depth: 0,
            configId: cfg.id,
            isLast: i === 2,
            parentDepthFlags: [],
            kind: 'skeleton',
          })
        }
        return
      }
      if (roots.length === 0) return

      // recursive flatten via stack to support visible state
      type Frame = { node: TreeNode; depth: number; isLast: boolean; flags: boolean[] }
      const stack: Frame[] = []
      // push roots reversed so first comes out on top
      for (let i = roots.length - 1; i >= 0; i--) {
        stack.push({ node: roots[i], depth: 0, isLast: i === roots.length - 1, flags: [] })
      }
      // Use iterative DFS (in-order: pop, push children if expanded)
      const visited = new Set<string>()
      const tempOut: FlatNode[] = []
      const walk = (start: Frame) => {
        const localStack: Frame[] = [start]
        while (localStack.length > 0) {
          const frame = localStack.pop()!
          if (visited.has(frame.node.dn)) continue
          visited.add(frame.node.dn)
          tempOut.push({
            node: frame.node,
            depth: frame.depth,
            configId: cfg.id,
            isLast: frame.isLast,
            parentDepthFlags: frame.flags,
            kind: 'node',
          })
          if (state.expandedDns.has(frame.node.dn)) {
            const children = state.childMap.get(frame.node.dn)
            if (children === undefined && state.loadingDns.has(frame.node.dn)) {
              // skeletons
              for (let s = 0; s < 3; s++) {
                tempOut.push({
                  node: { dn: `__skel:${frame.node.dn}:${s}`, rdn: '', type: 'other', name: '', has_children: false, is_activated: false },
                  depth: frame.depth + 1,
                  configId: cfg.id,
                  isLast: s === 2,
                  parentDepthFlags: [...frame.flags, !frame.isLast],
                  kind: 'skeleton',
                })
              }
            } else if (children && children.length === 0) {
              tempOut.push({
                node: { dn: `__empty:${frame.node.dn}`, rdn: '', type: 'other', name: '', has_children: false, is_activated: false },
                depth: frame.depth + 1,
                configId: cfg.id,
                isLast: true,
                parentDepthFlags: [...frame.flags, !frame.isLast],
                kind: 'empty',
              })
            } else if (children) {
              const childFlags = [...frame.flags, !frame.isLast]
              for (let i = children.length - 1; i >= 0; i--) {
                localStack.push({
                  node: children[i],
                  depth: frame.depth + 1,
                  isLast: i === children.length - 1,
                  flags: childFlags,
                })
              }
            }
          }
        }
      }
      // Process roots in original order using outer stack
      const orderedRoots: Frame[] = []
      for (let i = 0; i < roots.length; i++) {
        orderedRoots.push({ node: roots[i], depth: 0, isLast: i === roots.length - 1, flags: [] })
      }
      orderedRoots.forEach(f => walk(f))

      // Apply search + attribute + type + activation filters
      const hasFilter = search || filterType !== 'all' || filterActivated !== 'all'
      if (hasFilter) {
        const matchSet = new Set<string>()
        tempOut.forEach(fn => {
          if (fn.kind !== 'node') return
          const n = fn.node

          // type filter: ancestors (non-matching types) always pass through
          const matchesType = filterType === 'all' || n.type === filterType

          // activation filter applies only to users
          const matchesActivation = n.type !== 'user' || filterActivated === 'all'
            || (filterActivated === 'active' && n.is_activated)
            || (filterActivated === 'inactive' && !n.is_activated)

          // attribute-scoped text search
          // tree mode only carries name/uid/mail/title; arbitrary LDAP attrs fall back to all-fields
          // (use server scope to actually filter by an attribute not exposed on the tree node)
          let matchesSearch = true
          if (search) {
            if (searchAttr === 'name') {
              matchesSearch = n.name.toLowerCase().includes(search)
            } else if (searchAttr === 'username') {
              matchesSearch = (n.ldap_username?.toLowerCase().includes(search) ?? false)
            } else if (searchAttr === 'email') {
              matchesSearch = (n.email?.toLowerCase().includes(search) ?? false)
            } else if (searchAttr === 'title') {
              matchesSearch = (n.title?.toLowerCase().includes(search) ?? false)
            } else {
              // 'all' or any unknown server-schema attribute → match across all locally-known fields
              matchesSearch = n.name.toLowerCase().includes(search) ||
                (n.ldap_username?.toLowerCase().includes(search) ?? false) ||
                (n.email?.toLowerCase().includes(search) ?? false) ||
                (n.title?.toLowerCase().includes(search) ?? false)
            }
          }

          if (matchesType && matchesActivation && matchesSearch) {
            matchSet.add(n.dn)
            dnAncestors(n.dn).forEach(a => matchSet.add(a))
          }
        })
        const keptDns = new Set<string>()
        tempOut.forEach(fn => {
          if (fn.kind === 'node' && matchSet.has(fn.node.dn)) keptDns.add(fn.node.dn)
        })
        const filtered = tempOut.filter(fn => {
          if (fn.kind === 'node') return keptDns.has(fn.node.dn)
          if (fn.kind === 'skeleton') {
            const m = fn.node.dn.match(/^__skel:(.*):\d+$/)
            return m ? keptDns.has(m[1]) : false
          }
          if (fn.kind === 'empty') {
            const m = fn.node.dn.match(/^__empty:(.*)$/)
            return m ? keptDns.has(m[1]) : false
          }
          return true
        })
        out.push(...filtered)
      } else {
        out.push(...tempOut)
      }
    })

    return out
  }, [activeConfigs, rootsMap, state.expandedDns, state.childMap, state.loadingDns, state.debouncedSearch, collapsedConfigs, filterType, filterActivated, searchAttr])

  // Auto-expand search matches: trigger lazy loads for ancestors of matches when search active
  useEffect(() => {
    const search = state.debouncedSearch.trim().toLowerCase()
    if (!search) return
    // For each currently visible match, ensure ancestors are expanded.
    // Limited to nodes already loaded in childMap to avoid storms.
    const matchedDns: string[] = []
    state.childMap.forEach(arr => {
      arr.forEach(n => {
        if (
          n.name.toLowerCase().includes(search) ||
          (n.ldap_username?.toLowerCase().includes(search) ?? false) ||
          (n.email?.toLowerCase().includes(search) ?? false)
        ) {
          matchedDns.push(n.dn)
        }
      })
    })
    matchedDns.forEach(dn => {
      const ancs = dnAncestors(dn)
      ancs.forEach(a => {
        if (state.childMap.has(a) && !state.expandedDns.has(a)) {
          dispatch({ type: 'EXPAND', dn: a })
        }
      })
    })
  }, [state.debouncedSearch, state.childMap, state.expandedDns])

  // Selection handler
  const handleSelect = useCallback((configId: string, node: TreeNode, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      dispatch({ type: 'TOGGLE_MULTISELECT', dn: node.dn })
      setLastClickedDn(node.dn)
      return
    }
    if (e.shiftKey && lastClickedDn) {
      // Range select within current flatNodes
      const dns = flatNodes.filter(f => f.kind === 'node').map(f => f.node.dn)
      const a = dns.indexOf(lastClickedDn)
      const b = dns.indexOf(node.dn)
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a]
        const next = new Set<string>(state.multiSelected)
        for (let i = lo; i <= hi; i++) next.add(dns[i])
        dispatch({ type: 'SET_MULTISELECT', dns: next })
        return
      }
    }
    dispatch({ type: 'SELECT', configId, node })
    dispatch({ type: 'CLEAR_MULTISELECT' })
    setLastClickedDn(node.dn)
    setFocusedDn(node.dn)
    if (node.type !== 'ou' || !node.has_children) {
      dispatch({ type: 'ADD_RECENT', node, configId })
    } else {
      dispatch({ type: 'ADD_RECENT', node, configId })
    }
  }, [flatNodes, lastClickedDn, state.multiSelected])

  // Combined toggle that also lazy-loads
  const handleToggleWithLoad = useCallback((dn: string) => {
    // Find configId for this dn from flat nodes
    const fn = flatNodes.find(f => f.kind === 'node' && f.node.dn === dn)
    if (!fn) return
    if (!state.expandedDns.has(dn) && !state.childMap.has(dn)) {
      loadChildren(fn.configId, dn)
    }
    dispatch({ type: 'TOGGLE_EXPAND', dn })
  }, [flatNodes, state.expandedDns, state.childMap, loadChildren])

  // Context menu
  const handleContextMenu = useCallback((configId: string, node: TreeNode, x: number, y: number) => {
    setContextMenu({ x, y, configId, node })
  }, [])

  const handleConfigToggle = useCallback((configId: string) => {
    setCollapsedConfigs(prev => {
      const n = new Set(prev)
      if (n.has(configId)) n.delete(configId)
      else n.add(configId)
      return n
    })
  }, [])

  // Virtualization
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const updateHeight = () => setContainerHeight(el.clientHeight)
    updateHeight()
    const onScroll = () => setScrollTop(el.scrollTop)
    el.addEventListener('scroll', onScroll)
    const ro = new ResizeObserver(updateHeight)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [])

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const endIdx = Math.min(flatNodes.length, Math.ceil((scrollTop + containerHeight) / ROW_H) + OVERSCAN)

  const visibleSlice = useMemo(() => flatNodes.slice(startIdx, endIdx), [flatNodes, startIdx, endIdx])

  // Selected node lookups
  const selectedConfig = state.selection ? activeConfigs.find(c => c.id === state.selection!.configId) ?? null : null
  const selectedNode = state.selection?.node ?? null
  const selectedDn = state.selection?.node.dn ?? null

  // Multi-selected user nodes
  const multiSelectedUsers = useMemo<TreeNode[]>(() => {
    if (state.multiSelected.size === 0) return []
    const lookup = new Map<string, TreeNode>()
    flatNodes.forEach(fn => {
      if (fn.kind === 'node') lookup.set(fn.node.dn, fn.node)
    })
    const out: TreeNode[] = []
    state.multiSelected.forEach(dn => {
      const n = lookup.get(dn)
      if (n && n.type === 'user') out.push(n)
    })
    return out
  }, [state.multiSelected, flatNodes])

  // Search input ref for "/" shortcut
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!flatNodes.length) return
    const target = e.target as HTMLElement
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
      if (e.key === 'Escape') {
        (target as HTMLElement).blur()
      }
      return
    }
    if (e.key === '/') {
      e.preventDefault()
      searchInputRef.current?.focus()
      return
    }

    const visible = flatNodes.filter(f => f.kind === 'node' || f.kind === 'config')
    const currentIdx = focusedDn
      ? visible.findIndex(f => (f.kind === 'node' ? f.node.dn : '__cfg:' + f.configId) === focusedDn)
      : -1

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = visible[Math.min(visible.length - 1, currentIdx + 1)]
      if (next) {
        const dn = next.kind === 'node' ? next.node.dn : '__cfg:' + next.configId
        setFocusedDn(dn)
        // Scroll into view
        const flatIdx = flatNodes.indexOf(next)
        const el = scrollRef.current
        if (el && flatIdx >= 0) {
          const top = flatIdx * ROW_H
          if (top + ROW_H > el.scrollTop + el.clientHeight) {
            el.scrollTop = top - el.clientHeight + ROW_H * 2
          }
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = visible[Math.max(0, currentIdx - 1)]
      if (next) {
        const dn = next.kind === 'node' ? next.node.dn : '__cfg:' + next.configId
        setFocusedDn(dn)
        const flatIdx = flatNodes.indexOf(next)
        const el = scrollRef.current
        if (el && flatIdx >= 0) {
          const top = flatIdx * ROW_H
          if (top < el.scrollTop) el.scrollTop = top - ROW_H
        }
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (focusedDn && currentIdx >= 0) {
        const cur = visible[currentIdx]
        if (cur.kind === 'node' && cur.node.has_children && cur.node.type !== 'user') {
          if (!state.expandedDns.has(cur.node.dn)) {
            handleToggleWithLoad(cur.node.dn)
          }
        }
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (focusedDn && currentIdx >= 0) {
        const cur = visible[currentIdx]
        if (cur.kind === 'node' && state.expandedDns.has(cur.node.dn)) {
          dispatch({ type: 'COLLAPSE', dn: cur.node.dn })
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (focusedDn && currentIdx >= 0) {
        const cur = visible[currentIdx]
        if (cur.kind === 'node') {
          dispatch({ type: 'SELECT', configId: cur.configId, node: cur.node })
          dispatch({ type: 'ADD_RECENT', node: cur.node, configId: cur.configId })
        }
      }
    } else if (e.key === 'Escape') {
      dispatch({ type: 'CLEAR_SELECT' })
      dispatch({ type: 'CLEAR_MULTISELECT' })
    }
  }, [flatNodes, focusedDn, state.expandedDns, handleToggleWithLoad])

  // Jump to node (from breadcrumb / pinned / favorites / recents)
  const handleJump = useCallback((configId: string, node: TreeNode) => {
    dispatch({ type: 'SELECT', configId, node })
    dispatch({ type: 'ADD_RECENT', node, configId })
    setFocusedDn(node.dn)
    // Expand ancestors that are loaded
    const ancs = dnAncestors(node.dn)
    ancs.forEach(a => {
      if (state.childMap.has(a) && !state.expandedDns.has(a)) {
        dispatch({ type: 'EXPAND', dn: a })
      }
    })
    // Collapse the config if collapsed
    if (collapsedConfigs.has(configId)) {
      setCollapsedConfigs(prev => {
        const n = new Set(prev)
        n.delete(configId)
        return n
      })
    }
  }, [state.childMap, state.expandedDns, collapsedConfigs])

  const togglePin = useCallback((configId: string, node: TreeNode) => {
    if (state.pinnedNodes.has(node.dn)) {
      dispatch({ type: 'UNPIN_NODE', dn: node.dn })
    } else {
      dispatch({ type: 'PIN_NODE', dn: node.dn, ref: { node, configId } })
    }
  }, [state.pinnedNodes])

  const toggleFavorite = useCallback((dn: string) => {
    dispatch({ type: 'TOGGLE_FAVORITE', dn })
  }, [])

  // Pinned/favorite refs for sidebar
  const pinnedList = useMemo<PinnedRef[]>(() => Array.from(state.pinnedNodes.values()), [state.pinnedNodes])
  const favoriteList = useMemo<PinnedRef[]>(() => {
    // build from childMap + roots
    const map = new Map<string, PinnedRef>()
    activeConfigs.forEach((cfg, i) => {
      const roots = rootQueries[i]?.data ?? []
      roots.forEach(n => map.set(n.dn, { node: n, configId: cfg.id }))
    })
    state.childMap.forEach((arr, parentDn) => {
      arr.forEach(n => {
        // determine configId from parent (via existing lookup)
        const existing = map.get(parentDn)
        if (existing) map.set(n.dn, { node: n, configId: existing.configId })
        else {
          // try to derive via active configs by suffix
          const cfg = activeConfigs.find(c => n.dn.toLowerCase().endsWith(c.baseDn.toLowerCase()))
          if (cfg) map.set(n.dn, { node: n, configId: cfg.id })
        }
      })
    })
    const out: PinnedRef[] = []
    state.favorites.forEach(dn => {
      const ref = map.get(dn)
      if (ref) out.push(ref)
    })
    return out
  }, [state.favorites, state.childMap, activeConfigs, rootQueries])

  const totalCount = activeConfigs.reduce((a, c) => {
    const k = counts[c.id]
    return a + (k ? k.ous + k.users + k.groups : 0)
  }, 0)
  const anyConnError = Object.values(counts).some(c => c.status === 'error')
  const anyLoading = Object.values(counts).some(c => c.status === 'loading')

  // Context menu items
  const ctxItems = useMemo<ContextMenuItem[]>(() => {
    if (!contextMenu) return []
    const { node, configId } = contextMenu
    const items: ContextMenuItem[] = []
    items.push({
      label: 'Copy DN',
      hint: '⌘C',
      onClick: () => { navigator.clipboard?.writeText(node.dn).catch(() => {}) },
    })
    if (node.ldap_username) {
      items.push({
        label: 'Copy username',
        onClick: () => { navigator.clipboard?.writeText(node.ldap_username!).catch(() => {}) },
      })
    }
    items.push({
      label: state.pinnedNodes.has(node.dn) ? 'Unpin from top' : 'Pin to top',
      onClick: () => togglePin(configId, node),
    })
    items.push({
      label: state.favorites.has(node.dn) ? 'Remove favorite' : 'Add to favorites',
      hint: '★',
      onClick: () => toggleFavorite(node.dn),
    })
    if (node.type === 'user') {
      items.push({
        label: 'Grant access...',
        disabled: !node.ldap_username || apps.length === 0,
        onClick: () => {
          dispatch({ type: 'SELECT', configId, node })
          setShowActivate(true)
        },
      })
    }
    if (node.has_children && node.type !== 'user') {
      items.push({
        label: 'Expand all children',
        onClick: () => {
          dispatch({ type: 'EXPAND', dn: node.dn })
          if (!state.childMap.has(node.dn)) loadChildren(configId, node.dn)
          // expand one level only (recursive expand can be too expensive)
        },
      })
    }
    return items
  }, [contextMenu, state.pinnedNodes, state.favorites, state.childMap, apps.length, togglePin, toggleFavorite, loadChildren])

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 4rem)', minHeight: 560,
        fontFamily: FONT,
        color: C.textDim,
        background: C.bg,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      <style>{`
        @keyframes ldapFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ldapSlideIn { from { opacity: 0; transform: translateX(8px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes ldapPulseDot { 0%, 100% { opacity: 1 } 50% { opacity: 0.45 } }
        @keyframes ldapSkeleton {
          0% { opacity: 0.4 }
          50% { opacity: 0.85 }
          100% { opacity: 0.4 }
        }
      `}</style>

      {/* TOP BAR */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '0.75rem 1rem',
        borderBottom: `1px solid ${C.border}`,
        background: `linear-gradient(180deg, ${C.surface2} 0%, ${C.surface} 100%)`,
        flexShrink: 0,
        minHeight: 54,
      }}>
        <div style={{
          width: 32, height: 32, flexShrink: 0,
          border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: C.bg,
        }}>
          <DomainIcon size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: C.textMuted }}>
            ldap_directory_browser
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 1 }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: C.cyan, letterSpacing: '0.02em' }}>
              ACTIVE DIRECTORY
            </span>
            {selectedConfig && (
              <>
                <span style={{ color: C.border }}>/</span>
                <span style={{ fontSize: '0.75rem', color: C.textDim }}>{deriveDomain(selectedConfig.baseDn)}</span>
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {state.multiSelected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '4px 10px', fontSize: '0.7rem',
              border: `1px solid ${C.purple}`, color: C.purple,
              background: 'rgba(170,136,255,0.08)',
              letterSpacing: '0.05em',
            }}>
              {state.multiSelected.size} selected
            </span>
            {multiSelectedUsers.length > 0 && apps.length > 0 && (
              <button
                onClick={() => setShowBulkGrant(true)}
                style={{
                  padding: '4px 12px', fontSize: '0.7rem', fontWeight: 700,
                  border: `1px solid ${C.cyan}`, background: C.cyan, color: '#000',
                  cursor: 'pointer', fontFamily: FONT, letterSpacing: '0.04em',
                }}
              >
                + bulk_grant ({multiSelectedUsers.length})
              </button>
            )}
            <button onClick={() => dispatch({ type: 'CLEAR_MULTISELECT' })} style={{
              padding: '4px 8px', fontSize: '0.7rem',
              border: `1px solid ${C.border}`, background: 'none', color: C.textDim,
              cursor: 'pointer', fontFamily: FONT,
            }}>clear</button>
          </div>
        )}

        {/* Connection summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {activeConfigs.map(c => {
            const stat = counts[c.id]?.status ?? 'loading'
            const color = stat === 'error' ? C.red : stat === 'loading' ? C.amber : C.green
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: color,
                  boxShadow: stat === 'ok' ? `0 0 8px ${color}` : 'none',
                  animation: stat === 'loading' ? 'ldapPulseDot 1s ease-in-out infinite' : 'none',
                }} />
                <span style={{ fontSize: '0.7rem', color: C.textDim, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.url}
                </span>
              </div>
            )
          })}
          {activeConfigs.length === 0 && (
            <span style={{ fontSize: '0.7rem', color: C.amber }}>● no_active_configs</span>
          )}
        </div>
      </div>

      {/* BREADCRUMB */}
      {state.selection && (
        <Breadcrumb
          selection={state.selection}
          configs={activeConfigs}
          onJump={handleJump}
          expandedDns={state.expandedDns}
          childMap={state.childMap}
        />
      )}

      {/* BODY: split pane */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* LEFT: Tree panel */}
        <div style={{
          width: panelWidth, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderRight: `1px solid ${C.border}`,
          background: C.surface,
          minHeight: 0,
        }}>
          {/* Search row — single primary input with clear/scope inside */}
          <div style={{
            padding: '10px 10px 8px',
            borderBottom: `1px solid ${C.borderFaint}`,
            background: C.surface,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px',
              background: C.bg,
              border: `1px solid ${state.searchQuery ? 'rgba(94,234,212,0.35)' : C.border}`,
              borderRadius: 6,
              transition: 'border-color 0.15s',
            }}>
              <span style={{ color: C.textMuted, display: 'flex' }}><SearchIcon size={13} /></span>
              <input
                ref={searchInputRef}
                type="text"
                value={state.searchQuery}
                onChange={e => dispatch({ type: 'SET_SEARCH', query: e.target.value })}
                placeholder={searchScope === 'server' ? 'Search directory (LDAP)…' : 'Filter visible…'}
                style={{
                  flex: 1, minWidth: 0,
                  background: 'transparent', border: 'none',
                  color: C.text, fontSize: '0.78rem',
                  fontFamily: FONT, outline: 'none',
                }}
              />
              {state.searchQuery && (
                <button onClick={() => dispatch({ type: 'SET_SEARCH', query: '' })} style={{
                  background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer',
                  color: C.textDim, fontSize: '0.8rem', padding: '2px 7px',
                  borderRadius: 3, lineHeight: 1,
                }}>×</button>
              )}
              <kbd style={{
                fontSize: '0.58rem', fontFamily: FONT,
                padding: '1px 5px', color: C.textMuted,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${C.borderFaint}`, borderRadius: 3,
              }}>/</kbd>
            </div>

            {/* Row 1: scope segmented control + attribute picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                display: 'flex', padding: 2,
                background: C.surface2, border: `1px solid ${C.border}`,
                borderRadius: 5,
              }}>
                {([
                  { v: 'tree', label: 'Tree', hint: 'filter loaded nodes' },
                  { v: 'server', label: 'LDAP', hint: 'query the directory server' },
                ] as const).map(({ v, label, hint }) => {
                  const active = searchScope === v
                  return (
                    <button key={v} onClick={() => setSearchScope(v)} title={hint} style={{
                      padding: '3px 12px', fontSize: '0.7rem',
                      background: active ? (v === 'server' ? 'rgba(251,146,60,0.16)' : 'rgba(94,234,212,0.12)') : 'transparent',
                      border: 'none',
                      color: active ? (v === 'server' ? C.amber : C.cyan) : C.textMuted,
                      fontFamily: FONT, cursor: 'pointer', letterSpacing: '0.02em',
                      fontWeight: active ? 600 : 400,
                      borderRadius: 3,
                      transition: 'all 0.12s',
                    }}>
                      {label}
                    </button>
                  )
                })}
              </div>

              <AttributePicker
                value={searchAttr}
                onChange={setSearchAttr}
                quickOptions={[
                  { value: 'all', label: 'all attributes' },
                  { value: 'name', label: 'name (cn)' },
                  { value: 'username', label: 'username (uid)' },
                  { value: 'email', label: 'email (mail)' },
                  { value: 'title', label: 'title' },
                ]}
                schema={serverAttrs}
              />

              {(filterType !== 'all' || filterActivated !== 'all' || searchAttr !== 'all' || searchScope !== 'tree') && (
                <button
                  onClick={() => { setFilterType('all'); setFilterActivated('all'); setSearchAttr('all'); setSearchScope('tree') }}
                  title="Reset all filters"
                  style={{
                    marginLeft: 'auto', padding: '3px 8px', fontSize: '0.65rem',
                    background: 'transparent', border: `1px solid ${C.borderFaint}`,
                    color: C.textMuted, fontFamily: FONT, cursor: 'pointer',
                    borderRadius: 4,
                  }}
                >
                  reset
                </button>
              )}
            </div>

            {/* Row 2: type pills + (conditional) status pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {([
                { v: 'all', label: 'All', color: C.textDim },
                { v: 'ou', label: 'OUs', color: C.ouGold },
                { v: 'user', label: 'Users', color: C.cyan },
                { v: 'group', label: 'Groups', color: C.purple },
              ] as const).map(({ v, label, color }) => {
                const active = filterType === v
                const rgba = v === 'ou' ? '251,191,36' : v === 'group' ? '196,181,253' : v === 'user' ? '94,234,212' : '255,255,255'
                return (
                  <button
                    key={v}
                    onClick={() => { setFilterType(v); if (v !== 'user' && v !== 'all') setFilterActivated('all') }}
                    style={{
                      padding: '3px 10px', fontSize: '0.68rem',
                      background: active ? `rgba(${rgba},0.12)` : 'transparent',
                      border: `1px solid ${active ? color : C.borderFaint}`,
                      color: active ? color : C.textDim,
                      fontFamily: FONT, cursor: 'pointer',
                      fontWeight: active ? 600 : 400,
                      borderRadius: 999,
                      transition: 'all 0.1s',
                    }}
                  >
                    {label}
                  </button>
                )
              })}

              {(filterType === 'user' || filterType === 'all') && searchScope === 'tree' && (
                <>
                  <span style={{ width: 1, height: 14, background: C.borderFaint, margin: '0 4px' }} />
                  {([
                    { v: 'all', label: 'any state', color: C.textDim, rgba: '255,255,255' },
                    { v: 'active', label: '● active', color: C.green, rgba: '52,211,153' },
                    { v: 'inactive', label: '○ inactive', color: C.textMuted, rgba: '107,115,131' },
                  ] as const).map(({ v, label, color, rgba }) => {
                    const active = filterActivated === v
                    return (
                      <button key={v} onClick={() => setFilterActivated(v)} style={{
                        padding: '3px 10px', fontSize: '0.68rem',
                        background: active ? `rgba(${rgba},0.12)` : 'transparent',
                        border: `1px solid ${active ? color : C.borderFaint}`,
                        color: active ? color : C.textDim,
                        fontFamily: FONT, cursor: 'pointer',
                        fontWeight: active ? 600 : 400,
                        borderRadius: 999,
                        transition: 'all 0.1s',
                      }}>
                        {label}
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          </div>

          {/* Virtual flat list */}
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}
          >
            {configsLoading ? (
              <div style={{ padding: '2rem 1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Spinner size={12} />
                <span style={{ fontSize: '0.7rem', color: C.textMuted }}>loading config...</span>
              </div>
            ) : activeConfigs.length === 0 ? (
              <div style={{ padding: '1.5rem 1rem' }}>
                <div style={{ fontSize: '0.75rem', color: C.amber, marginBottom: 4 }}>! no_active_ldap</div>
                <div style={{ fontSize: '0.7rem', color: C.textMuted, lineHeight: 1.6 }}>
                  Add and activate an LDAP server in <span style={{ color: C.cyan }}>Settings → LDAP</span> to begin browsing the directory.
                </div>
              </div>
            ) : searchScope === 'server' ? (
              <ServerSearchResults
                query={state.debouncedSearch}
                attr={searchAttr}
                hits={serverHits}
                loading={serverSearching}
                onPick={hit => {
                  // Try to find the node in the loaded tree and select it; otherwise just show a toast-like row.
                  const ld = hit.ldap_username
                  const lookup = new Map<string, { node: TreeNode; configId: string }>()
                  state.childMap.forEach((arr, parentDn) => {
                    arr.forEach(n => {
                      const cfg = activeConfigs.find(c => parentDn.toLowerCase().endsWith(c.baseDn.toLowerCase()))
                      if (cfg) lookup.set(n.dn, { node: n, configId: cfg.id })
                    })
                  })
                  for (const v of lookup.values()) {
                    if (v.node.ldap_username?.toLowerCase() === ld.toLowerCase()) {
                      handleJump(v.configId, v.node)
                      setSearchScope('tree')
                      return
                    }
                  }
                  // fall back: pseudo-select using the hit
                  const cfgId = activeConfigs[0]?.id ?? ''
                  if (!cfgId) return
                  const pseudo: TreeNode = {
                    dn: `uid=${ld}`, rdn: `uid=${ld}`, type: 'user', name: hit.display_name ?? ld,
                    ldap_username: ld, email: hit.email, title: hit.title,
                    has_children: false, is_activated: hit.is_activated, groups: hit.groups,
                  }
                  dispatch({ type: 'SELECT', configId: cfgId, node: pseudo })
                  dispatch({ type: 'ADD_RECENT', node: pseudo, configId: cfgId })
                }}
              />
            ) : flatNodes.length === 0 ? (
              <div style={{ padding: '1.5rem 1rem', fontSize: '0.7rem', color: C.textMuted }}>
                {state.debouncedSearch ? `no matches for "${state.debouncedSearch}"` : 'directory is empty'}
              </div>
            ) : (
              <div style={{ height: flatNodes.length * ROW_H + 8, position: 'relative' }}>
                {visibleSlice.map((flatNode, i) => {
                  const idx = startIdx + i
                  const isNode = flatNode.kind === 'node'
                  const isConfigRow = flatNode.kind === 'config'
                  const dnKey = isNode ? flatNode.node.dn
                    : isConfigRow ? '__cfg:' + flatNode.configId
                    : flatNode.node.dn
                  const isSelected = isNode && selectedDn === flatNode.node.dn
                  const isFocused = dnKey === focusedDn
                  const isMultiSelected = isNode && state.multiSelected.has(flatNode.node.dn)
                  const isExpanded = isConfigRow
                    ? !collapsedConfigs.has(flatNode.configId)
                    : isNode && state.expandedDns.has(flatNode.node.dn)
                  const isLoading = isNode && state.loadingDns.has(flatNode.node.dn)
                  const isFavorite = isNode && state.favorites.has(flatNode.node.dn)
                  const isPinned = isNode && state.pinnedNodes.has(flatNode.node.dn)

                  return (
                    <div key={dnKey} style={{
                      position: 'absolute', top: idx * ROW_H, left: 0, right: 0,
                    }}>
                      <FlatTreeRow
                        flatNode={flatNode}
                        isSelected={isSelected}
                        isFocused={isFocused}
                        isMultiSelected={isMultiSelected}
                        isExpanded={isExpanded}
                        isLoading={isLoading}
                        isFavorite={isFavorite}
                        isPinned={isPinned}
                        searchQuery={state.debouncedSearch}
                        onToggle={handleToggleWithLoad}
                        onSelect={handleSelect}
                        onContextMenu={handleContextMenu}
                        onConfigToggle={handleConfigToggle}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Tree footer */}
          <div style={{
            padding: '0.5rem 0.75rem',
            borderTop: `1px solid ${C.border}`,
            fontSize: '0.65rem', color: C.textMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: C.surface2, flexShrink: 0,
          }}>
            <span>{activeConfigs.length} server{activeConfigs.length !== 1 ? 's' : ''}</span>
            <span>{flatNodes.filter(f => f.kind === 'node').length} visible</span>
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={() => setIsDragging(true)}
          style={{
            position: 'absolute',
            left: panelWidth - 2, top: 0, bottom: 0,
            width: 5,
            cursor: 'col-resize',
            zIndex: 10,
            background: isDragging ? 'rgba(94,234,212,0.3)' : 'transparent',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = 'rgba(94,234,212,0.12)' }}
          onMouseLeave={e => { if (!isDragging) e.currentTarget.style.background = 'transparent' }}
        />

        {/* RIGHT: Detail panel */}
        <div style={{
          flex: 1, minWidth: 0,
          overflowY: 'auto',
          background: `radial-gradient(ellipse at top right, rgba(94,234,212,0.025) 0%, transparent 60%), ${C.bg}`,
        }}>
          <div key={state.selection?.node.dn ?? 'none'} style={{ animation: 'ldapSlideIn 0.18s ease' }}>
            {!state.selection ? (
              <NoSelectionPanel
                totals={totals}
                configs={configs}
                pinned={pinnedList}
                favorites={favoriteList}
                recent={state.recentNodes}
                onJump={handleJump}
                onUnpin={dn => dispatch({ type: 'UNPIN_NODE', dn })}
                onUnfavorite={dn => dispatch({ type: 'TOGGLE_FAVORITE', dn })}
              />
            ) : selectedNode?.type === 'user' ? (
              <UserDetail
                node={selectedNode}
                apps={apps}
                isFavorite={state.favorites.has(selectedNode.dn)}
                isPinned={state.pinnedNodes.has(selectedNode.dn)}
                onActivate={() => setShowActivate(true)}
                onToggleFavorite={() => toggleFavorite(selectedNode.dn)}
                onTogglePin={() => state.selection && togglePin(state.selection.configId, selectedNode)}
              />
            ) : selectedNode ? (
              <ContainerDetail node={selectedNode} configId={state.selection.configId} />
            ) : null}
          </div>
        </div>
      </div>

      {/* STATUS BAR */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '0.4rem 1rem',
        borderTop: `1px solid ${C.border}`,
        background: C.surface2,
        fontSize: '0.65rem', color: C.textMuted,
        flexShrink: 0, minHeight: 28,
      }}>
        <span style={{
          color: anyConnError ? C.red : anyLoading ? C.amber : C.green,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {anyConnError ? '● error' : anyLoading ? '● syncing' : '● online'}
        </span>
        <span style={{ color: C.border }}>│</span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.textDim, fontFamily: FONT }}>
          {selectedNode ? selectedNode.dn : 'no_selection'}
        </span>
        <span style={{ color: C.border }}>│</span>
        <span>{totalCount} obj</span>
        <span style={{ color: C.border }}>│</span>
        <span>LDAP</span>
        <span style={{ color: C.border }}>│</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{stamp}</span>
      </div>

      {/* Modals */}
      {showActivate && selectedNode && selectedNode.type === 'user' && (
        <ActivateModal
          node={selectedNode}
          apps={apps}
          onClose={() => setShowActivate(false)}
        />
      )}

      {showBulkGrant && multiSelectedUsers.length > 0 && (
        <BulkGrantModal
          users={multiSelectedUsers}
          apps={apps}
          onClose={() => setShowBulkGrant(false)}
        />
      )}

      {/* Context menu */}
      {contextMenu && ctxItems.length > 0 && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={ctxItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
