import { describe, it, expect } from 'vitest';
import {
  getThemeById,
  THEME_IDS,
  windowsXpTheme,
  ubuntu2004Theme,
  macosTahoeTheme,
  vibrantNeonTheme,
} from '../themes/presets';
import type { ThemeTokens } from '../types/theme';

describe('Theme presets', () => {
  it('THEME_IDS에 4개 테마가 정의되어 있다', () => {
    expect(THEME_IDS).toHaveLength(4);
    expect(THEME_IDS).toContain('windows-xp');
    expect(THEME_IDS).toContain('ubuntu-2004');
    expect(THEME_IDS).toContain('macos-tahoe');
    expect(THEME_IDS).toContain('vibrant-neon');
  });

  it('각 프리셋의 id와 name이 올바르다', () => {
    expect(windowsXpTheme.id).toBe('windows-xp');
    expect(windowsXpTheme.name).toBe('Windows XP');

    expect(ubuntu2004Theme.id).toBe('ubuntu-2004');
    expect(ubuntu2004Theme.name).toBe('Ubuntu 20.04');

    expect(macosTahoeTheme.id).toBe('macos-tahoe');
    expect(macosTahoeTheme.name).toBe('macOS Tahoe');

    expect(vibrantNeonTheme.id).toBe('vibrant-neon');
    expect(vibrantNeonTheme.name).toBe('Vibrant Neon');
  });

  it.each(THEME_IDS)('getThemeById("%s")가 올바른 테마를 반환한다', (id) => {
    const theme = getThemeById(id);
    expect(theme.id).toBe(id);
  });

  it('getThemeById(undefined)는 windows-xp를 반환한다', () => {
    const theme = getThemeById(undefined);
    expect(theme.id).toBe('windows-xp');
  });

  describe('ThemeTokens 구조 유효성', () => {
    const themes: ThemeTokens[] = [windowsXpTheme, ubuntu2004Theme, macosTahoeTheme, vibrantNeonTheme];

    it.each(themes.map((t) => [t.name, t] as const))(
      '%s 테마에 필수 토큰이 모두 존재한다',
      (_name, theme) => {
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
      },
    );
  });

  describe('테마 차별점 검증', () => {
    it('Windows XP는 borderRadius 0, 직각 스타일이다', () => {
      expect(windowsXpTheme.window.borderRadius).toBe('0');
      expect(windowsXpTheme.controls.button.borderRadius).toBe('0');
    });

    it('Ubuntu는 둥근 borderRadius를 사용한다', () => {
      expect(windowsXpTheme.controls.button.borderRadius).not.toBe(
        ubuntu2004Theme.controls.button.borderRadius,
      );
      expect(ubuntu2004Theme.controls.button.borderRadius).toBe('5px');
    });

    it('macOS는 왼쪽 컨트롤 버튼 위치를 사용한다', () => {
      expect(macosTahoeTheme.window.titleBar.controlButtonsPosition).toBe('left');
      expect(windowsXpTheme.window.titleBar.controlButtonsPosition).toBe('right');
      expect(ubuntu2004Theme.window.titleBar.controlButtonsPosition).toBe('right');
    });

    it('Vibrant Neon은 다크 배경과 둥근 모서리를 사용한다', () => {
      expect(vibrantNeonTheme.form.backgroundColor).toBe('#1A1B2E');
      expect(vibrantNeonTheme.window.borderRadius).toBe('12px');
      expect(vibrantNeonTheme.controls.button.borderRadius).toBe('8px');
    });

    it('각 테마의 accent 색상이 다르다', () => {
      const accents = new Set([
        windowsXpTheme.accent.primary,
        ubuntu2004Theme.accent.primary,
        macosTahoeTheme.accent.primary,
        vibrantNeonTheme.accent.primary,
      ]);
      expect(accents.size).toBe(4);
    });
  });
});
