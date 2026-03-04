import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import type { ThemeId, ThemeTokens } from '@webform/common';
import { getDefaultTheme, mergeThemeWithDefaults } from '@webform/common';
import { SharedThemeContext } from '@webform/common/views';

const ThemeContext = createContext<ThemeTokens>(getDefaultTheme());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_BASE = ((import.meta as any).env?.VITE_API_URL as string | undefined) ?? '/api';

async function fetchTheme(themeId: string): Promise<ThemeTokens> {
  // MongoDB ObjectId 패턴이면 _id로, 아니면 presetId로 조회
  const isObjectId = /^[a-f\d]{24}$/i.test(themeId);
  const url = isObjectId
    ? `${API_BASE}/runtime/themes/${themeId}`
    : `${API_BASE}/runtime/themes/preset/${themeId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch theme');
  const json = await res.json();
  return json.data.tokens;
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
    fetchTheme(themeId)
      .then((tokens) => {
        if (!cancelled) setLoadedTheme(tokens);
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
