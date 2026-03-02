import type { ControlType } from '@webform/common';
import { computeControlColors } from '@webform/common';
import type { ResolvedControlColors } from '@webform/common';
import { useTheme } from './ThemeContext';
import { useThemeColorMode } from './ThemeColorModeContext';

export type { ResolvedControlColors };

export function useControlColors(
  controlType: ControlType,
  props: { backColor?: string; foreColor?: string },
): ResolvedControlColors {
  const theme = useTheme();
  const mode = useThemeColorMode();
  return computeControlColors(controlType, theme, mode, props);
}
