import { describe, it, expect } from 'vitest';
import { FALLBACK_THEME, getDefaultTheme, windowsXpTheme } from '../themes/presets';
import type { ThemeTokens } from '../types/theme';

describe('Theme presets (FALLBACK_THEME)', () => {
  it('FALLBACK_THEME는 windows-xp이다', () => {
    expect(FALLBACK_THEME.id).toBe('windows-xp');
    expect(FALLBACK_THEME.name).toBe('Windows XP');
  });

  it('windowsXpTheme은 FALLBACK_THEME과 같다', () => {
    expect(windowsXpTheme).toBe(FALLBACK_THEME);
  });

  it('getDefaultTheme()은 FALLBACK_THEME을 반환한다', () => {
    expect(getDefaultTheme()).toBe(FALLBACK_THEME);
  });

  describe('ThemeTokens 구조 유효성', () => {
    const theme: ThemeTokens = FALLBACK_THEME;

    it('필수 토큰이 모두 존재한다', () => {
      // window
      expect(theme.window).toBeDefined();
      expect(theme.window.titleBar).toBeDefined();
      expect(theme.window.titleBar.background).toBeTruthy();
      expect(theme.window.titleBar.foreground).toBeTruthy();
      expect(theme.window.titleBar.height).toBeGreaterThan(0);
      expect(theme.window.titleBar.controlButtonsPosition).toMatch(/^(left|right)$/);

      // form
      expect(theme.form.backgroundColor).toBeTruthy();
      expect(theme.form.fontFamily).toBeTruthy();

      // controls
      expect(theme.controls.button.background).toBeTruthy();
      expect(theme.controls.button.border).toBeTruthy();
      expect(theme.controls.textInput.background).toBeTruthy();
      expect(theme.controls.textInput.border).toBeTruthy();
      expect(theme.controls.select.background).toBeTruthy();
      expect(theme.controls.dataGrid.headerBackground).toBeTruthy();
      expect(theme.controls.progressBar.fillBackground).toBeTruthy();
      expect(theme.controls.menuStrip.background).toBeTruthy();
      expect(theme.controls.toolStrip.background).toBeTruthy();
      expect(theme.controls.statusStrip.background).toBeTruthy();

      // accent
      expect(theme.accent.primary).toBeTruthy();

      // popup
      expect(theme.popup.background).toBeTruthy();
    });

    it('Windows XP는 borderRadius 0, 직각 스타일이다', () => {
      expect(theme.window.borderRadius).toBe('0');
      expect(theme.controls.button.borderRadius).toBe('0');
    });
  });
});
