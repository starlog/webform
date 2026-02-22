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

    const div = container.firstElementChild as HTMLElement;
    expect(div).toBeInTheDocument();
    expect(div.style.whiteSpace).toBe('nowrap');
  });

  it('multiline=true 시 여러 줄 렌더링되어야 한다', () => {
    const { container } = render(
      <TextBoxControl
        properties={{ multiline: true }}
        size={{ width: 100, height: 80 }}
      />,
    );

    const div = container.firstElementChild as HTMLElement;
    expect(div).toBeInTheDocument();
    expect(div.style.whiteSpace).toBe('pre-wrap');
  });
});
