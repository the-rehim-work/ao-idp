import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const coreNavItems = [
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

const adminOnlyNavItems = [
  { to: '/admins', label: 'admins', prefix: '/mgmt', icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
  { to: '/settings', label: 'settings', prefix: '/cfg', icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
]

const profileNavItem = { to: '/profile', label: 'profile', prefix: '/me', icon: (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)}

function NavItem({ to, label, prefix, icon }: { to: string; label: string; prefix: string; icon: React.ReactNode }) {
  return (
    <NavLink
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
  )
}

export default function Layout() {
  const { adminType, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const isIdpAdmin = adminType === 'idp_admin'

  return (
    <div className="flex min-h-screen" style={{ background: '#000', color: '#00ffff', fontFamily: '"JetBrains Mono", "Courier New", monospace' }}>
      <nav className="w-52 flex flex-col shrink-0 border-r" style={{ borderColor: 'rgba(0,255,255,0.15)', background: '#020d10' }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(0,255,255,0.12)' }}>
          <div className="font-bold text-base tracking-widest uppercase" style={{ color: '#00ffff', textShadow: '0 0 8px rgba(0,255,255,0.8), 0 0 20px rgba(0,255,255,0.4)' }}>AO IDP</div>
          <div className="text-xs mt-0.5 tracking-widest uppercase" style={{ color: '#006b8a' }}>admin panel</div>
        </div>

        <div className="flex-1 py-2">
          {coreNavItems.map(item => <NavItem key={item.to} {...item} />)}

          {isIdpAdmin && (
            <>
              <div className="mx-4 my-2 border-t" style={{ borderColor: 'rgba(0,255,255,0.08)' }} />
              {adminOnlyNavItems.map(item => <NavItem key={item.to} {...item} />)}
            </>
          )}
        </div>

        <div className="border-t" style={{ borderColor: 'rgba(0,255,255,0.12)' }}>
          <NavItem {...profileNavItem} />
          <div className="px-4 pb-4">
            <button
              onClick={() => { clearAuth(); navigate('/login') }}
              className="text-xs tracking-wide"
              style={{ color: '#006b8a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {'> '}logout
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 min-w-0 p-8 overflow-auto" style={{ background: '#000' }}>
        <Outlet />
      </main>
    </div>
  )
}
