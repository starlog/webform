import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Toolbox } from '../components/Toolbox/Toolbox';

function renderWithDnd(ui: React.ReactElement) {
  return render(<DndProvider backend={HTML5Backend}>{ui}</DndProvider>);
}

describe('Toolbox', () => {
  it('Button, Label, TextBox 등 컨트롤명이 표시되어야 한다', () => {
    renderWithDnd(<Toolbox />);

    expect(screen.getByText('Button')).toBeInTheDocument();
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByText('TextBox')).toBeInTheDocument();
  });

  it('카테고리 헤더가 표시되어야 한다', () => {
    renderWithDnd(<Toolbox />);

    expect(screen.getByText('기본 컨트롤')).toBeInTheDocument();
    expect(screen.getByText('컨테이너')).toBeInTheDocument();
  });
});
