import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ButtonControl } from '../../controls/ButtonControl';

describe('ButtonControl', () => {
  it('기본 props로 렌더링되어야 한다', () => {
    render(
      <ButtonControl
        properties={{}}
        size={{ width: 75, height: 23 }}
      />,
    );

    expect(screen.getByText('Button')).toBeInTheDocument();
  });

  it('text="저장" 전달 시 표시되어야 한다', () => {
    render(
      <ButtonControl
        properties={{ text: '저장' }}
        size={{ width: 75, height: 23 }}
      />,
    );

    expect(screen.getByText('저장')).toBeInTheDocument();
  });
});
