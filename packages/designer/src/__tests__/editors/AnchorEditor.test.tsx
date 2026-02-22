import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnchorEditor } from '../../components/PropertyPanel/editors/AnchorEditor';

describe('AnchorEditor', () => {
  it('Top,Left 값일 때 Top, Left 체크박스만 체크되어 있다', () => {
    const onChange = vi.fn();
    render(
      <AnchorEditor
        value={{ top: true, bottom: false, left: true, right: false }}
        onChange={onChange}
      />,
    );

    const topCheckbox = screen.getByRole('checkbox', { name: 'Top' });
    const bottomCheckbox = screen.getByRole('checkbox', { name: 'Bottom' });
    const leftCheckbox = screen.getByRole('checkbox', { name: 'Left' });
    const rightCheckbox = screen.getByRole('checkbox', { name: 'Right' });

    expect(topCheckbox).toBeChecked();
    expect(leftCheckbox).toBeChecked();
    expect(bottomCheckbox).not.toBeChecked();
    expect(rightCheckbox).not.toBeChecked();
  });

  it('Bottom 체크박스 클릭 시 onChange가 bottom: true로 호출된다', () => {
    const onChange = vi.fn();
    render(
      <AnchorEditor
        value={{ top: true, bottom: false, left: true, right: false }}
        onChange={onChange}
      />,
    );

    const bottomCheckbox = screen.getByRole('checkbox', { name: 'Bottom' });
    fireEvent.click(bottomCheckbox);

    expect(onChange).toHaveBeenCalledWith({
      top: true,
      bottom: true,
      left: true,
      right: false,
    });
  });

  it('이미 체크된 Top을 클릭하면 top: false로 토글된다', () => {
    const onChange = vi.fn();
    render(
      <AnchorEditor
        value={{ top: true, bottom: false, left: true, right: false }}
        onChange={onChange}
      />,
    );

    const topCheckbox = screen.getByRole('checkbox', { name: 'Top' });
    fireEvent.click(topCheckbox);

    expect(onChange).toHaveBeenCalledWith({
      top: false,
      bottom: false,
      left: true,
      right: false,
    });
  });

  it('모든 방향이 체크된 상태를 올바르게 표시한다', () => {
    const onChange = vi.fn();
    render(
      <AnchorEditor
        value={{ top: true, bottom: true, left: true, right: true }}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Top' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Bottom' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Left' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Right' })).toBeChecked();
  });
});
