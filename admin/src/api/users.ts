import { apiClient } from './client'
import type { User, LdapUser, PageResponse, AppAccess } from '../types'

export const usersApi = {
  list: (params?: { search?: string; page?: number; size?: number }) =>
    apiClient.get<PageResponse<User>>('/users', { params }).then(r => r.data),

  get: (id: string) => apiClient.get<User>(`/users/${id}`).then(r => r.data),

  activate: (ldapUsername: string) =>
    apiClient.post<User>('/users', { ldap_username: ldapUsername }).then(r => r.data),

  deactivate: (id: string) => apiClient.delete(`/users/${id}`),

  listLdap: (search?: string) =>
    apiClient.get<LdapUser[]>('/ldap/users', { params: search ? { search } : undefined }).then(r => r.data),

  listForApp: (appId: string, params?: { search?: string; page?: number; size?: number }) =>
    apiClient.get<PageResponse<User>>(`/apps/${appId}/users`, { params }).then(r => r.data),

  activateForApp: (appId: string, ldapUsername: string) =>
    apiClient.post<User>(`/apps/${appId}/users/${ldapUsername}/activate`).then(r => r.data),

  getUserAppAccess: (userId: string) =>
    apiClient.get<AppAccess[]>(`/users/${userId}/app-access`).then(r => r.data),

  revokeAppAccess: (appId: string, userId: string) =>
    apiClient.delete(`/apps/${appId}/users/${userId}/access`),
}
