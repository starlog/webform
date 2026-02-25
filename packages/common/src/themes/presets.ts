import type { ThemeTokens } from '../types/theme';

/**
 * FALLBACK_THEME: API 응답 전 또는 오프라인 시 사용하는 기본 테마 (Windows XP).
 * 프리셋 테마는 더 이상 소스코드에 하드코딩되지 않으며, MongoDB에서 로드된다.
 */
export const FALLBACK_THEME: ThemeTokens = {
  id: 'windows-xp',
  name: 'Windows XP',
  window: {
    titleBar: {
      background: 'linear-gradient(to right, #0078D7, #005A9E)',
      foreground: '#FFFFFF',
      height: 30,
      font: '12px Segoe UI, sans-serif',
      borderRadius: '0',
      controlButtonsPosition: 'right',
    },
    border: '1px solid #333333',
    borderRadius: '0',
    shadow: '0 2px 10px rgba(0,0,0,0.2)',
  },
  form: {
    backgroundColor: '#F0F0F0',
    foreground: '#000000',
    fontFamily: 'Segoe UI, Tahoma, sans-serif',
    fontSize: '12px',
  },
  controls: {
    button: {
      background: '#E1E1E1',
      border: '1px outset #D0D0D0',
      borderRadius: '0',
      foreground: '#000000',
      hoverBackground: '#D0D0D0',
      padding: '2px 8px',
    },
    textInput: {
      background: '#FFFFFF',
      border: '1px inset #A0A0A0',
      borderRadius: '0',
      foreground: '#000000',
      focusBorder: '1px inset #0078D7',
      padding: '2px 4px',
    },
    select: {
      background: '#FFFFFF',
      border: '1px inset #A0A0A0',
      borderRadius: '0',
      foreground: '#000000',
      selectedBackground: '#0078D7',
      selectedForeground: '#FFFFFF',
    },
    checkRadio: {
      border: '1px solid #999999',
      background: '#FFFFFF',
      checkedBackground: '#0078D7',
      borderRadius: '0',
    },
    panel: {
      background: 'transparent',
      border: '1px solid #D0D0D0',
      borderRadius: '0',
    },
    groupBox: {
      border: '1px solid #D0D0D0',
      borderRadius: '0',
      foreground: '#000000',
    },
    tabControl: {
      tabBackground: '#F0F0F0',
      tabActiveBackground: '#FFFFFF',
      tabBorder: '1px solid #A0A0A0',
      tabBorderRadius: '0',
      tabForeground: '#000000',
      tabActiveForeground: '#000000',
      contentBackground: '#FFFFFF',
      contentBorder: '1px solid #A0A0A0',
    },
    dataGrid: {
      headerBackground: '#E8E8E8',
      headerForeground: '#000000',
      headerBorder: '1px solid #A0A0A0',
      rowBackground: '#FFFFFF',
      rowAlternateBackground: '#F5F5F5',
      rowForeground: '#000000',
      border: '1px solid #A0A0A0',
      borderRadius: '0',
      selectedRowBackground: '#0078D7',
      selectedRowForeground: '#FFFFFF',
    },
    progressBar: {
      background: '#E0E0E0',
      fillBackground: '#06B025',
      border: '1px solid #A0A0A0',
      borderRadius: '0',
    },
    menuStrip: {
      background: '#F0F0F0',
      foreground: '#000000',
      border: '1px solid #D0D0D0',
      hoverBackground: '#D0E8FF',
      hoverForeground: '#000000',
      activeBackground: '#CCE4FF',
    },
    toolStrip: {
      background: '#F0F0F0',
      foreground: '#000000',
      border: '1px solid #D0D0D0',
      buttonHoverBackground: '#D0E8FF',
      separator: '#C0C0C0',
    },
    statusStrip: {
      background: '#F0F0F0',
      foreground: '#444444',
      border: '1px solid #D0D0D0',
    },
    scrollbar: {
      trackBackground: '#F0F0F0',
      thumbBackground: '#C0C0C0',
      thumbHoverBackground: '#A0A0A0',
      width: 17,
    },
  },
  accent: {
    primary: '#0078D7',
    primaryHover: '#005A9E',
    primaryForeground: '#FFFFFF',
  },
  popup: {
    background: '#FFFFFF',
    border: '1px solid #999999',
    shadow: '2px 2px 6px rgba(0,0,0,0.2)',
    borderRadius: '0',
    hoverBackground: '#D0E8FF',
  },
};

/** 하위호환: windowsXpTheme = FALLBACK_THEME */
export const windowsXpTheme: ThemeTokens = FALLBACK_THEME;

export function getDefaultTheme(): ThemeTokens {
  return FALLBACK_THEME;
}
