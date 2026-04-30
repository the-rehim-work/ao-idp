import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AuthState {
  token: string | null
  adminType: string | null
  displayName: string | null
  sessionExpired: boolean
  setAuth: (token: string, adminType: string, displayName: string) => void
  clearAuth: () => void
  setSessionExpired: (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      adminType: null,
      displayName: null,
      sessionExpired: false,
      setAuth: (token, adminType, displayName) =>
        set({ token, adminType, displayName, sessionExpired: false }),
      clearAuth: () => set({ token: null, adminType: null, displayName: null, sessionExpired: false }),
      setSessionExpired: (v) => set({ sessionExpired: v }),
    }),
    {
      name: 'ao-admin-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, adminType: state.adminType, displayName: state.displayName }),
    }
  )
)
