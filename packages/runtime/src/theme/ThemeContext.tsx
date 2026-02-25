import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import type { ThemeId, ThemeTokens } from '@webform/common';
import { getThemeById, isPresetTheme, getDefaultTheme } from '@webform/common';

const ThemeContext = createContext<ThemeTokens>(getDefaultTheme());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_BASE = ((import.meta as any).env?.VITE_API_URL as string | undefined) ?? '/api';

export function ThemeProvider({
  themeId,
  children,
}: {
  themeId: ThemeId | undefined;
  children: ReactNode;
}) {
  const [customTheme, setCustomTheme] = useState<ThemeTokens | null>(null);

  const isCustom = themeId != null && !isPresetTheme(themeId);

  useEffect(() => {
    if (!isCustom || !themeId) {
      setCustomTheme(null);
      return;
    }

    let cancelled = false;
    fetch(`${API_BASE}/runtime/themes/${themeId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch theme');
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setCustomTheme(json.data.tokens);
      })
      .catch(() => {
        if (!cancelled) setCustomTheme(null);
      });
    return () => {
      cancelled = true;
    };
  }, [themeId, isCustom]);

  const theme = useMemo(() => {
    if (isCustom) return customTheme ?? getDefaultTheme();
    return getThemeById(themeId);
  }, [themeId, isCustom, customTheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}
