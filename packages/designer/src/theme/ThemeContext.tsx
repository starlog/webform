import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import type { ThemeId, ThemeTokens } from '@webform/common';
import { getThemeById, isPresetTheme, getDefaultTheme } from '@webform/common';
import { apiService } from '../services/apiService';

const ThemeContext = createContext<ThemeTokens>(getDefaultTheme());

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
    apiService
      .getTheme(themeId)
      .then((res) => {
        if (!cancelled) setCustomTheme(res.data.tokens);
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
