import type { ControlType } from '../../types/form.js';
import { computeControlColors } from '../../theme/controlThemeMap.js';
import type { ResolvedControlColors } from '../../theme/controlThemeMap.js';
import { useSharedTheme } from './ThemeContext.js';
import { useSharedThemeColorMode } from './ThemeColorModeContext.js';

export function useViewControlColors(
  controlType: ControlType,
  props: { backColor?: string; foreColor?: string },
): ResolvedControlColors {
  const theme = useSharedTheme();
  const mode = useSharedThemeColorMode();
  return computeControlColors(controlType, theme, mode, props);
}
