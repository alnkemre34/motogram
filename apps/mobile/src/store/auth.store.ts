import type { TokenPair } from '@motogram/shared';
import { create } from 'zustand';

import { StorageKeys, deleteKey, getString, setString } from '../lib/storage';

// Spec 3.1 / .cursorrules madde 3 - Zustand ZORUNLU (Redux yasak)
// Spec 9.6 - Auth state: accessToken, refreshToken, userId

interface AuthState {
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  hydrate: () => void;
  setSession: (userId: string, tokens: TokenPair) => void;
  clearSession: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  userId: null,
  accessToken: null,
  refreshToken: null,
  isHydrated: false,

  hydrate: () => {
    set({
      userId: getString(StorageKeys.UserId) ?? null,
      accessToken: getString(StorageKeys.AccessToken) ?? null,
      refreshToken: getString(StorageKeys.RefreshToken) ?? null,
      isHydrated: true,
    });
  },

  setSession: (userId, tokens) => {
    setString(StorageKeys.UserId, userId);
    setString(StorageKeys.AccessToken, tokens.accessToken);
    setString(StorageKeys.RefreshToken, tokens.refreshToken);
    set({
      userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  },

  clearSession: () => {
    deleteKey(StorageKeys.UserId);
    deleteKey(StorageKeys.AccessToken);
    deleteKey(StorageKeys.RefreshToken);
    set({ userId: null, accessToken: null, refreshToken: null });
  },

  isAuthenticated: () => {
    const { accessToken, userId } = get();
    return Boolean(accessToken && userId);
  },
}));
