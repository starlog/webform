import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Toolbox } from '../components/Toolbox/Toolbox';
import { useDesignerStore } from '../stores/designerStore';

function renderWithDnd(ui: React.ReactElement) {
  return render(<DndProvider backend={HTML5Backend}>{ui}</DndProvider>);
}

describe('Toolbox - Shell 모드', () => {
  beforeEach(() => {
    useDesignerStore.setState({ editMode: 'form' });
  });

  it('editMode="shell"일 때 MenuStrip, ToolStrip, StatusStrip, Panel만 표시된다', () => {
    useDesignerStore.setState({ editMode: 'shell' });
    renderWithDnd(<Toolbox />);

    // Shell 허용 컨트롤이 표시되어야 함
    expect(screen.getByText('MenuStrip')).toBeInTheDocument();
    expect(screen.getByText('ToolStrip')).toBeInTheDocument();
    expect(screen.getByText('StatusStrip')).toBeInTheDocument();
    expect(screen.getByText('Panel')).toBeInTheDocument();

    // Shell에서 허용되지 않는 컨트롤은 표시되지 않아야 함
    expect(screen.queryByText('Button')).not.toBeInTheDocument();
    expect(screen.queryByText('Label')).not.toBeInTheDocument();
    expect(screen.queryByText('TextBox')).not.toBeInTheDocument();
    expect(screen.queryByText('CheckBox')).not.toBeInTheDocument();
    expect(screen.queryByText('DataGridView')).not.toBeInTheDocument();
  });

  it('editMode="shell"일 때 "Shell 도구 상자" 헤더가 표시된다', () => {
    useDesignerStore.setState({ editMode: 'shell' });
    renderWithDnd(<Toolbox />);

    expect(screen.getByText('Shell 도구 상자')).toBeInTheDocument();
  });

  it('editMode="form"일 때 모든 컨트롤이 표시된다', () => {
    useDesignerStore.setState({ editMode: 'form' });
    renderWithDnd(<Toolbox />);

    // 기본 컨트롤
    expect(screen.getByText('Button')).toBeInTheDocument();
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByText('TextBox')).toBeInTheDocument();
    expect(screen.getByText('CheckBox')).toBeInTheDocument();

    // 컨테이너
    expect(screen.getByText('Panel')).toBeInTheDocument();
    expect(screen.getByText('GroupBox')).toBeInTheDocument();
    expect(screen.getByText('TabControl')).toBeInTheDocument();

    // 데이터
    expect(screen.getByText('DataGridView')).toBeInTheDocument();

    // Shell 컨트롤도 form 모드에서는 표시됨
    expect(screen.getByText('MenuStrip')).toBeInTheDocument();
    expect(screen.getByText('ToolStrip')).toBeInTheDocument();
    expect(screen.getByText('StatusStrip')).toBeInTheDocument();
  });

  it('editMode="form"일 때 "도구 상자" 헤더가 표시된다', () => {
    useDesignerStore.setState({ editMode: 'form' });
    renderWithDnd(<Toolbox />);

    expect(screen.getByText('도구 상자')).toBeInTheDocument();
  });
});
