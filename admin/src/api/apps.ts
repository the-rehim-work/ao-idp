import { apiClient } from './client'
import type { Application } from '../types'

export const appsApi = {
  list: () => apiClient.get<Application[]>('/applications').then(r => r.data),

  get: (id: string) => apiClient.get<Application>(`/applications/${id}`).then(r => r.data),

  create: (data: {
    name: string; slug: string; redirectUris: string[]; allowedOrigins?: string[]
    postLogoutRedirectUris?: string[]; isPublicClient?: boolean; forceReauth?: boolean
    accessMode?: string; accessRules?: Array<{ ruleType: string; value: string; ldapServerId?: string | null }>
  }) =>
    apiClient.post<Application>('/applications', {
      name: data.name,
      slug: data.slug,
      redirect_uris: data.redirectUris,
      allowed_origins: data.allowedOrigins ?? [],
      post_logout_redirect_uris: data.postLogoutRedirectUris ?? [],
      is_public_client: data.isPublicClient ?? false,
      force_reauth: data.forceReauth ?? true,
      access_mode: data.accessMode ?? 'ASSIGNED',
      access_rules: (data.accessRules ?? []).map(r => ({ rule_type: r.ruleType, value: r.value, ldap_server_id: r.ldapServerId ?? null })),
    }).then(r => r.data),

  update: (id: string, data: {
    name: string; slug: string; redirectUris: string[]; allowedOrigins?: string[]
    postLogoutRedirectUris?: string[]; forceReauth?: boolean
    accessMode?: string; accessRules?: Array<{ ruleType: string; value: string; ldapServerId?: string | null }>
  }) =>
    apiClient.put<Application>(`/applications/${id}`, {
      name: data.name,
      slug: data.slug,
      redirect_uris: data.redirectUris,
      allowed_origins: data.allowedOrigins ?? [],
      post_logout_redirect_uris: data.postLogoutRedirectUris ?? [],
      force_reauth: data.forceReauth ?? true,
      access_mode: data.accessMode ?? 'ASSIGNED',
      access_rules: (data.accessRules ?? []).map(r => ({ rule_type: r.ruleType, value: r.value, ldap_server_id: r.ldapServerId ?? null })),
    }).then(r => r.data),

  deactivate: (id: string) => apiClient.patch<Application>(`/applications/${id}/deactivate`).then(r => r.data),

  activate: (id: string) => apiClient.patch<Application>(`/applications/${id}/activate`).then(r => r.data),

  delete: (id: string) => apiClient.delete(`/applications/${id}`),
}
