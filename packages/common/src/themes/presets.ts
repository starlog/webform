import type { PresetThemeId, ThemeId, ThemeTokens } from '../types/theme';

export const windowsXpTheme: ThemeTokens = {
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
      border: '1px solid #999999',
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
      headerBorder: '1px solid #C0C0C0',
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

export const ubuntu2004Theme: ThemeTokens = {
  id: 'ubuntu-2004',
  name: 'Ubuntu 20.04',
  window: {
    titleBar: {
      background: '#3C3C3C',
      foreground: '#FFFFFF',
      height: 36,
      font: '13px Ubuntu, "Noto Sans", sans-serif',
      borderRadius: '10px 10px 0 0',
      controlButtonsPosition: 'right',
    },
    border: '1px solid #2C2C2C',
    borderRadius: '10px',
    shadow: '0 4px 16px rgba(0,0,0,0.3)',
  },
  form: {
    backgroundColor: '#F6F5F4',
    foreground: '#3D3846',
    fontFamily: 'Ubuntu, "Noto Sans", sans-serif',
    fontSize: '13px',
  },
  controls: {
    button: {
      background: '#FFFFFF',
      border: '1px solid #CDCDC9',
      borderRadius: '5px',
      foreground: '#3D3846',
      hoverBackground: '#F0EFED',
      padding: '4px 16px',
    },
    textInput: {
      background: '#FFFFFF',
      border: '1px solid #CDCDC9',
      borderRadius: '5px',
      foreground: '#3D3846',
      focusBorder: '1px solid #E95420',
      padding: '4px 8px',
    },
    select: {
      background: '#FFFFFF',
      border: '1px solid #CDCDC9',
      borderRadius: '5px',
      foreground: '#3D3846',
      selectedBackground: '#E95420',
      selectedForeground: '#FFFFFF',
    },
    checkRadio: {
      border: '1px solid #CDCDC9',
      background: '#FFFFFF',
      checkedBackground: '#E95420',
      borderRadius: '3px',
    },
    panel: {
      background: 'transparent',
      border: '1px solid #CDCDC9',
      borderRadius: '8px',
    },
    groupBox: {
      border: '1px solid #CDCDC9',
      borderRadius: '8px',
      foreground: '#3D3846',
    },
    tabControl: {
      tabBackground: '#E8E7E5',
      tabActiveBackground: '#FFFFFF',
      tabBorder: '1px solid #CDCDC9',
      tabBorderRadius: '8px 8px 0 0',
      tabForeground: '#77767B',
      tabActiveForeground: '#3D3846',
      contentBackground: '#FFFFFF',
      contentBorder: '1px solid #CDCDC9',
    },
    dataGrid: {
      headerBackground: '#E8E7E5',
      headerForeground: '#3D3846',
      headerBorder: '1px solid #CDCDC9',
      rowBackground: '#FFFFFF',
      rowAlternateBackground: '#F8F7F6',
      rowForeground: '#3D3846',
      border: '1px solid #CDCDC9',
      borderRadius: '8px',
      selectedRowBackground: '#E95420',
      selectedRowForeground: '#FFFFFF',
    },
    progressBar: {
      background: '#E8E7E5',
      fillBackground: '#E95420',
      border: '1px solid #CDCDC9',
      borderRadius: '5px',
    },
    menuStrip: {
      background: '#3C3C3C',
      foreground: '#FFFFFF',
      border: 'none',
      hoverBackground: '#505050',
      hoverForeground: '#FFFFFF',
      activeBackground: '#E95420',
    },
    toolStrip: {
      background: '#F6F5F4',
      foreground: '#3D3846',
      border: '1px solid #CDCDC9',
      buttonHoverBackground: '#E8E7E5',
      separator: '#CDCDC9',
    },
    statusStrip: {
      background: '#F6F5F4',
      foreground: '#77767B',
      border: '1px solid #CDCDC9',
    },
    scrollbar: {
      trackBackground: 'transparent',
      thumbBackground: '#C0BFBC',
      thumbHoverBackground: '#9A9996',
      width: 8,
    },
  },
  accent: {
    primary: '#E95420',
    primaryHover: '#C7431A',
    primaryForeground: '#FFFFFF',
  },
  popup: {
    background: '#FFFFFF',
    border: '1px solid #CDCDC9',
    shadow: '0 4px 12px rgba(0,0,0,0.15)',
    borderRadius: '8px',
    hoverBackground: '#F0EFED',
  },
};

export const macosTahoeTheme: ThemeTokens = {
  id: 'macos-tahoe',
  name: 'macOS Tahoe',
  window: {
    titleBar: {
      background: 'linear-gradient(to bottom, #ECECEC, #E0E0E0)',
      foreground: '#333333',
      height: 28,
      font: '13px -apple-system, BlinkMacSystemFont, "SF Pro", "Helvetica Neue", sans-serif',
      borderRadius: '10px 10px 0 0',
      controlButtonsPosition: 'left',
    },
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: '10px',
    shadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
  },
  form: {
    backgroundColor: '#FFFFFF',
    foreground: '#1D1D1F',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro", "Helvetica Neue", sans-serif',
    fontSize: '13px',
  },
  controls: {
    button: {
      background: '#FFFFFF',
      border: '1px solid rgba(0,0,0,0.12)',
      borderRadius: '6px',
      foreground: '#1D1D1F',
      hoverBackground: '#F5F5F7',
      padding: '3px 12px',
    },
    textInput: {
      background: '#FFFFFF',
      border: '1px solid rgba(0,0,0,0.12)',
      borderRadius: '6px',
      foreground: '#1D1D1F',
      focusBorder: '2px solid #007AFF',
      padding: '3px 8px',
    },
    select: {
      background: '#FFFFFF',
      border: '1px solid rgba(0,0,0,0.12)',
      borderRadius: '6px',
      foreground: '#1D1D1F',
      selectedBackground: '#007AFF',
      selectedForeground: '#FFFFFF',
    },
    checkRadio: {
      border: '1px solid rgba(0,0,0,0.2)',
      background: '#FFFFFF',
      checkedBackground: '#007AFF',
      borderRadius: '4px',
    },
    panel: {
      background: 'transparent',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: '8px',
    },
    groupBox: {
      border: '1px solid rgba(0,0,0,0.1)',
      borderRadius: '8px',
      foreground: '#1D1D1F',
    },
    tabControl: {
      tabBackground: '#F5F5F7',
      tabActiveBackground: '#FFFFFF',
      tabBorder: '1px solid rgba(0,0,0,0.1)',
      tabBorderRadius: '6px 6px 0 0',
      tabForeground: '#86868B',
      tabActiveForeground: '#1D1D1F',
      contentBackground: '#FFFFFF',
      contentBorder: '1px solid rgba(0,0,0,0.1)',
    },
    dataGrid: {
      headerBackground: '#F5F5F7',
      headerForeground: '#86868B',
      headerBorder: '1px solid rgba(0,0,0,0.08)',
      rowBackground: '#FFFFFF',
      rowAlternateBackground: '#FAFAFA',
      rowForeground: '#1D1D1F',
      border: '1px solid rgba(0,0,0,0.1)',
      borderRadius: '8px',
      selectedRowBackground: '#007AFF',
      selectedRowForeground: '#FFFFFF',
    },
    progressBar: {
      background: '#E5E5EA',
      fillBackground: '#007AFF',
      border: 'none',
      borderRadius: '4px',
    },
    menuStrip: {
      background: 'rgba(246,246,246,0.8)',
      foreground: '#1D1D1F',
      border: '1px solid rgba(0,0,0,0.06)',
      hoverBackground: 'rgba(0,122,255,0.1)',
      hoverForeground: '#1D1D1F',
      activeBackground: '#007AFF',
    },
    toolStrip: {
      background: '#F5F5F7',
      foreground: '#1D1D1F',
      border: '1px solid rgba(0,0,0,0.08)',
      buttonHoverBackground: 'rgba(0,0,0,0.05)',
      separator: 'rgba(0,0,0,0.1)',
    },
    statusStrip: {
      background: '#F5F5F7',
      foreground: '#86868B',
      border: '1px solid rgba(0,0,0,0.06)',
    },
    scrollbar: {
      trackBackground: 'transparent',
      thumbBackground: 'rgba(0,0,0,0.2)',
      thumbHoverBackground: 'rgba(0,0,0,0.4)',
      width: 8,
    },
  },
  accent: {
    primary: '#007AFF',
    primaryHover: '#005ECB',
    primaryForeground: '#FFFFFF',
  },
  popup: {
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.1)',
    shadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
    borderRadius: '10px',
    hoverBackground: '#F5F5F7',
  },
};

export const vibrantNeonTheme: ThemeTokens = {
  id: 'vibrant-neon',
  name: 'Vibrant Neon',
  window: {
    titleBar: {
      background: 'linear-gradient(to right, #7C3AED, #DB2777)',
      foreground: '#FFFFFF',
      height: 34,
      font: '13px "Inter", "Segoe UI", sans-serif',
      borderRadius: '12px 12px 0 0',
      controlButtonsPosition: 'right',
    },
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '12px',
    shadow: '0 8px 32px rgba(124, 58, 237, 0.25), 0 0 16px rgba(219, 39, 119, 0.15)',
  },
  form: {
    backgroundColor: '#1A1B2E',
    foreground: '#E8E8F0',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    fontSize: '13px',
  },
  controls: {
    button: {
      background: 'linear-gradient(135deg, #7C3AED, #9333EA)',
      border: '1px solid rgba(139, 92, 246, 0.4)',
      borderRadius: '8px',
      foreground: '#FFFFFF',
      hoverBackground: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
      padding: '4px 16px',
    },
    textInput: {
      background: '#252640',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      borderRadius: '8px',
      foreground: '#E8E8F0',
      focusBorder: '2px solid #A855F7',
      padding: '4px 8px',
    },
    select: {
      background: '#252640',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      borderRadius: '8px',
      foreground: '#E8E8F0',
      selectedBackground: '#7C3AED',
      selectedForeground: '#FFFFFF',
    },
    checkRadio: {
      border: '1px solid rgba(139, 92, 246, 0.4)',
      background: '#252640',
      checkedBackground: '#A855F7',
      borderRadius: '4px',
    },
    panel: {
      background: 'rgba(37, 38, 64, 0.6)',
      border: '1px solid rgba(139, 92, 246, 0.2)',
      borderRadius: '10px',
    },
    groupBox: {
      border: '1px solid rgba(139, 92, 246, 0.25)',
      borderRadius: '10px',
      foreground: '#C4B5FD',
    },
    tabControl: {
      tabBackground: '#1E1F33',
      tabActiveBackground: '#2D2E4A',
      tabBorder: '1px solid rgba(139, 92, 246, 0.2)',
      tabBorderRadius: '8px 8px 0 0',
      tabForeground: '#8B8BA3',
      tabActiveForeground: '#C4B5FD',
      contentBackground: '#2D2E4A',
      contentBorder: '1px solid rgba(139, 92, 246, 0.2)',
    },
    dataGrid: {
      headerBackground: '#252640',
      headerForeground: '#C4B5FD',
      headerBorder: '1px solid rgba(139, 92, 246, 0.2)',
      rowBackground: '#1E1F33',
      rowAlternateBackground: '#232442',
      rowForeground: '#E8E8F0',
      border: '1px solid rgba(139, 92, 246, 0.2)',
      borderRadius: '10px',
      selectedRowBackground: '#7C3AED',
      selectedRowForeground: '#FFFFFF',
    },
    progressBar: {
      background: '#252640',
      fillBackground: 'linear-gradient(to right, #7C3AED, #EC4899)',
      border: '1px solid rgba(139, 92, 246, 0.2)',
      borderRadius: '6px',
    },
    menuStrip: {
      background: '#16172B',
      foreground: '#E8E8F0',
      border: '1px solid rgba(139, 92, 246, 0.15)',
      hoverBackground: 'rgba(124, 58, 237, 0.2)',
      hoverForeground: '#FFFFFF',
      activeBackground: '#7C3AED',
    },
    toolStrip: {
      background: '#1E1F33',
      foreground: '#C4B5FD',
      border: '1px solid rgba(139, 92, 246, 0.15)',
      buttonHoverBackground: 'rgba(124, 58, 237, 0.2)',
      separator: 'rgba(139, 92, 246, 0.2)',
    },
    statusStrip: {
      background: '#16172B',
      foreground: '#8B8BA3',
      border: '1px solid rgba(139, 92, 246, 0.15)',
    },
    scrollbar: {
      trackBackground: 'transparent',
      thumbBackground: 'rgba(139, 92, 246, 0.3)',
      thumbHoverBackground: 'rgba(139, 92, 246, 0.5)',
      width: 8,
    },
  },
  accent: {
    primary: '#A855F7',
    primaryHover: '#7C3AED',
    primaryForeground: '#FFFFFF',
  },
  popup: {
    background: '#252640',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    shadow: '0 8px 24px rgba(124, 58, 237, 0.2), 0 0 12px rgba(168, 85, 247, 0.1)',
    borderRadius: '10px',
    hoverBackground: 'rgba(124, 58, 237, 0.15)',
  },
};

const themeMap: Record<PresetThemeId, ThemeTokens> = {
  'windows-xp': windowsXpTheme,
  'ubuntu-2004': ubuntu2004Theme,
  'macos-tahoe': macosTahoeTheme,
  'vibrant-neon': vibrantNeonTheme,
};

export const PRESET_THEME_IDS: PresetThemeId[] = ['windows-xp', 'ubuntu-2004', 'macos-tahoe', 'vibrant-neon'];

/** @deprecated Use PRESET_THEME_IDS */
export const THEME_IDS: PresetThemeId[] = PRESET_THEME_IDS;

export function isPresetTheme(id: string): id is PresetThemeId {
  return PRESET_THEME_IDS.includes(id as PresetThemeId);
}

export function getDefaultTheme(): ThemeTokens {
  return windowsXpTheme;
}

export function getPresetThemeById(id: PresetThemeId): ThemeTokens {
  return themeMap[id] ?? windowsXpTheme;
}

export function getThemeById(id: ThemeId | undefined): ThemeTokens {
  if (!id) return windowsXpTheme;
  return themeMap[id as PresetThemeId] ?? windowsXpTheme;
}
