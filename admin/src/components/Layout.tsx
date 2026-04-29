import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const navItems = [
  { to: '/', label: 'dashboard', prefix: '~', icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )},
  { to: '/applications', label: 'applications', prefix: '/apps', icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
    </svg>
  )},
  { to: '/users', label: 'users', prefix: '/usr', icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )},
  { to: '/directory', label: 'directory', prefix: '/ldap', icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )},
  { to: '/audit', label: 'audit logs', prefix: '/log', icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )},
]

export default function Layout() {
  const { displayName, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen" style={{ background: '#000', color: '#00ffff', fontFamily: '"JetBrains Mono", "Courier New", monospace' }}>
      <nav className="w-52 flex flex-col shrink-0 border-r" style={{ borderColor: 'rgba(0,255,255,0.15)', background: '#020d10' }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(0,255,255,0.12)' }}>
          <div className="font-bold text-base tracking-widest uppercase" style={{ color: '#00ffff', textShadow: '0 0 8px rgba(0,255,255,0.8), 0 0 20px rgba(0,255,255,0.4)' }}>ao.az</div>
          <div className="text-xs mt-0.5 tracking-widest uppercase" style={{ color: '#006b8a' }}>admin panel</div>
        </div>

        <div className="flex-1 py-2">
          {navItems.map(({ to, label, prefix, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 text-xs transition-all ${isActive ? 'font-bold' : ''}`
              }
              style={({ isActive }) => isActive
                ? { color: '#000', background: '#00ffff', boxShadow: 'inset 0 0 12px rgba(0,255,255,0.3), 0 0 8px rgba(0,255,255,0.4)' }
                : { color: '#009bb5' }
              }
            >
              {icon}
              <span>{prefix}/{label}</span>
            </NavLink>
          ))}
        </div>

        <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(0,255,255,0.12)' }}>
          <div className="text-xs mb-2 truncate" style={{ color: '#006b8a' }}>{displayName}</div>
          <button
            onClick={() => { clearAuth(); navigate('/login') }}
            className="text-xs tracking-wide"
            style={{ color: '#009bb5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {'> '}logout
          </button>
        </div>
      </nav>

      <main className="flex-1 min-w-0 p-8 overflow-auto" style={{ background: '#000' }}>
        <Outlet />
      </main>
    </div>
  )
}
