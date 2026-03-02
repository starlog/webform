import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TextBoxControl } from '../../controls/TextBoxControl';

describe('TextBoxControl', () => {
  it('기본 단일행으로 렌더링되어야 한다', () => {
    const { container } = render(
      <TextBoxControl
        properties={{}}
        size={{ width: 100, height: 23 }}
      />,
    );

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('text');
  });

  it('multiline=true 시 textarea로 렌더링되어야 한다', () => {
    const { container } = render(
      <TextBoxControl
        properties={{ multiline: true }}
        size={{ width: 100, height: 80 }}
      />,
    );

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.style.resize).toBe('none');
  });
});
