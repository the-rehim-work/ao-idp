import { apiClient } from './client'

export interface LdapServerConfig {
  id: string
  name: string
  url: string
  baseDn: string
  serviceAccountDn: string
  serviceAccountPassword?: string
  usernameAttribute: string
  userObjectClass: string
  additionalUserFilter?: string
  claimMappings?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface LdapConfigRequest {
  name: string
  url: string
  baseDn: string
  serviceAccountDn: string
  serviceAccountPassword?: string
  usernameAttribute: string
  userObjectClass: string
  additionalUserFilter?: string
  claimMappings?: string
}

export interface TokenSettings {
  accessTokenExpiryMinutes: number
  refreshTokenExpiryDays: number
  adminTokenExpiryMinutes: number
}

export interface ClaimMapping {
  claim: string
  ldapAttr: string
  description: string
  enabled: boolean
}

export const settingsApi = {
  ldap: {
    list: () => apiClient.get<LdapServerConfig[]>('/settings/ldap').then(r => r.data),
    get: (id: string) => apiClient.get<LdapServerConfig>(`/settings/ldap/${id}`).then(r => r.data),
    create: (data: LdapConfigRequest) => apiClient.post<LdapServerConfig>('/settings/ldap', data).then(r => r.data),
    update: (id: string, data: LdapConfigRequest) => apiClient.put<LdapServerConfig>(`/settings/ldap/${id}`, data).then(r => r.data),
    delete: (id: string) => apiClient.delete(`/settings/ldap/${id}`),
    activate: (id: string) => apiClient.patch<LdapServerConfig>(`/settings/ldap/${id}/activate`).then(r => r.data),
    deactivate: (id: string) => apiClient.patch<LdapServerConfig>(`/settings/ldap/${id}/deactivate`).then(r => r.data),
    test: (data: LdapConfigRequest) => apiClient.post<{ success: boolean; message: string }>('/settings/ldap/test', data).then(r => r.data),
    testById: (id: string) => apiClient.post<{ success: boolean; message: string }>(`/settings/ldap/${id}/test`).then(r => r.data),
    attributes: () => apiClient.get<Record<string, string>>('/settings/ldap/attributes').then(r => r.data),
    attributesById: (id: string) => apiClient.get<Record<string, string>>(`/settings/ldap/${id}/attributes`).then(r => r.data),
    attributesFromConfig: (data: LdapConfigRequest) => apiClient.post<Record<string, string>>('/settings/ldap/attributes', data).then(r => r.data),
  },
  tokens: {
    get: () => apiClient.get<TokenSettings>('/settings/tokens').then(r => r.data),
    update: (data: TokenSettings) => apiClient.put<TokenSettings>('/settings/tokens', {
      accessTokenExpiryMinutes: data.accessTokenExpiryMinutes,
      refreshTokenExpiryDays: data.refreshTokenExpiryDays,
      adminTokenExpiryMinutes: data.adminTokenExpiryMinutes,
    }).then(r => r.data),
  },
  claims: {
    list: () => apiClient.get<ClaimMapping[]>('/settings/claims').then(r => r.data),
    update: (data: ClaimMapping[]) => apiClient.put<ClaimMapping[]>('/settings/claims', data).then(r => r.data),
  },
}
