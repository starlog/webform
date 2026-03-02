import type { ControlType } from '@webform/common';
import { computeControlColors } from '@webform/common';
import type { ResolvedControlColors } from '@webform/common';
import { useTheme } from './ThemeContext';
import { useDesignerStore } from '../stores/designerStore';

export type { ResolvedControlColors };

export function useControlColors(
  controlType: ControlType,
  props: { backColor?: string; foreColor?: string },
): ResolvedControlColors {
  const theme = useTheme();
  const mode = useDesignerStore((s) => s.formProperties.themeColorMode ?? 'control');
  return computeControlColors(controlType, theme, mode as 'theme' | 'control', props);
}
