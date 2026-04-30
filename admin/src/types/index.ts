export interface LdapUser {
  ldap_username: string
  email: string | null
  display_name: string
  is_activated: boolean
  title: string | null
  ou: string | null
  groups: string[]
  ldap_server_name?: string
}

export interface AdminUser {
  id: string
  username: string
  displayName: string
  adminType: 'idp_admin' | 'app_admin'
  active: boolean
  createdAt: string
}

export interface Application {
  id: string
  name: string
  slug: string
  client_id: string
  client_secret?: string
  redirect_uris: string[]
  allowed_origins: string[]
  is_active: boolean
  is_public_client: boolean
  created_at: string
}

export interface User {
  id: string
  ldapUsername: string
  email: string
  displayName: string
  active: boolean
  lastLoginAt: string | null
  createdAt: string
  ldapServerName?: string
}

export interface AuditLog {
  id: string
  actor_type: string
  actor_id: string
  action: string
  target_type: string | null
  target_id: string | null
  application_id: string | null
  ip_address: string | null
  user_agent: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface SystemStats {
  total_users: number
  total_apps: number
  logins_today: number
  logins_week: number
  failed_today: number
  failed_week: number
  total_logins: number
  total_failed: number
  users_active_today: number
  users_active_week: number
  events_today: number
  events_month: number
  active_sessions: number
  event_breakdown: { action: string; count: number }[]
  login_chart: { date: string; success: boolean; count: number }[]
}

export interface AppAccess {
  appId: string
  appName: string
  clientId: string
  grantedAt: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  total_elements: number
  total_pages: number
  last: boolean
}
