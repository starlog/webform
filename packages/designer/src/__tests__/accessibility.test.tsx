import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { ControlDefinition } from '@webform/common';
import { Toolbox } from '../components/Toolbox/Toolbox';
import { PropertyPanel } from '../components/PropertyPanel/PropertyPanel';
import { PropertyCategory } from '../components/PropertyPanel/PropertyCategory';
import { ElementTreeNode, type TreeNode } from '../components/ElementList/ElementTreeNode';
import { ZOrderContextMenu } from '../components/ZOrderContextMenu';
import { useDesignerStore } from '../stores/designerStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useHistoryStore } from '../stores/historyStore';

function renderWithDnd(ui: React.ReactElement) {
  return render(<DndProvider backend={HTML5Backend}>{ui}</DndProvider>);
}

function makeButton(overrides: Partial<ControlDefinition> = {}): ControlDefinition {
  return {
    id: 'btn-1',
    type: 'Button',
    name: 'button1',
    properties: { text: 'Click Me' },
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

// ─── Toolbox 접근성 테스트 ───────────────────────────────────

describe('Toolbox 접근성', () => {
  it('toolbar role과 aria-label이 설정되어야 한다', () => {
    renderWithDnd(<Toolbox />);
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toBeInTheDocument();
    expect(toolbar).toHaveAttribute('aria-label', '도구 상자');
  });

  it('카테고리 헤더에 role="button"과 aria-expanded가 설정되어야 한다', () => {
    renderWithDnd(<Toolbox />);
    const categoryButtons = screen.getAllByRole('button');
    // 카테고리 헤더는 aria-expanded 속성을 가짐
    const expandableButtons = categoryButtons.filter((btn) =>
      btn.hasAttribute('aria-expanded'),
    );
    expect(expandableButtons.length).toBeGreaterThan(0);
    // 초기 상태에서 모두 펼쳐져 있어야 함
    expandableButtons.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('카테고리 헤더에서 Enter 키로 접기/펼치기가 동작해야 한다', () => {
    renderWithDnd(<Toolbox />);
    const expandableButtons = screen.getAllByRole('button').filter((btn) =>
      btn.hasAttribute('aria-expanded'),
    );
    const firstCategory = expandableButtons[0];

    // Enter 키로 접기
    fireEvent.keyDown(firstCategory, { key: 'Enter' });
    expect(firstCategory).toHaveAttribute('aria-expanded', 'false');

    // Enter 키로 펼치기
    fireEvent.keyDown(firstCategory, { key: 'Enter' });
    expect(firstCategory).toHaveAttribute('aria-expanded', 'true');
  });

  it('카테고리 헤더에서 Space 키로 접기/펼치기가 동작해야 한다', () => {
    renderWithDnd(<Toolbox />);
    const expandableButtons = screen.getAllByRole('button').filter((btn) =>
      btn.hasAttribute('aria-expanded'),
    );
    const firstCategory = expandableButtons[0];

    // Space 키로 접기
    fireEvent.keyDown(firstCategory, { key: ' ' });
    expect(firstCategory).toHaveAttribute('aria-expanded', 'false');

    // Space 키로 펼치기
    fireEvent.keyDown(firstCategory, { key: ' ' });
    expect(firstCategory).toHaveAttribute('aria-expanded', 'true');
  });

  it('ToolboxItem에 role="button"과 aria-label이 설정되어야 한다', () => {
    renderWithDnd(<Toolbox />);
    // ToolboxItem은 displayName을 aria-label로 가짐
    const buttonItem = screen.getByRole('button', { name: 'Button' });
    expect(buttonItem).toBeInTheDocument();
    expect(buttonItem).toHaveAttribute('aria-label', 'Button');

    const labelItem = screen.getByRole('button', { name: 'Label' });
    expect(labelItem).toBeInTheDocument();
    expect(labelItem).toHaveAttribute('aria-label', 'Label');
  });
});

// ─── PropertyPanel 접근성 테스트 ─────────────────────────────

describe('PropertyPanel 접근성', () => {
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

  it('탭 버튼에 role="tab"과 aria-selected가 설정되어야 한다', () => {
    const button = makeButton();
    useDesignerStore.setState({ controls: [button] });
    useSelectionStore.setState({ selectedIds: new Set(['btn-1']) });

    render(<PropertyPanel />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThanOrEqual(2);

    // Properties 탭이 활성화 상태
    const propertiesTab = tabs.find((t) => t.textContent?.includes('Properties'));
    expect(propertiesTab).toHaveAttribute('aria-selected', 'true');

    const eventsTab = tabs.find((t) => t.textContent?.includes('Events'));
    expect(eventsTab).toHaveAttribute('aria-selected', 'false');
  });

  it('탭 전환 시 aria-selected가 올바르게 변경되어야 한다', () => {
    const button = makeButton();
    useDesignerStore.setState({ controls: [button] });
    useSelectionStore.setState({ selectedIds: new Set(['btn-1']) });

    render(<PropertyPanel />);

    const eventsTab = screen.getAllByRole('tab').find((t) => t.textContent?.includes('Events'))!;
    fireEvent.click(eventsTab);

    expect(eventsTab).toHaveAttribute('aria-selected', 'true');
    const propertiesTab = screen
      .getAllByRole('tab')
      .find((t) => t.textContent?.includes('Properties'))!;
    expect(propertiesTab).toHaveAttribute('aria-selected', 'false');
  });

  it('tablist role이 존재해야 한다', () => {
    const button = makeButton();
    useDesignerStore.setState({ controls: [button] });
    useSelectionStore.setState({ selectedIds: new Set(['btn-1']) });

    render(<PropertyPanel />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('정렬 토글 버튼에 aria-label이 설정되어야 한다', () => {
    const button = makeButton();
    useDesignerStore.setState({ controls: [button] });
    useSelectionStore.setState({ selectedIds: new Set(['btn-1']) });

    render(<PropertyPanel />);

    const sortButton = screen.getByLabelText('정렬 방식 변경');
    expect(sortButton).toBeInTheDocument();
  });
});

// ─── PropertyCategory 접근성 테스트 ──────────────────────────

describe('PropertyCategory 접근성', () => {
  const mockProps = {
    category: 'Layout' as const,
    properties: [
      { name: 'x', label: 'X', editorType: 'number' as const, category: 'Layout' as const },
      { name: 'y', label: 'Y', editorType: 'number' as const, category: 'Layout' as const },
    ],
    getValue: () => 0,
    onValueChange: vi.fn(),
  };

  it('카테고리 영역에 role="region"과 aria-label이 설정되어야 한다', () => {
    render(<PropertyCategory {...mockProps} />);
    const region = screen.getByRole('region');
    expect(region).toHaveAttribute('aria-label', 'Layout');
  });

  it('카테고리 헤더에 role="button"과 aria-expanded가 설정되어야 한다', () => {
    render(<PropertyCategory {...mockProps} />);
    const header = screen.getByRole('button');
    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('Enter 키로 카테고리 접기/펼치기가 동작해야 한다', () => {
    render(<PropertyCategory {...mockProps} />);
    const header = screen.getByRole('button');

    // 접기
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    // X, Y 라벨이 숨겨져야 함
    expect(screen.queryByText('X')).not.toBeInTheDocument();

    // 펼치기
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('Space 키로 카테고리 접기/펼치기가 동작해야 한다', () => {
    render(<PropertyCategory {...mockProps} />);
    const header = screen.getByRole('button');

    fireEvent.keyDown(header, { key: ' ' });
    expect(header).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(header, { key: ' ' });
    expect(header).toHaveAttribute('aria-expanded', 'true');
  });
});

// ─── ElementTreeNode 접근성 테스트 ───────────────────────────

describe('ElementTreeNode 접근성', () => {
  const baseNode: TreeNode = {
    id: 'node-1',
    name: 'Button1',
    icon: '🔘',
    children: [],
  };

  const parentNode: TreeNode = {
    id: 'parent-1',
    name: 'Panel1',
    icon: '📦',
    children: [baseNode],
  };

  it('treeitem role과 aria-selected가 설정되어야 한다', () => {
    render(
      <ElementTreeNode
        node={baseNode}
        depth={0}
        expandedNodes={new Set()}
        selectedIds={new Set(['node-1'])}
        onToggleExpand={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const treeitem = screen.getByRole('treeitem');
    expect(treeitem).toHaveAttribute('aria-selected', 'true');
  });

  it('선택되지 않은 항목은 aria-selected="false"여야 한다', () => {
    render(
      <ElementTreeNode
        node={baseNode}
        depth={0}
        expandedNodes={new Set()}
        selectedIds={new Set()}
        onToggleExpand={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const treeitem = screen.getByRole('treeitem');
    expect(treeitem).toHaveAttribute('aria-selected', 'false');
  });

  it('자식이 있는 노드에 aria-expanded가 설정되어야 한다', () => {
    render(
      <ElementTreeNode
        node={parentNode}
        depth={0}
        expandedNodes={new Set(['parent-1'])}
        selectedIds={new Set()}
        onToggleExpand={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const treeitems = screen.getAllByRole('treeitem');
    const parentItem = treeitems[0];
    expect(parentItem).toHaveAttribute('aria-expanded', 'true');
  });

  it('자식이 없는 노드에는 aria-expanded가 없어야 한다', () => {
    render(
      <ElementTreeNode
        node={baseNode}
        depth={0}
        expandedNodes={new Set()}
        selectedIds={new Set()}
        onToggleExpand={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const treeitem = screen.getByRole('treeitem');
    expect(treeitem).not.toHaveAttribute('aria-expanded');
  });

  it('Enter 키로 항목을 선택할 수 있어야 한다', () => {
    const onSelect = vi.fn();
    render(
      <ElementTreeNode
        node={baseNode}
        depth={0}
        expandedNodes={new Set()}
        selectedIds={new Set()}
        onToggleExpand={vi.fn()}
        onSelect={onSelect}
      />,
    );
    const treeitem = screen.getByRole('treeitem');
    fireEvent.keyDown(treeitem, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('node-1', false);
  });

  it('Space 키로 항목을 선택할 수 있어야 한다', () => {
    const onSelect = vi.fn();
    render(
      <ElementTreeNode
        node={baseNode}
        depth={0}
        expandedNodes={new Set()}
        selectedIds={new Set()}
        onToggleExpand={vi.fn()}
        onSelect={onSelect}
      />,
    );
    const treeitem = screen.getByRole('treeitem');
    fireEvent.keyDown(treeitem, { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith('node-1', false);
  });

  it('ArrowRight 키로 접힌 노드를 펼칠 수 있어야 한다', () => {
    const onToggleExpand = vi.fn();
    render(
      <ElementTreeNode
        node={parentNode}
        depth={0}
        expandedNodes={new Set()}
        selectedIds={new Set()}
        onToggleExpand={onToggleExpand}
        onSelect={vi.fn()}
      />,
    );
    const treeitems = screen.getAllByRole('treeitem');
    fireEvent.keyDown(treeitems[0], { key: 'ArrowRight' });
    expect(onToggleExpand).toHaveBeenCalledWith('parent-1');
  });

  it('ArrowLeft 키로 펼친 노드를 접을 수 있어야 한다', () => {
    const onToggleExpand = vi.fn();
    render(
      <ElementTreeNode
        node={parentNode}
        depth={0}
        expandedNodes={new Set(['parent-1'])}
        selectedIds={new Set()}
        onToggleExpand={onToggleExpand}
        onSelect={vi.fn()}
      />,
    );
    const treeitems = screen.getAllByRole('treeitem');
    fireEvent.keyDown(treeitems[0], { key: 'ArrowLeft' });
    expect(onToggleExpand).toHaveBeenCalledWith('parent-1');
  });
});

// ─── ZOrderContextMenu 접근성 테스트 ─────────────────────────

describe('ZOrderContextMenu 접근성', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      controls: [
        makeButton({ id: 'ctrl-1', name: 'button1' }),
        makeButton({ id: 'ctrl-2', name: 'button2' }),
        makeButton({ id: 'ctrl-3', name: 'button3' }),
      ],
    });
    useHistoryStore.setState({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  it('메뉴에 role="menu"과 aria-label이 설정되어야 한다', () => {
    render(
      <ZOrderContextMenu
        menu={{ x: 100, y: 100, controlId: 'ctrl-2' }}
        onClose={vi.fn()}
      />,
    );
    const menu = screen.getByRole('menu');
    expect(menu).toHaveAttribute('aria-label', '정렬 순서');
  });

  it('메뉴 항목에 role="menuitem"이 설정되어야 한다', () => {
    render(
      <ZOrderContextMenu
        menu={{ x: 100, y: 100, controlId: 'ctrl-2' }}
        onClose={vi.fn()}
      />,
    );
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems).toHaveLength(4);
    expect(menuItems[0]).toHaveTextContent('맨 앞으로');
    expect(menuItems[1]).toHaveTextContent('앞으로');
    expect(menuItems[2]).toHaveTextContent('뒤로');
    expect(menuItems[3]).toHaveTextContent('맨 뒤로');
  });

  it('비활성화된 메뉴 항목에 aria-disabled가 설정되어야 한다', () => {
    // ctrl-3은 마지막(index 2) → isLast=true → bringToFront/bringForward disabled
    render(
      <ZOrderContextMenu
        menu={{ x: 100, y: 100, controlId: 'ctrl-1' }}
        onClose={vi.fn()}
      />,
    );
    const menuItems = screen.getAllByRole('menuitem');
    // ctrl-1은 첫 번째(index 0) → isFirst=true → sendBackward/sendToBack disabled
    expect(menuItems[2]).toHaveAttribute('aria-disabled', 'true'); // 뒤로
    expect(menuItems[3]).toHaveAttribute('aria-disabled', 'true'); // 맨 뒤로
  });

  it('Enter 키로 메뉴 항목을 실행할 수 있어야 한다', () => {
    const onClose = vi.fn();
    render(
      <ZOrderContextMenu
        menu={{ x: 100, y: 100, controlId: 'ctrl-2' }}
        onClose={onClose}
      />,
    );
    const menuItems = screen.getAllByRole('menuitem');
    fireEvent.keyDown(menuItems[0], { key: 'Enter' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Space 키로 메뉴 항목을 실행할 수 있어야 한다', () => {
    const onClose = vi.fn();
    render(
      <ZOrderContextMenu
        menu={{ x: 100, y: 100, controlId: 'ctrl-2' }}
        onClose={onClose}
      />,
    );
    const menuItems = screen.getAllByRole('menuitem');
    fireEvent.keyDown(menuItems[1], { key: ' ' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape 키로 메뉴를 닫을 수 있어야 한다', () => {
    const onClose = vi.fn();
    render(
      <ZOrderContextMenu
        menu={{ x: 100, y: 100, controlId: 'ctrl-2' }}
        onClose={onClose}
      />,
    );
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('비활성화된 항목은 Enter/Space 키로 실행되지 않아야 한다', () => {
    const onClose = vi.fn();
    // ctrl-1은 첫 번째 → sendBackward/sendToBack disabled
    render(
      <ZOrderContextMenu
        menu={{ x: 100, y: 100, controlId: 'ctrl-1' }}
        onClose={onClose}
      />,
    );
    const menuItems = screen.getAllByRole('menuitem');
    // 뒤로 (disabled)
    fireEvent.keyDown(menuItems[2], { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── ProjectExplorer 아이콘 버튼 접근성 테스트 ──────────────

vi.mock('../../src/services/apiService', () => ({
  apiService: {
    listProjects: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    exportProject: vi.fn(),
    importProject: vi.fn(),
    createForm: vi.fn(),
    deleteForm: vi.fn(),
    listThemes: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../../src/stores/designerStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stores/designerStore')>();
  return {
    ...actual,
    useDesignerStore: Object.assign(
      (selector?: (state: unknown) => unknown) => {
        if (selector) return selector(actual.useDesignerStore.getState());
        return actual.useDesignerStore.getState();
      },
      actual.useDesignerStore,
    ),
  };
});

import { apiService } from '../services/apiService';
import { ProjectExplorer } from '../components/ProjectExplorer/ProjectExplorer';

describe('ProjectExplorer 아이콘 버튼 접근성', () => {
  beforeEach(() => {
    vi.mocked(apiService.listProjects).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    });
  });

  it('새 프로젝트 버튼에 aria-label이 설정되어야 한다', async () => {
    render(<ProjectExplorer onFormSelect={vi.fn()} />);
    await waitFor(() => {
      const btn = screen.getByLabelText('새 프로젝트');
      expect(btn).toBeInTheDocument();
      expect(btn.tagName).toBe('BUTTON');
    });
  });

  it('가져오기 버튼에 aria-label이 설정되어야 한다', async () => {
    render(<ProjectExplorer onFormSelect={vi.fn()} />);
    await waitFor(() => {
      const btn = screen.getByLabelText('가져오기');
      expect(btn).toBeInTheDocument();
      expect(btn.tagName).toBe('BUTTON');
    });
  });

  it('새로고침 버튼에 aria-label이 설정되어야 한다', async () => {
    render(<ProjectExplorer onFormSelect={vi.fn()} />);
    await waitFor(() => {
      const btn = screen.getByLabelText('새로고침');
      expect(btn).toBeInTheDocument();
      expect(btn.tagName).toBe('BUTTON');
    });
  });

  it('프로젝트 탐색기 트리에 role="tree"와 aria-label이 설정되어야 한다', async () => {
    render(<ProjectExplorer onFormSelect={vi.fn()} />);
    await waitFor(() => {
      const tree = screen.getByRole('tree');
      expect(tree).toHaveAttribute('aria-label', '프로젝트 탐색기');
    });
  });
});
