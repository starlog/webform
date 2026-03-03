/**
 * 컨트롤 공유 스타일 팩토리
 *
 * Designer와 Runtime이 동일한 시각적 스타일을 공유하기 위한 순수 함수 모음.
 * React 의존성 없이 ThemeTokens + ResolvedControlColors를 입력받아 CSS 스타일 객체를 반환한다.
 */
import type { ThemeTokens } from '../types/theme.js';
import type { ResolvedControlColors } from '../theme/controlThemeMap.js';

/** React CSSProperties와 호환되는 스타일 객체 타입 */
export type CSSStyle = Record<string, string | number | undefined>;

// ─── Button ───

export function buttonBaseStyle(theme: ThemeTokens, colors: ResolvedControlColors): CSSStyle {
  return {
    background: colors.background,
    border: theme.controls.button.border,
    padding: theme.controls.button.padding,
    borderRadius: theme.controls.button.borderRadius,
    color: colors.color,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    textAlign: 'center',
    boxSizing: 'border-box',
  };
}

// ─── TextBox / NumericUpDown / DateTimePicker / RichTextBox ───

export function textInputBaseStyle(theme: ThemeTokens, colors: ResolvedControlColors): CSSStyle {
  return {
    background: colors.background,
    border: theme.controls.textInput.border,
    padding: theme.controls.textInput.padding,
    borderRadius: theme.controls.textInput.borderRadius,
    color: colors.color,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    boxSizing: 'border-box',
  };
}

// ─── Label ───

export function labelBaseStyle(colors: ResolvedControlColors, textAlign?: string): CSSStyle {
  const style: CSSStyle = {
    display: 'inline-block',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    userSelect: 'none',
    boxSizing: 'border-box',
    color: colors.color,
  };
  if (textAlign) style.textAlign = textAlign;
  return style;
}

// ─── CheckBox / RadioButton ───

export function checkRadioBaseStyle(colors: ResolvedControlColors): CSSStyle {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    boxSizing: 'border-box',
    userSelect: 'none',
    color: colors.color,
  };
}

export const checkRadioInputStyle: CSSStyle = {
  margin: 0,
  width: 16,
  height: 16,
  pointerEvents: 'none',
};

export const checkRadioTextStyle: CSSStyle = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// ─── ComboBox ───

export function comboBoxBaseStyle(theme: ThemeTokens, colors: ResolvedControlColors): CSSStyle {
  return {
    background: colors.background,
    border: theme.controls.select.border,
    borderRadius: theme.controls.select.borderRadius,
    color: colors.color,
    padding: '2px 4px',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    boxSizing: 'border-box',
  };
}

// ─── ListBox ───

export function listBoxBaseStyle(theme: ThemeTokens, colors: ResolvedControlColors): CSSStyle {
  return {
    background: colors.background,
    border: theme.controls.select.border,
    borderRadius: theme.controls.select.borderRadius,
    color: colors.color,
    overflow: 'auto',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    boxSizing: 'border-box',
  };
}

export function listBoxItemStyle(
  theme: ThemeTokens,
  isSelected: boolean,
): CSSStyle {
  return {
    padding: '1px 4px',
    backgroundColor: isSelected ? theme.controls.select.selectedBackground : 'transparent',
    color: isSelected ? theme.controls.select.selectedForeground : theme.controls.select.foreground,
    userSelect: 'none',
  };
}

// ─── Panel ───

export function panelBaseStyle(
  theme: ThemeTokens,
  colors: ResolvedControlColors,
  borderStyle?: string,
): CSSStyle {
  const style: CSSStyle = {
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
    background: colors.background,
    color: colors.color,
    borderRadius: theme.controls.panel.borderRadius,
  };
  if (borderStyle === 'FixedSingle' || borderStyle === 'Fixed3D') {
    style.border = theme.controls.panel.border;
  }
  return style;
}

// ─── GroupBox ───

export function groupBoxFieldsetStyle(theme: ThemeTokens): CSSStyle {
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    border: theme.controls.groupBox.border,
    borderRadius: theme.controls.groupBox.borderRadius,
    padding: 0,
    margin: 0,
    boxSizing: 'border-box',
    pointerEvents: 'none',
  };
}

export function groupBoxLegendStyle(colors: ResolvedControlColors): CSSStyle {
  return {
    padding: '0 4px',
    fontSize: 'inherit',
    color: colors.color,
    marginLeft: 8,
  };
}

// ─── ProgressBar ───

export function progressBarContainerStyle(
  theme: ThemeTokens,
  colors: ResolvedControlColors,
): CSSStyle {
  return {
    boxSizing: 'border-box',
    border: theme.controls.progressBar.border,
    borderRadius: theme.controls.progressBar.borderRadius,
    background: colors.background,
    overflow: 'hidden',
  };
}

export function progressBarFillStyle(theme: ThemeTokens, percent: number): CSSStyle {
  return {
    width: `${Math.min(100, Math.max(0, percent))}%`,
    height: '100%',
    background: theme.controls.progressBar.fillBackground,
    transition: 'width 0.2s ease',
  };
}

export function computePercent(value: number, minimum: number, maximum: number): number {
  const range = maximum - minimum || 1;
  return Math.max(0, Math.min(100, ((value - minimum) / range) * 100));
}

// ─── Switch ───

export interface SwitchStyleInput {
  checked: boolean;
  onColor?: string;
  offColor?: string;
}

export function switchTrackStyle(input: SwitchStyleInput): CSSStyle {
  const trackBg = input.checked
    ? input.onColor || '#1677ff'
    : input.offColor || 'rgba(0,0,0,0.25)';
  return {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    width: 44,
    height: 22,
    borderRadius: 11,
    backgroundColor: trackBg,
    flexShrink: 0,
    transition: 'background-color 0.2s ease',
  };
}

export function switchThumbStyle(checked: boolean): CSSStyle {
  return {
    position: 'absolute',
    top: 2,
    left: checked ? 24 : 2,
    width: 18,
    height: 18,
    borderRadius: '50%',
    backgroundColor: '#fff',
    transition: 'left 0.2s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
  };
}

export function switchTrackTextStyle(checked: boolean): CSSStyle {
  return {
    fontSize: '0.65em',
    color: '#fff',
    userSelect: 'none',
    position: 'absolute',
    left: checked ? 6 : undefined,
    right: checked ? undefined : 6,
  };
}

export function switchContainerStyle(colors: ResolvedControlColors): CSSStyle {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxSizing: 'border-box',
    color: colors.color,
  };
}

// ─── Slider ───

export interface SliderStyleInput {
  isVertical: boolean;
  percent: number;
  trackColor: string;
  fillColor: string;
}

export function sliderInputStyle(input: SliderStyleInput): CSSStyle {
  const { isVertical, percent, trackColor, fillColor } = input;
  const dir = isVertical ? 'to top' : 'to right';
  return {
    width: isVertical ? undefined : '100%',
    height: isVertical ? '100%' : undefined,
    accentColor: fillColor,
    background: `linear-gradient(${dir}, ${fillColor} 0%, ${fillColor} ${percent}%, ${trackColor} ${percent}%, ${trackColor} 100%)`,
    borderRadius: '4px',
    margin: 0,
  };
}

export function sliderContainerStyle(colors: ResolvedControlColors, isVertical: boolean): CSSStyle {
  const style: CSSStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxSizing: 'border-box',
    color: colors.color,
  };
  if (isVertical) {
    style.flexDirection = 'column';
    style.writingMode = 'vertical-lr';
    style.direction = 'rtl';
  }
  return style;
}

export const sliderValueStyle: CSSStyle = {
  fontSize: '0.85em',
  minWidth: '2em',
  textAlign: 'center',
  writingMode: 'horizontal-tb',
  direction: 'ltr',
};

// ─── Alert ───

export const ALERT_STYLES: Record<
  string,
  { bg: string; border: string; icon: string; iconColor: string; color: string }
> = {
  Success: {
    bg: '#f6ffed',
    border: '#b7eb8f',
    icon: '\u2713',
    iconColor: '#52c41a',
    color: '#135200',
  },
  Info: {
    bg: '#e6f4ff',
    border: '#91caff',
    icon: '\u2139',
    iconColor: '#1677ff',
    color: '#003a8c',
  },
  Warning: {
    bg: '#fffbe6',
    border: '#ffe58f',
    icon: '\u26A0',
    iconColor: '#faad14',
    color: '#614700',
  },
  Error: {
    bg: '#fff2f0',
    border: '#ffccc7',
    icon: '\u2715',
    iconColor: '#ff4d4f',
    color: '#820014',
  },
};

export function alertContainerStyle(
  alertType: string,
  banner: boolean,
  foreColor?: string,
): CSSStyle {
  const a = ALERT_STYLES[alertType] || ALERT_STYLES.Info;
  return {
    backgroundColor: a.bg,
    border: banner ? 'none' : `1px solid ${a.border}`,
    borderRadius: banner ? 0 : '6px',
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    color: foreColor ?? a.color,
    userSelect: 'none',
    boxSizing: 'border-box',
    overflow: 'hidden',
  };
}

export function alertIconStyle(alertType: string): CSSStyle {
  const a = ALERT_STYLES[alertType] || ALERT_STYLES.Info;
  return {
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: a.iconColor,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    flexShrink: 0,
    lineHeight: 1,
  };
}

// ─── Badge ───

export const BADGE_STATUS_COLORS: Record<string, string> = {
  Default: '#ff4d4f',
  Success: '#52c41a',
  Processing: '#1677ff',
  Error: '#ff4d4f',
  Warning: '#faad14',
};

// ─── PictureBox ───

export const PICTURE_SIZE_MODE_MAP: Record<string, string> = {
  Normal: 'none',
  StretchImage: 'fill',
  AutoSize: 'none',
  CenterImage: 'none',
  Zoom: 'contain',
};

// ─── Divider ───

export const DIVIDER_FLEX_MAP: Record<string, [number, number]> = {
  Left: [0.05, 0.95],
  Center: [1, 1],
  Right: [0.95, 0.05],
};
