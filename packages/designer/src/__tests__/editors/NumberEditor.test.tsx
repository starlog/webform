import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumberEditor } from '../../components/PropertyPanel/editors/NumberEditor';

describe('NumberEditor', () => {
  it('숫자 변경 시 onBlur에서 onChange 콜백이 호출된다', () => {
    const onChange = vi.fn();
    render(<NumberEditor value={10} onChange={onChange} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('Enter 키로도 값이 커밋된다', () => {
    const onChange = vi.fn();
    render(<NumberEditor value={0} onChange={onChange} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(99);
  });

  it('min 제한: min보다 작은 값은 min으로 클램프된다', () => {
    const onChange = vi.fn();
    render(<NumberEditor value={5} onChange={onChange} min={0} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '-10' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('max 제한: max보다 큰 값은 max로 클램프된다', () => {
    const onChange = vi.fn();
    render(<NumberEditor value={50} onChange={onChange} max={100} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '200' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('min/max 동시 제한이 적용된다', () => {
    const onChange = vi.fn();
    render(<NumberEditor value={50} onChange={onChange} min={0} max={100} />);

    const input = screen.getByRole('spinbutton');

    // max 초과
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(100);

    // min 미만
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('NaN 입력 시 0으로 변환된다', () => {
    const onChange = vi.fn();
    render(<NumberEditor value={10} onChange={onChange} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(0);
  });
});
