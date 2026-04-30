import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { adminsApi } from '../api/admins'
import { useAuthStore } from '../store/authStore'

const C = '#00ffff', CD = '#00d4e8', CM = '#009bb5', CB = '#006b8a'
const BORDER = 'rgba(0,255,255,0.18)', SURFACE = '#020d10'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5625rem 0.75rem', background: '#000',
  border: `1px solid ${BORDER}`, color: C, fontFamily: 'inherit',
  fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
}

export default function ProfilePage() {
  const { displayName, adminType } = useAuthStore()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: adminsApi.me })

  const [current, setCurrent] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const changePwdMut = useMutation({
    mutationFn: () => adminsApi.changePassword(current, newPwd),
    onSuccess: () => {
      setSuccess(true)
      setCurrent(''); setNewPwd(''); setConfirm('')
      setError('')
      setTimeout(() => setSuccess(false), 3000)
    },
    onError: (e: any) => setError(e.response?.data?.error_description ?? 'Failed to change password'),
  })

  const canSubmit = current && newPwd && newPwd === confirm && newPwd.length >= 8

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.625rem', color: CB, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>AO IDP</div>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: C, letterSpacing: '0.08em', textTransform: 'uppercase', textShadow: '0 0 8px rgba(0,255,255,0.5)' }}>Profile</h1>
      </div>

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.625rem', color: CB, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1rem' }}>Account Info</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {[
            { label: 'Username', value: me?.username ?? '—' },
            { label: 'Display Name', value: displayName ?? '—' },
            { label: 'Role', value: adminType === 'idp_admin' ? 'IDP Admin' : 'App Admin' },
            { label: 'Status', value: me?.active ? 'Active' : 'Inactive' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: '0.6rem', color: CB, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{label}</div>
              <div style={{ fontSize: '0.875rem', color: CD }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, padding: '1.5rem' }}>
        <div style={{ fontSize: '0.625rem', color: CB, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>Change Password</div>

        {success && (
          <div style={{ border: '1px solid rgba(0,255,255,0.3)', background: 'rgba(0,255,255,0.05)', color: C, padding: '0.5rem 0.75rem', fontSize: '0.75rem', marginBottom: '1rem' }}>
            Password changed successfully.
          </div>
        )}
        {error && (
          <div style={{ border: '1px solid rgba(255,68,68,0.3)', background: 'rgba(255,68,68,0.06)', color: '#ff4444', padding: '0.5rem 0.75rem', fontSize: '0.75rem', marginBottom: '1rem' }}>
            [ERR] {error}
          </div>
        )}

        {[
          { label: 'Current Password', value: current, setter: setCurrent },
          { label: 'New Password', value: newPwd, setter: setNewPwd },
          { label: 'Confirm New Password', value: confirm, setter: setConfirm },
        ].map(({ label, value, setter }) => (
          <div key={label} style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.625rem', color: CD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>{label}</label>
            <input
              style={inputStyle} type="password" value={value}
              onChange={e => { setter(e.target.value); setError(''); setSuccess(false) }}
              autoComplete="new-password"
            />
          </div>
        ))}

        {confirm && newPwd !== confirm && (
          <div style={{ color: '#ff4444', fontSize: '0.7rem', marginBottom: '0.75rem' }}>Passwords do not match</div>
        )}
        {newPwd && newPwd.length < 8 && (
          <div style={{ color: '#ff8800', fontSize: '0.7rem', marginBottom: '0.75rem' }}>Minimum 8 characters</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button
            style={{ padding: '0.6rem 1.25rem', background: 'transparent', border: `1px solid ${canSubmit ? C : CM}`, color: canSubmit ? C : CM, fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canSubmit ? 'pointer' : 'default', boxShadow: canSubmit ? '0 0 8px rgba(0,255,255,0.3)' : 'none' }}
            disabled={!canSubmit || changePwdMut.isPending}
            onClick={() => changePwdMut.mutate()}
          >
            {changePwdMut.isPending ? '> updating...' : '> change password'}
          </button>
        </div>
      </div>
    </div>
  )
}
