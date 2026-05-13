import * as React from 'react';

import { getStoredTheme, setStoredTheme, type ThemePreference } from '@/lib/storage';

type ThemeContextValue = {
  mode: ThemePreference;
  setMode: (m: ThemePreference) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function resolveSystemDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyDomTheme(mode: ThemePreference) {
  const root = document.documentElement;
  const resolved = mode === 'system' ? (resolveSystemDark() ? 'dark' : 'light') : mode;
  root.classList.toggle('dark', resolved === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<ThemePreference>(() => getStoredTheme());

  const setMode = React.useCallback((m: ThemePreference) => {
    setModeState(m);
    setStoredTheme(m);
  }, []);

  React.useLayoutEffect(() => {
    applyDomTheme(mode);
  }, [mode]);

  React.useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyDomTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const value = React.useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
