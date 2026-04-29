import { apiClient } from './client'
import type { Application } from '../types'

export const appsApi = {
  list: () => apiClient.get<Application[]>('/applications').then(r => r.data),

  get: (id: string) => apiClient.get<Application>(`/applications/${id}`).then(r => r.data),

  create: (data: { name: string; slug: string; redirectUris: string[]; allowedOrigins?: string[]; isPublicClient?: boolean }) =>
    apiClient.post<Application>('/applications', {
      name: data.name,
      slug: data.slug,
      redirect_uris: data.redirectUris,
      allowed_origins: data.allowedOrigins ?? [],
      is_public_client: data.isPublicClient ?? false,
    }).then(r => r.data),

  update: (id: string, data: { name: string; slug: string; redirectUris: string[]; allowedOrigins?: string[] }) =>
    apiClient.put<Application>(`/applications/${id}`, {
      name: data.name,
      slug: data.slug,
      redirect_uris: data.redirectUris,
      allowed_origins: data.allowedOrigins ?? [],
    }).then(r => r.data),

  deactivate: (id: string) => apiClient.patch<Application>(`/applications/${id}/deactivate`).then(r => r.data),

  activate: (id: string) => apiClient.patch<Application>(`/applications/${id}/activate`).then(r => r.data),

  delete: (id: string) => apiClient.delete(`/applications/${id}`),
}
