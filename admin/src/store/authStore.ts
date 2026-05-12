import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AuthState {
  token: string | null
  adminType: string | null
  displayName: string | null
  permissions: string[]
  sessionExpired: boolean
  setAuth: (token: string, adminType: string, displayName: string, permissions: string[]) => void
  clearAuth: () => void
  setSessionExpired: (v: boolean) => void
  hasPermission: (section: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      adminType: null,
      displayName: null,
      permissions: [],
      sessionExpired: false,
      setAuth: (token, adminType, displayName, permissions) =>
        set({ token, adminType, displayName, permissions: permissions ?? [], sessionExpired: false }),
      clearAuth: () => set({ token: null, adminType: null, displayName: null, permissions: [], sessionExpired: false }),
      setSessionExpired: (v) => set({ sessionExpired: v }),
      hasPermission: (section: string) => {
        const { adminType, permissions } = get()
        if (adminType === 'idp_admin') return true
        return permissions.includes(section)
      },
    }),
    {
      name: 'ao-admin-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        adminType: state.adminType,
        displayName: state.displayName,
        permissions: state.permissions,
      }),
    }
  )
)
