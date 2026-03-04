import { createContext, useContext, type ReactNode } from 'react';
import { SharedThemeColorModeContext } from '@webform/common/views';

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
    <SharedThemeColorModeContext.Provider value={mode}>
      <ThemeColorModeContext.Provider value={mode}>{children}</ThemeColorModeContext.Provider>
    </SharedThemeColorModeContext.Provider>
  );
}

export function useThemeColorMode(): ThemeColorMode {
  return useContext(ThemeColorModeContext);
}
