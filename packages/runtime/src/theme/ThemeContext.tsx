import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ThemeId, ThemeTokens } from '@webform/common';
import { getThemeById } from '@webform/common';

const ThemeContext = createContext<ThemeTokens>(getThemeById(undefined));

export function ThemeProvider({
  themeId,
  children,
}: {
  themeId: ThemeId | undefined;
  children: ReactNode;
}) {
  const theme = useMemo(() => getThemeById(themeId), [themeId]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}
