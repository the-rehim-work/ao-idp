import { apiClient } from './client'
import type { LdapUser } from '../types'

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

export const ldapApi = {
  getChildren: (dn?: string) =>
    apiClient.get<LdapTreeNode[]>('/ldap/tree', {
      params: dn ? { dn } : undefined,
    }).then(r => r.data),

  getOus: () =>
    apiClient.get<LdapOuInfo[]>('/ldap/ous').then(r => r.data),

  getUsers: (dn?: string, search?: string) =>
    apiClient.get<LdapUser[]>('/ldap/users', {
      params: { ...(dn ? { dn } : {}), ...(search ? { search } : {}) },
    }).then(r => r.data),
}
