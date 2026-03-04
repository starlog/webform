import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import type { ThemeId, ThemeTokens } from '@webform/common';
import { getDefaultTheme, mergeThemeWithDefaults } from '@webform/common';
import { SharedThemeContext } from '@webform/common/views';
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
    if (!loadedTheme) return getDefaultTheme();
    return mergeThemeWithDefaults(loadedTheme as unknown as Record<string, unknown>, getDefaultTheme());
  }, [loadedTheme]);

  return (
    <SharedThemeContext.Provider value={theme}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </SharedThemeContext.Provider>
  );
}

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}
