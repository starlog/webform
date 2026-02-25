import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import type { ThemeId, ThemeTokens } from '@webform/common';
import { getDefaultTheme } from '@webform/common';
import { apiService } from '../services/apiService';

const ThemeContext = createContext<ThemeTokens>(getDefaultTheme());

export function ThemeProvider({
  themeId,
  children,
}: {
  themeId: ThemeId | undefined;
  children: ReactNode;
}) {
  const [loadedTheme, setLoadedTheme] = useState<ThemeTokens | null>(null);

  useEffect(() => {
    if (!themeId) {
      setLoadedTheme(null);
      return;
    }

    let cancelled = false;
    apiService
      .getThemeByIdOrPresetId(themeId)
      .then((res) => {
        if (!cancelled) setLoadedTheme(res.data.tokens);
      })
      .catch(() => {
        if (!cancelled) setLoadedTheme(null);
      });
    return () => {
      cancelled = true;
    };
  }, [themeId]);

  const theme = useMemo(() => {
    return loadedTheme ?? getDefaultTheme();
  }, [loadedTheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}
