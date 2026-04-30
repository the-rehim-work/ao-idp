import React from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ApplicationsPage from './pages/ApplicationsPage'
import UsersPage from './pages/UsersPage'
import LdapTreePage from './pages/LdapTreePage'
import AuditPage from './pages/AuditPage'
import AdminsPage from './pages/AdminsPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import Layout from './components/Layout'

function SessionExpiredOverlay() {
  const clearAuth = useAuthStore(s => s.clearAuth)
  const navigate = useNavigate()
  const handleReLogin = () => {
    clearAuth()
    navigate('/login', { replace: true })
  }
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, fontFamily: 'monospace',
    }}>
      <div style={{
        background: '#020d10', border: '1px solid rgba(0,255,255,0.3)',
        padding: '2.5rem 3rem', textAlign: 'center', maxWidth: 400,
      }}>
        <div style={{ fontSize: '0.6rem', color: '#006b8a', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1rem' }}>
          Session Expired
        </div>
        <div style={{ fontSize: '0.9rem', color: '#00ffff', marginBottom: '0.5rem', fontWeight: 700 }}>
          Your admin session has expired
        </div>
        <div style={{ fontSize: '0.75rem', color: '#009bb5', marginBottom: '2rem' }}>
          Admin sessions last 8 hours. Please sign in again to continue.
        </div>
        <button onClick={handleReLogin} style={{
          padding: '0.6rem 1.5rem', background: 'transparent',
          border: '1px solid #00ffff', color: '#00ffff',
          fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
        }}>
          Sign in again
        </button>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const sessionExpired = useAuthStore(s => s.sessionExpired)

  return (
    <>
      {sessionExpired && <SessionExpiredOverlay />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="directory" element={<LdapTreePage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="admins" element={<AdminsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
