import { createContext, useContext } from 'react';

export type ThemeColorMode = 'theme' | 'control';

export const SharedThemeColorModeContext = createContext<ThemeColorMode>('control');

export function useSharedThemeColorMode(): ThemeColorMode {
  return useContext(SharedThemeColorModeContext);
}
