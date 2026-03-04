import { createContext, useContext } from 'react';
import type { ThemeTokens } from '../../types/theme.js';
import { getDefaultTheme } from '../../themes/presets.js';

export const SharedThemeContext = createContext<ThemeTokens>(getDefaultTheme());

export function useSharedTheme(): ThemeTokens {
  return useContext(SharedThemeContext);
}
