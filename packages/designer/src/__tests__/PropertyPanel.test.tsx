import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ControlDefinition } from '@webform/common';
import { useDesignerStore } from '../stores/designerStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useHistoryStore } from '../stores/historyStore';
import { PropertyPanel } from '../components/PropertyPanel/PropertyPanel';

function makeButton(overrides: Partial<ControlDefinition> = {}): ControlDefinition {
  return {
    id: 'btn-1',
    type: 'Button',
    name: 'button1',
    properties: { text: 'Click Me', backColor: '#FF0000' },
    position: { x: 10, y: 20 },
    size: { width: 75, height: 23 },
    anchor: { top: true, bottom: false, left: true, right: false },
    dock: 'None',
    tabIndex: 0,
    visible: true,
    enabled: true,
    ...overrides,
  };
}

describe('PropertyPanel', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      controls: [],
      isDirty: false,
      currentFormId: null,
    });
    useSelectionStore.setState({
      selectedIds: new Set<string>(),
      clipboard: [],
    });
    useHistoryStore.setState({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  it('선택 없을 때 "No control selected" 메시지를 표시한다', () => {
    render(<PropertyPanel />);
    expect(screen.getByText('No control selected.')).toBeInTheDocument();
  });

  it('Button 선택 시 Button 속성을 표시한다', () => {
    const button = makeButton();
    useDesignerStore.setState({ controls: [button] });
    useSelectionStore.setState({ selectedIds: new Set(['btn-1']) });

    render(<PropertyPanel />);

    // 헤더에 컨트롤 이름과 타입 표시
    expect(screen.getByText('button1 (Button)')).toBeInTheDocument();

    // Button 속성 라벨들이 표시됨
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('BackColor')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('카테고리순/알파벳순 정렬을 토글할 수 있다', () => {
    const button = makeButton();
    useDesignerStore.setState({ controls: [button] });
    useSelectionStore.setState({ selectedIds: new Set(['btn-1']) });

    render(<PropertyPanel />);

    // 초기: 카테고리순 — A-Z 버튼 표시
    const sortButton = screen.getByTitle('Sort alphabetically');
    expect(sortButton).toBeInTheDocument();
    expect(sortButton.textContent).toBe('A-Z');

    // 카테고리 헤더들이 표시됨
    expect(screen.getByText('Design')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Layout')).toBeInTheDocument();

    // A-Z 클릭 → 알파벳순으로 전환
    fireEvent.click(sortButton);

    // 알파벳순이면 카테고리가 'All' 하나만
    expect(screen.getByText('All')).toBeInTheDocument();

    // 정렬 버튼 title이 변경됨
    const categoryButton = screen.getByTitle('Sort by category');
    expect(categoryButton).toBeInTheDocument();
  });

  it('속성 탭/이벤트 탭을 전환할 수 있다', () => {
    const button = makeButton();
    useDesignerStore.setState({ controls: [button] });
    useSelectionStore.setState({ selectedIds: new Set(['btn-1']) });

    render(<PropertyPanel />);

    // 초기: Properties 탭 활성화 — 속성 라벨 표시
    expect(screen.getByText('Text')).toBeInTheDocument();

    // Events 탭 클릭
    const eventsTab = screen.getByText(/Events/);
    fireEvent.click(eventsTab);

    // 이벤트 목록이 표시됨 (Button은 공통 이벤트만)
    expect(screen.getByText('Click')).toBeInTheDocument();
    expect(screen.getByText('DoubleClick')).toBeInTheDocument();

    // 다시 Properties 탭으로 전환
    const propertiesTab = screen.getByText(/Properties/);
    fireEvent.click(propertiesTab);

    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('다중 선택 시 선택 개수 메시지를 표시한다', () => {
    useDesignerStore.setState({ controls: [makeButton({ id: 'a' }), makeButton({ id: 'b' })] });
    useSelectionStore.setState({ selectedIds: new Set(['a', 'b']) });

    render(<PropertyPanel />);
    expect(screen.getByText('2 controls selected.')).toBeInTheDocument();
  });
});
