import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import type { ThemeId, ThemeTokens } from '@webform/common';
import { getDefaultTheme } from '@webform/common';
import { apiService } from '../services/apiService';

const ThemeContext = createContext<ThemeTokens>(getDefaultTheme());

/** 불완전한 토큰을 기본 테마와 deep merge하여 누락 속성을 채운다 */
function mergeWithDefaults(partial: Record<string, unknown>, defaults: ThemeTokens): ThemeTokens {
  const result = { ...defaults } as Record<string, unknown>;
  for (const key of Object.keys(partial)) {
    const val = partial[key];
    const def = (defaults as unknown as Record<string, unknown>)[key];
    if (val && def && typeof val === 'object' && typeof def === 'object' && !Array.isArray(val)) {
      result[key] = mergeWithDefaults(val as Record<string, unknown>, def as unknown as ThemeTokens);
    } else if (val !== undefined) {
      result[key] = val;
    }
  }
  return result as unknown as ThemeTokens;
}

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
    return mergeWithDefaults(loadedTheme as unknown as Record<string, unknown>, getDefaultTheme());
  }, [loadedTheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}
