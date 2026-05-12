import { apiClient } from './client'

export interface LdapTreeNode {
  dn: string
  rdn: string
  type: 'ou' | 'user' | 'group' | 'other'
  name: string
  ldap_username?: string
  email?: string
  title?: string
  has_children: boolean
  is_activated: boolean
  groups?: string[]
  children?: LdapTreeNode[]
}

export interface LdapOuInfo {
  dn: string
  name: string
  level: number
}

export interface LdapSearchHit {
  ldap_username: string
  email?: string
  display_name?: string
  is_activated: boolean
  title?: string
  ou?: string
  groups?: string[]
  ldap_server_name?: string
}

export const ldapApi = {
  getChildren: (dn?: string, configId?: string) =>
    apiClient.get<LdapTreeNode[]>('/ldap/tree', {
      params: { ...(dn ? { dn } : {}), ...(configId ? { configId } : {}) },
    }).then(r => r.data),

  getOus: () =>
    apiClient.get<LdapOuInfo[]>('/ldap/ous').then(r => r.data),

  getUsers: (dn?: string, search?: string, attr?: string) =>
    apiClient.get<LdapSearchHit[]>('/ldap/users', {
      params: {
        ...(dn ? { dn } : {}),
        ...(search ? { search } : {}),
        ...(attr && attr !== 'all' ? { attr } : {}),
      },
    }).then(r => r.data),

  // Returns real LDAP schema attributes for a given server (attribute name -> sample value)
  attributesById: (configId: string) =>
    apiClient.get<Record<string, string>>(`/settings/ldap/${configId}/attributes`).then(r => r.data),
}
