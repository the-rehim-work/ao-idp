import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AuthState {
  token: string | null
  adminType: string | null
  displayName: string | null
  setAuth: (token: string, adminType: string, displayName: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      adminType: null,
      displayName: null,
      setAuth: (token, adminType, displayName) =>
        set({ token, adminType, displayName }),
      clearAuth: () => set({ token: null, adminType: null, displayName: null }),
    }),
    { name: 'ao-admin-auth', storage: createJSONStorage(() => sessionStorage) }
  )
)
