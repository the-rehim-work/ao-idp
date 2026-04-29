import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { apiClient } from '../api/client'

const C = '#00ffff'
const CD = '#00d4e8'
const CM = '#009bb5'
const CB = '#006b8a'
const BORDER = 'rgba(0,255,255,0.3)'
const GLOW = '0 0 8px rgba(0,255,255,0.6), 0 0 20px rgba(0,255,255,0.25)'
const TITLE_GLOW = '0 0 8px rgba(0,255,255,0.9), 0 0 20px rgba(0,255,255,0.5), 0 0 40px rgba(0,255,255,0.2)'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await apiClient.post('/auth/login', { username, password })
      setAuth(data.access_token, data.admin_type, data.display_name)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error_description?: string } } })
        ?.response?.data?.error_description ?? 'Invalid credentials'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: '"JetBrains Mono", "Courier New", monospace', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.015) 2px, rgba(0,255,255,0.015) 4px)' }} />
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 50%, rgba(0,255,255,0.04) 0%, transparent 70%)' }} />

      <div style={{ width: '100%', maxWidth: 340, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, border: `1px solid ${BORDER}`, background: '#020d10', marginBottom: '0.875rem', boxShadow: GLOW }}>
            <svg width="26" height="26" fill={C} viewBox="0 0 28 28" style={{ filter: 'drop-shadow(0 0 4px rgba(0,255,255,0.8))' }}>
              <path d="M14 2C7.373 2 2 7.373 2 14s5.373 12 12 12 12-5.373 12-12S20.627 2 14 2zm0 4a3.5 3.5 0 110 7 3.5 3.5 0 010-7zm0 14.5c-2.917 0-5.5-1.49-7-3.75.035-2.321 4.667-3.593 7-3.593s6.965 1.272 7 3.594A8.326 8.326 0 0114 20.5z"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: C, letterSpacing: '0.1em', textTransform: 'uppercase', textShadow: TITLE_GLOW }}>ao.az admin</h1>
          <p style={{ fontSize: '0.6875rem', color: CB, marginTop: '0.25rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>identity provider management</p>
        </div>

        <div style={{ background: '#020d10', border: `1px solid ${BORDER}`, padding: '2rem', boxShadow: '0 0 30px rgba(0,255,255,0.08), inset 0 0 30px rgba(0,255,255,0.02)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.6875rem', color: CB, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>admin.ao.az</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: C, textShadow: '0 0 6px rgba(0,255,255,0.6)' }}>{'> '}authenticate</div>
          </div>

          {error && (
            <div style={{ border: '1px solid rgba(255,51,51,0.4)', background: 'rgba(255,51,51,0.06)', color: '#ff4444', padding: '0.5rem 0.75rem', fontSize: '0.75rem', marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', boxShadow: '0 0 8px rgba(255,51,51,0.2)' }}>
              <span style={{ flexShrink: 0 }}>[ERR]</span><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.6875rem', color: CD, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
                # username
              </label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                required autoFocus placeholder="username" autoComplete="username"
                style={{ width: '100%', padding: '0.5625rem 0.75rem', background: '#000', border: `1px solid ${BORDER}`, color: C, fontFamily: 'inherit', fontSize: '0.875rem', outline: 'none', caretColor: C, boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = C; e.target.style.boxShadow = GLOW }}
                onBlur={e => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.6875rem', color: CD, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
                # password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required placeholder="password" autoComplete="current-password"
                style={{ width: '100%', padding: '0.5625rem 0.75rem', background: '#000', border: `1px solid ${BORDER}`, color: C, fontFamily: 'inherit', fontSize: '0.875rem', outline: 'none', caretColor: C, boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = C; e.target.style.boxShadow = GLOW }}
                onBlur={e => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none' }}
              />
            </div>
            <button
              type="submit" disabled={loading}
              style={{ width: '100%', padding: '0.6875rem', background: 'transparent', border: `1px solid ${loading ? CM : C}`, color: loading ? CM : C, fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loading ? 'default' : 'pointer', transition: 'all 0.15s', boxShadow: loading ? 'none' : GLOW }}
              onMouseEnter={e => { if (!loading) { (e.target as HTMLElement).style.background = C; (e.target as HTMLElement).style.color = '#000'; (e.target as HTMLElement).style.boxShadow = '0 0 20px rgba(0,255,255,0.8), 0 0 40px rgba(0,255,255,0.4)' } }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = loading ? CM : C; (e.target as HTMLElement).style.boxShadow = loading ? 'none' : GLOW }}
            >
              {loading ? '> connecting...' : '> execute'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.625rem', color: CB, marginTop: '1rem', letterSpacing: '0.1em' }}>
          AO Identity Provider · OAuth2 · RS256
        </p>
      </div>
    </div>
  )
}
