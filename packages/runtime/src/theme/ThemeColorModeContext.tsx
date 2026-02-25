import { createContext, useContext, type ReactNode } from 'react';

type ThemeColorMode = 'theme' | 'control';

const ThemeColorModeContext = createContext<ThemeColorMode>('control');

export function ThemeColorModeProvider({
  mode,
  children,
}: {
  mode: ThemeColorMode;
  children: ReactNode;
}) {
  return (
    <ThemeColorModeContext.Provider value={mode}>{children}</ThemeColorModeContext.Provider>
  );
}

export function useThemeColorMode(): ThemeColorMode {
  return useContext(ThemeColorModeContext);
}
