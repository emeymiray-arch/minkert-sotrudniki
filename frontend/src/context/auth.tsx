import * as React from 'react';

import { apiJson, login as loginApi, logout as logoutApi } from '@/lib/http';
import {
  AUTH_SESSION_LOST_EVENT,
  clearAuthBundle,
  getAccessToken,
  getRefreshToken,
  readStoredUser,
  setStoredUser,
} from '@/lib/storage';
import type { AuthUser } from '@/lib/types';

type AuthContextValue = {
  user: AuthUser | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUserProfile: (user: AuthUser) => void;
  isAuthenticated: boolean;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = React.useState(true);
  const [user, setUser] = React.useState<AuthUser | null>(() => readStoredUser<AuthUser>());

  React.useEffect(() => {
    const onSessionLost = () => setUser(null);
    window.addEventListener(AUTH_SESSION_LOST_EVENT, onSessionLost);
    return () => window.removeEventListener(AUTH_SESSION_LOST_EVENT, onSessionLost);
  }, []);

  React.useEffect(() => {
    const token = getAccessToken();
    const restored = readStoredUser<AuthUser>();
    if (!token || !restored) {
      clearAuthBundle();
      setUser(null);
      setBooting(false);
      return;
    }
    setUser(restored);
    setBooting(false);

    void apiJson<AuthUser>('/users/me')
      .then((me) => {
        setStoredUser(me);
        setUser(me);
      })
      .catch(() => {
        if (!getAccessToken() && !getRefreshToken()) {
          setUser(null);
        }
      });
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const u = await loginApi(email, password);
    setUser(u);
  }, []);

  const logout = React.useCallback(async () => {
    await logoutApi();
    setUser(null);
  }, []);

  const setUserProfile = React.useCallback((nextUser: AuthUser) => {
    setStoredUser(nextUser);
    setUser(nextUser);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      booting,
      login,
      logout,
      setUserProfile,
      isAuthenticated: Boolean(user),
    }),
    [booting, login, logout, setUserProfile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
