import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';
import { windowsXpTheme, ubuntu2004Theme, macosTahoeTheme } from '@webform/common';

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
  it('기본 테마(undefined)는 windows-xp이다', () => {
    render(
      <ThemeProvider themeId={undefined}>
        <ThemeDisplay />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme-id').textContent).toBe('windows-xp');
    expect(screen.getByTestId('theme-name').textContent).toBe('Windows XP');
  });

  it('windows-xp 테마를 올바르게 제공한다', () => {
    render(
      <ThemeProvider themeId="windows-xp">
        <ThemeDisplay />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme-id').textContent).toBe('windows-xp');
    expect(screen.getByTestId('accent-primary').textContent).toBe(windowsXpTheme.accent.primary);
    expect(screen.getByTestId('button-bg').textContent).toBe(windowsXpTheme.controls.button.background);
  });

  it('ubuntu-2004 테마를 올바르게 제공한다', () => {
    render(
      <ThemeProvider themeId="ubuntu-2004">
        <ThemeDisplay />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme-id').textContent).toBe('ubuntu-2004');
    expect(screen.getByTestId('accent-primary').textContent).toBe(ubuntu2004Theme.accent.primary);
  });

  it('macos-tahoe 테마를 올바르게 제공한다', () => {
    render(
      <ThemeProvider themeId="macos-tahoe">
        <ThemeDisplay />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme-id').textContent).toBe('macos-tahoe');
    expect(screen.getByTestId('accent-primary').textContent).toBe(macosTahoeTheme.accent.primary);
    expect(screen.getByTestId('control-buttons').textContent).toBe('left');
  });

  it('Provider 없이 useTheme는 기본 windows-xp 테마를 반환한다', () => {
    render(<ThemeDisplay />);
    expect(screen.getByTestId('theme-id').textContent).toBe('windows-xp');
  });
});
