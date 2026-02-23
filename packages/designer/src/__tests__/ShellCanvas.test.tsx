import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ShellCanvas } from '../components/Canvas/ShellCanvas';
import { useDesignerStore } from '../stores/designerStore';

function renderWithDnd(ui: React.ReactElement) {
  return render(<DndProvider backend={HTML5Backend}>{ui}</DndProvider>);
}

describe('ShellCanvas', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      editMode: 'shell',
      shellControls: [],
      shellProperties: {
        title: 'Application',
        width: 1200,
        height: 800,
        backgroundColor: '#F0F0F0',
        font: {
          family: 'Segoe UI',
          size: 9,
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
        },
        showTitleBar: true,
        formBorderStyle: 'Sizable',
        maximizeBox: true,
        minimizeBox: true,
      },
      currentShellId: null,
    });
  });

  it('기본 렌더링이 정상적으로 동작한다', () => {
    const { container } = renderWithDnd(<ShellCanvas />);
    expect(container.firstChild).toBeTruthy();
  });

  it('Top 영역이 존재한다', () => {
    renderWithDnd(<ShellCanvas />);
    expect(screen.getByText('MenuStrip/ToolStrip을 여기에 드롭')).toBeInTheDocument();
  });

  it('Bottom 영역이 존재한다', () => {
    renderWithDnd(<ShellCanvas />);
    expect(screen.getByText('StatusStrip을 여기에 드롭')).toBeInTheDocument();
  });

  it('Middle 영역에 "폼이 여기에 표시됩니다" 텍스트가 존재한다', () => {
    renderWithDnd(<ShellCanvas />);
    expect(screen.getByText('폼이 여기에 표시됩니다')).toBeInTheDocument();
  });

  it('shellProperties의 크기가 반영된다', () => {
    useDesignerStore.setState({
      shellProperties: {
        ...useDesignerStore.getState().shellProperties,
        width: 1024,
        height: 768,
      },
    });

    const { container } = renderWithDnd(<ShellCanvas />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.width).toBe('1024px');
    expect(root.style.height).toBe('768px');
  });

  it('shellProperties의 배경색이 반영된다', () => {
    useDesignerStore.setState({
      shellProperties: {
        ...useDesignerStore.getState().shellProperties,
        backgroundColor: '#FFFFFF',
      },
    });

    const { container } = renderWithDnd(<ShellCanvas />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.backgroundColor).toBe('rgb(255, 255, 255)');
  });
});
