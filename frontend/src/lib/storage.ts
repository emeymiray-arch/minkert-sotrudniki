const KEYS = {
  access: 'minkert.access',
  refresh: 'minkert.refresh',
  user: 'minkert.user',
  theme: 'minkert.theme',
} as const;

export type ThemePreference = 'light' | 'dark' | 'system';

export function getStoredTheme(): ThemePreference {
  const v = localStorage.getItem(KEYS.theme);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
}

export function setStoredTheme(mode: ThemePreference) {
  localStorage.setItem(KEYS.theme, mode);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(KEYS.access);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(KEYS.refresh);
}

export function setAuthBundle(accessToken: string, refreshToken: string, userRaw: unknown) {
  localStorage.setItem(KEYS.access, accessToken);
  localStorage.setItem(KEYS.refresh, refreshToken);
  localStorage.setItem(KEYS.user, JSON.stringify(userRaw));
}

export function setStoredUser(userRaw: unknown) {
  localStorage.setItem(KEYS.user, JSON.stringify(userRaw));
}

export function clearAuthBundle() {
  localStorage.removeItem(KEYS.access);
  localStorage.removeItem(KEYS.refresh);
  localStorage.removeItem(KEYS.user);
}

export function readStoredUser<T>(): T | null {
  const raw = localStorage.getItem(KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
