// ─── Quanta Theme Runtime ──────────────────────────────────────────────────
// Live CSS-variable based theming. Reads localStorage; on change, mutates
// `:root` style properties directly so every component using var(--xxx)
// updates instantly with no React re-render cascade.

export type ThemeMode = 'dark' | 'light' | 'system'

export interface ThemeState {
  mode: ThemeMode
  accent: string  // hex
  density: 'comfortable' | 'compact'
  radius: 'sharp' | 'soft' | 'round'
}

export const ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: 'mint',     hex: '#5eead4' },
  { name: 'emerald',  hex: '#34d399' },
  { name: 'sky',      hex: '#7dd3fc' },
  { name: 'indigo',   hex: '#a5b4fc' },
  { name: 'lavender', hex: '#c4b5fd' },
  { name: 'rose',     hex: '#fb7185' },
  { name: 'amber',    hex: '#fbbf24' },
  { name: 'orange',   hex: '#fb923c' },
]

export const DEFAULT_THEME: ThemeState = {
  mode: 'dark',
  accent: '#5eead4',
  density: 'comfortable',
  radius: 'soft',
}

const STORAGE_KEY = 'ao-theme-v1'

export function loadTheme(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_THEME
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_THEME, ...parsed }
  } catch { return DEFAULT_THEME }
}

export function saveTheme(t: ThemeState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)) } catch { /* quota */ }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const s = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return [
    parseInt(s.slice(0, 2), 16) || 0,
    parseInt(s.slice(2, 4), 16) || 0,
    parseInt(s.slice(4, 6), 16) || 0,
  ]
}

function clamp(n: number) { return Math.max(0, Math.min(255, n | 0)) }
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${clamp(r - r * amount)},${clamp(g - g * amount)},${clamp(b - b * amount)})`
}

export function applyTheme(t: ThemeState) {
  const root = document.documentElement
  // resolve "system" → actual
  const resolved = t.mode === 'system'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : t.mode
  root.setAttribute('data-theme', resolved)
  root.setAttribute('data-density', t.density)
  root.setAttribute('data-radius', t.radius)
  // accent + derivatives
  const [r, g, b] = hexToRgb(t.accent)
  root.style.setProperty('--accent', t.accent)
  root.style.setProperty('--accent-strong', darken(t.accent, 0.18))
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`)
  root.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.10)`)
  root.style.setProperty('--accent-medium', `rgba(${r},${g},${b},0.22)`)
  root.style.setProperty('--accent-border', `rgba(${r},${g},${b},0.35)`)
  root.style.setProperty('--accent-glow', `0 0 8px rgba(${r},${g},${b},0.35), 0 0 20px rgba(${r},${g},${b},0.18)`)
}

// Initialize on import. Safe to call repeatedly.
export function initTheme() {
  const t = loadTheme()
  applyTheme(t)
  // react to OS theme change when mode=system
  const mm = matchMedia('(prefers-color-scheme: light)')
  mm.addEventListener?.('change', () => {
    const cur = loadTheme()
    if (cur.mode === 'system') applyTheme(cur)
  })
}
