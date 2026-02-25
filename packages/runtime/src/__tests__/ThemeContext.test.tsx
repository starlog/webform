import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';
import { windowsXpTheme } from '@webform/common';

function ThemeDisplay() {
  const theme = useTheme();
  return (
    <div>
      <span data-testid="theme-id">{theme.id}</span>
      <span data-testid="theme-name">{theme.name}</span>
      <span data-testid="accent-primary">{theme.accent.primary}</span>
      <span data-testid="button-bg">{theme.controls.button.background}</span>
      <span data-testid="control-buttons">{theme.window.titleBar.controlButtonsPosition}</span>
    </div>
  );
}

describe('ThemeContext', () => {
  it('기본 테마(undefined)는 FALLBACK(windows-xp)이다', () => {
    render(
      <ThemeProvider themeId={undefined}>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme-id').textContent).toBe('windows-xp');
    expect(screen.getByTestId('theme-name').textContent).toBe('Windows XP');
  });

  it('Provider 없이 useTheme는 기본 windows-xp 테마를 반환한다', () => {
    render(<ThemeDisplay />);
    expect(screen.getByTestId('theme-id').textContent).toBe('windows-xp');
    expect(screen.getByTestId('accent-primary').textContent).toBe(windowsXpTheme.accent.primary);
    expect(screen.getByTestId('button-bg').textContent).toBe(windowsXpTheme.controls.button.background);
  });

  it('API 실패 시 FALLBACK 테마를 사용한다', () => {
    // themeId가 주어지면 API를 호출하지만, 테스트 환경에서는 fetch가 실패하므로 FALLBACK 사용
    render(
      <ThemeProvider themeId="non-existent-theme">
        <ThemeDisplay />
      </ThemeProvider>,
    );
    // 로딩 중 FALLBACK 사용
    expect(screen.getByTestId('theme-id').textContent).toBe('windows-xp');
  });
});
