import { apiClient } from './client'

export interface AdminUser {
  id: string
  username: string
  displayName: string
  adminType: string
  active: boolean
  createdAt: string
}

export const adminsApi = {
  list: () => apiClient.get<AdminUser[]>('/admins').then(r => r.data),
  get: (id: string) => apiClient.get<AdminUser>(`/admins/${id}`).then(r => r.data),
  create: (data: { username: string; displayName: string; password: string; adminType: string }) =>
    apiClient.post<AdminUser>('/admins', data).then(r => r.data),
  update: (id: string, data: { displayName: string; adminType: string }) =>
    apiClient.patch<AdminUser>(`/admins/${id}`, data).then(r => r.data),
  activate: (id: string) => apiClient.patch<AdminUser>(`/admins/${id}/activate`).then(r => r.data),
  deactivate: (id: string) => apiClient.delete(`/admins/${id}`),
  resetPassword: (id: string, newPassword: string) =>
    apiClient.patch(`/admins/${id}/password`, { newPassword }),
  getScopes: (id: string) => apiClient.get<string[]>(`/admins/${id}/app-scopes`).then(r => r.data),
  addScope: (id: string, applicationId: string) =>
    apiClient.post(`/admins/${id}/app-scopes`, { application_id: applicationId }),
  removeScope: (id: string, appId: string) =>
    apiClient.delete(`/admins/${id}/app-scopes/${appId}`),
  me: () => apiClient.get<AdminUser>('/auth/me').then(r => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
}
