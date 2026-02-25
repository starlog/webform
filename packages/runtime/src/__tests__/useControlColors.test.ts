import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { getDefaultTheme } from '@webform/common';
import { useControlColors } from '../theme/useControlColors';
import { ThemeProvider } from '../theme/ThemeContext';
import { ThemeColorModeProvider } from '../theme/ThemeColorModeContext';

function createWrapper(mode: 'theme' | 'control') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      ThemeProvider,
      { themeId: undefined, children: createElement(ThemeColorModeProvider, { mode, children }) },
    );
  };
}

const theme = getDefaultTheme();

describe('useControlColors', () => {
  describe('control mode (기본값)', () => {
    const wrapper = createWrapper('control');

    it('backColor/foreColor 미지정 시 테마 토큰 반환', () => {
      const { result } = renderHook(
        () => useControlColors('Button', {}),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe(theme.controls.button.background);
      expect(result.current.color).toBe(theme.controls.button.foreground);
    });

    it('backColor 지정 시 개별 색상 우선', () => {
      const { result } = renderHook(
        () => useControlColors('Button', { backColor: '#ff0000' }),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe('#ff0000');
      expect(result.current.color).toBe(theme.controls.button.foreground);
    });

    it('foreColor 지정 시 개별 색상 우선', () => {
      const { result } = renderHook(
        () => useControlColors('Button', { foreColor: '#00ff00' }),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe(theme.controls.button.background);
      expect(result.current.color).toBe('#00ff00');
    });

    it('backColor + foreColor 모두 지정 시 개별 색상 우선', () => {
      const { result } = renderHook(
        () => useControlColors('Button', { backColor: '#ff0000', foreColor: '#00ff00' }),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe('#ff0000');
      expect(result.current.color).toBe('#00ff00');
    });
  });

  describe('theme mode', () => {
    const wrapper = createWrapper('theme');

    it('backColor/foreColor 무시하고 테마 토큰 반환', () => {
      const { result } = renderHook(
        () => useControlColors('Button', { backColor: '#ff0000', foreColor: '#00ff00' }),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe(theme.controls.button.background);
      expect(result.current.color).toBe(theme.controls.button.foreground);
    });

    it('개별 색상 미지정 시에도 테마 토큰 반환', () => {
      const { result } = renderHook(
        () => useControlColors('TextBox', {}),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe(theme.controls.textInput.background);
      expect(result.current.color).toBe(theme.controls.textInput.foreground);
    });
  });

  describe('컨트롤 타입별 올바른 테마 토큰 매핑', () => {
    const wrapper = createWrapper('control');

    it('TextBox → textInput 토큰', () => {
      const { result } = renderHook(
        () => useControlColors('TextBox', {}),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe(theme.controls.textInput.background);
      expect(result.current.color).toBe(theme.controls.textInput.foreground);
    });

    it('ComboBox → select 토큰', () => {
      const { result } = renderHook(
        () => useControlColors('ComboBox', {}),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe(theme.controls.select.background);
      expect(result.current.color).toBe(theme.controls.select.foreground);
    });

    it('Panel → panel 토큰', () => {
      const { result } = renderHook(
        () => useControlColors('Panel', {}),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe(theme.controls.panel.background);
    });

    it('MenuStrip → menuStrip 토큰', () => {
      const { result } = renderHook(
        () => useControlColors('MenuStrip', {}),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe(theme.controls.menuStrip.background);
      expect(result.current.color).toBe(theme.controls.menuStrip.foreground);
    });

    it('StatusStrip → statusStrip 토큰', () => {
      const { result } = renderHook(
        () => useControlColors('StatusStrip', {}),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe(theme.controls.statusStrip.background);
      expect(result.current.color).toBe(theme.controls.statusStrip.foreground);
    });

    it('ProgressBar → progressBar 토큰', () => {
      const { result } = renderHook(
        () => useControlColors('ProgressBar', {}),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe(theme.controls.progressBar.background);
    });

    it('Label → form 토큰', () => {
      const { result } = renderHook(
        () => useControlColors('Label', {}),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe(theme.form.backgroundColor);
      expect(result.current.color).toBe(theme.form.foreground);
    });

    it('DataGridView → dataGrid 토큰', () => {
      const { result } = renderHook(
        () => useControlColors('DataGridView', {}),
        { wrapper },
      );
      expect(result.current.backgroundColor).toBe(theme.controls.dataGrid.rowBackground);
      expect(result.current.color).toBe(theme.controls.dataGrid.rowForeground);
    });
  });
});
