import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ThemeMode } from '@astryxdesign/core';

export type { ThemeMode };

const KEY = 'astryx:theme';

function readStoredMode(): ThemeMode {
  const stored = localStorage.getItem(KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

const ThemeModeContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void } | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);

  const setMode = (next: ThemeMode) => {
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
    setModeState(next);
  };

  const ctx = useMemo(() => ({ mode, setMode }), [mode]);

  return <ThemeModeContext value={ctx}>{children}</ThemeModeContext>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}
