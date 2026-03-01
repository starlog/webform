import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import type { ThemeId, ThemeTokens } from '@webform/common';
import { getDefaultTheme } from '@webform/common';

const ThemeContext = createContext<ThemeTokens>(getDefaultTheme());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_BASE = ((import.meta as any).env?.VITE_API_URL as string | undefined) ?? '/api';

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
    return mergeWithDefaults(loadedTheme as unknown as Record<string, unknown>, getDefaultTheme());
  }, [loadedTheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}
