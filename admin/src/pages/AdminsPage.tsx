import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminsApi, AdminUser } from '../api/admins'
import { appsApi } from '../api/apps'

const C = '#00ffff', CD = '#00d4e8', CM = '#009bb5', CB = '#006b8a'
const BORDER = 'rgba(0,255,255,0.18)', SURFACE = '#020d10', ERR = '#ff4444'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, width: '100%', maxWidth: 480, padding: '1.75rem', boxShadow: `0 0 40px rgba(0,255,255,0.1)` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{title}</div>
          <button onClick={onClose} style={{ color: CB, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontSize: '0.625rem', color: CD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', background: '#000', border: `1px solid ${BORDER}`, color: C, fontFamily: 'inherit', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties = { padding: '0.6rem 1.25rem', background: 'transparent', border: `1px solid ${C}`, color: C, fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { ...btnPrimary, border: `1px solid ${CB}`, color: CB }

export default function AdminsPage() {
  const qc = useQueryClient()
  const { data: admins = [], isLoading } = useQuery({ queryKey: ['admins'], queryFn: adminsApi.list })
  const { data: apps = [] } = useQuery({ queryKey: ['applications'], queryFn: appsApi.list })

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)
  const [pwdTarget, setPwdTarget] = useState<AdminUser | null>(null)
  const [scopeTarget, setScopeTarget] = useState<AdminUser | null>(null)
  const [error, setError] = useState('')

  const [form, setForm] = useState({ username: '', displayName: '', password: '', adminType: 'app_admin' })
  const [editForm, setEditForm] = useState({ displayName: '', adminType: 'app_admin' })
  const [pwdForm, setPwdForm] = useState({ newPassword: '', confirm: '' })

  const createMut = useMutation({
    mutationFn: () => adminsApi.create({ username: form.username, displayName: form.displayName, password: form.password, adminType: form.adminType }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admins'] }); setCreateOpen(false); setForm({ username: '', displayName: '', password: '', adminType: 'app_admin' }); setError('') },
    onError: (e: any) => setError(e.response?.data?.error_description ?? 'Failed to create admin'),
  })

  const updateMut = useMutation({
    mutationFn: () => adminsApi.update(editTarget!.id, { displayName: editForm.displayName, adminType: editForm.adminType }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admins'] }); setEditTarget(null); setError('') },
    onError: (e: any) => setError(e.response?.data?.error_description ?? 'Failed to update'),
  })

  const pwdMut = useMutation({
    mutationFn: () => adminsApi.resetPassword(pwdTarget!.id, pwdForm.newPassword),
    onSuccess: () => { setPwdTarget(null); setPwdForm({ newPassword: '', confirm: '' }); setError('') },
    onError: (e: any) => setError(e.response?.data?.error_description ?? 'Failed to reset password'),
  })

  const activateMut = useMutation({
    mutationFn: (id: string) => adminsApi.activate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admins'] }),
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => adminsApi.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admins'] }),
  })

  const { data: currentScopes = [], refetch: refetchScopes } = useQuery({
    queryKey: ['admin-scopes', scopeTarget?.id],
    queryFn: () => adminsApi.getScopes(scopeTarget!.id),
    enabled: !!scopeTarget,
  })

  const addScopeMut = useMutation({
    mutationFn: (appId: string) => adminsApi.addScope(scopeTarget!.id, appId),
    onSuccess: () => { refetchScopes(); qc.invalidateQueries({ queryKey: ['admins'] }) },
    onError: () => setError('Failed to grant scope'),
  })

  const removeScopeMut = useMutation({
    mutationFn: (appId: string) => adminsApi.removeScope(scopeTarget!.id, appId),
    onSuccess: () => { refetchScopes(); qc.invalidateQueries({ queryKey: ['admins'] }) },
    onError: () => setError('Failed to revoke scope'),
  })

  const activeApps = apps.filter(a => a.is_active)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <div style={{ fontSize: '0.625rem', color: CB, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>AO IDP</div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: C, letterSpacing: '0.08em', textTransform: 'uppercase', textShadow: '0 0 8px rgba(0,255,255,0.5)' }}>Admin Users</h1>
        </div>
        <button style={btnPrimary} onClick={() => { setCreateOpen(true); setError('') }}>+ create admin</button>
      </div>

      {isLoading ? (
        <div style={{ color: CM, fontSize: '0.75rem' }}>loading...</div>
      ) : (
        <div style={{ border: `1px solid ${BORDER}`, background: SURFACE }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Username', 'Display Name', 'Type', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.625rem', color: CB, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map(admin => (
                <tr key={admin.id} style={{ borderBottom: `1px solid rgba(0,255,255,0.07)`, opacity: admin.active ? 1 : 0.5 }}>
                  <td style={{ padding: '0.75rem 1rem', color: C, fontWeight: 600 }}>{admin.username}</td>
                  <td style={{ padding: '0.75rem 1rem', color: CD }}>{admin.displayName}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ fontSize: '0.625rem', padding: '0.2rem 0.5rem', border: `1px solid ${admin.adminType === 'idp_admin' ? C : CM}`, color: admin.adminType === 'idp_admin' ? C : CM, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      {admin.adminType === 'idp_admin' ? 'IDP Admin' : 'App Admin'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ fontSize: '0.625rem', color: admin.active ? C : ERR }}>{admin.active ? 'active' : 'inactive'}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: CB, fontSize: '0.75rem' }}>
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button style={{ ...btnSecondary, padding: '0.25rem 0.6rem', fontSize: '0.625rem' }}
                        onClick={() => { setEditTarget(admin); setEditForm({ displayName: admin.displayName, adminType: admin.adminType }); setError('') }}>
                        edit
                      </button>
                      <button style={{ ...btnSecondary, padding: '0.25rem 0.6rem', fontSize: '0.625rem' }}
                        onClick={() => { setPwdTarget(admin); setError('') }}>
                        pwd
                      </button>
                      {admin.adminType === 'app_admin' && (
                        <button style={{ ...btnSecondary, padding: '0.25rem 0.6rem', fontSize: '0.625rem' }}
                          onClick={() => setScopeTarget(admin)}>
                          scopes
                        </button>
                      )}
                      {admin.active ? (
                        <button style={{ ...btnSecondary, padding: '0.25rem 0.6rem', fontSize: '0.625rem', borderColor: '#ff8800', color: '#ff8800' }}
                          onClick={() => deactivateMut.mutate(admin.id)}>
                          disable
                        </button>
                      ) : (
                        <button style={{ ...btnSecondary, padding: '0.25rem 0.6rem', fontSize: '0.625rem', borderColor: C, color: C }}
                          onClick={() => activateMut.mutate(admin.id)}>
                          enable
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <Modal title="Create Admin" onClose={() => { setCreateOpen(false); setError('') }}>
          {error && <div style={{ color: ERR, fontSize: '0.75rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', border: '1px solid rgba(255,68,68,0.3)' }}>[ERR] {error}</div>}
          <Field label="Username"><input style={inputStyle} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="username" autoComplete="off" /></Field>
          <Field label="Display Name"><input style={inputStyle} value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Full Name" /></Field>
          <Field label="Password"><input style={inputStyle} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} autoComplete="new-password" /></Field>
          <Field label="Type">
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.adminType} onChange={e => setForm(f => ({ ...f, adminType: e.target.value }))}>
              <option value="app_admin">App Admin</option>
              <option value="idp_admin">IDP Admin</option>
            </select>
          </Field>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button style={btnSecondary} onClick={() => { setCreateOpen(false); setError('') }}>cancel</button>
            <button style={btnPrimary} onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? 'creating...' : '> create'}
            </button>
          </div>
        </Modal>
      )}

      {editTarget && (
        <Modal title={`Edit — ${editTarget.username}`} onClose={() => { setEditTarget(null); setError('') }}>
          {error && <div style={{ color: ERR, fontSize: '0.75rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', border: '1px solid rgba(255,68,68,0.3)' }}>[ERR] {error}</div>}
          <Field label="Display Name"><input style={inputStyle} value={editForm.displayName} onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))} /></Field>
          <Field label="Type">
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={editForm.adminType} onChange={e => setEditForm(f => ({ ...f, adminType: e.target.value }))}>
              <option value="app_admin">App Admin</option>
              <option value="idp_admin">IDP Admin</option>
            </select>
          </Field>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button style={btnSecondary} onClick={() => { setEditTarget(null); setError('') }}>cancel</button>
            <button style={btnPrimary} onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
              {updateMut.isPending ? 'saving...' : '> save'}
            </button>
          </div>
        </Modal>
      )}

      {pwdTarget && (
        <Modal title={`Reset Password — ${pwdTarget.username}`} onClose={() => { setPwdTarget(null); setError('') }}>
          {error && <div style={{ color: ERR, fontSize: '0.75rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', border: '1px solid rgba(255,68,68,0.3)' }}>[ERR] {error}</div>}
          <Field label="New Password"><input style={inputStyle} type="password" value={pwdForm.newPassword} onChange={e => setPwdForm(f => ({ ...f, newPassword: e.target.value }))} autoComplete="new-password" /></Field>
          <Field label="Confirm Password"><input style={inputStyle} type="password" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} autoComplete="new-password" /></Field>
          {pwdForm.confirm && pwdForm.newPassword !== pwdForm.confirm && (
            <div style={{ color: ERR, fontSize: '0.7rem', marginBottom: '0.5rem' }}>Passwords do not match</div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button style={btnSecondary} onClick={() => { setPwdTarget(null); setError('') }}>cancel</button>
            <button style={btnPrimary} onClick={() => pwdMut.mutate()}
              disabled={pwdMut.isPending || !pwdForm.newPassword || pwdForm.newPassword !== pwdForm.confirm}>
              {pwdMut.isPending ? 'resetting...' : '> reset password'}
            </button>
          </div>
        </Modal>
      )}

      {scopeTarget && (
        <Modal title={`App Scopes — ${scopeTarget.username}`} onClose={() => { setScopeTarget(null); setError('') }}>
          {error && <div style={{ color: ERR, fontSize: '0.75rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', border: '1px solid rgba(255,68,68,0.3)' }}>[ERR] {error}</div>}
          <div style={{ fontSize: '0.7rem', color: CB, marginBottom: '1rem' }}>
            App admins can only manage assigned applications. Granted apps are highlighted.
          </div>
          {activeApps.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: CB, padding: '1rem', textAlign: 'center' }}>No active applications.</div>
          ) : activeApps.map(app => {
            const granted = currentScopes.includes(app.id)
            const busy = addScopeMut.isPending || removeScopeMut.isPending
            return (
              <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', marginBottom: '0.25rem', border: `1px solid ${granted ? 'rgba(0,255,255,0.3)' : 'rgba(0,255,255,0.08)'}`, background: granted ? 'rgba(0,255,255,0.04)' : 'transparent' }}>
                <div>
                  <div style={{ fontSize: '0.8125rem', color: granted ? C : CD }}>{app.name}</div>
                  <div style={{ fontSize: '0.6rem', color: CB }}>{app.client_id}</div>
                </div>
                {granted ? (
                  <button style={{ ...btnSecondary, padding: '0.2rem 0.5rem', fontSize: '0.6rem', borderColor: ERR, color: ERR }}
                    disabled={busy} onClick={() => removeScopeMut.mutate(app.id)}>
                    revoke
                  </button>
                ) : (
                  <button style={{ ...btnSecondary, padding: '0.2rem 0.5rem', fontSize: '0.6rem', borderColor: C, color: C }}
                    disabled={busy} onClick={() => addScopeMut.mutate(app.id)}>
                    + grant
                  </button>
                )}
              </div>
            )
          })}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button style={btnSecondary} onClick={() => { setScopeTarget(null); setError('') }}>close</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
