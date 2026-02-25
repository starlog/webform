import { useState, useMemo, useEffect, useCallback } from 'react';
import { useDesignerStore } from '../../stores/designerStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useHistoryStore, createSnapshot } from '../../stores/historyStore';
import { controlMetadata } from '../../controls/registry';
import { ElementTreeNode } from './ElementTreeNode';
import type { TreeNode } from './ElementTreeNode';
import { ZOrderContextMenu } from '../ZOrderContextMenu';
import type { ZOrderContextMenuState } from '../ZOrderContextMenu';

const FORM_NODE_ID = '__form__';

const iconMap = new Map(controlMetadata.map((m) => [m.type, m.icon]));

function getIcon(type: string): string {
  return iconMap.get(type as never) ?? '?';
}

export function ElementList() {
  const controls = useDesignerStore((s) => s.controls);
  const formProperties = useDesignerStore((s) => s.formProperties);
  const currentFormId = useDesignerStore((s) => s.currentFormId);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const select = useSelectionStore((s) => s.select);
  const toggleSelect = useSelectionStore((s) => s.toggleSelect);
  const clearSelection = useSelectionStore((s) => s.clearSelection);

  const removeControls = useDesignerStore((s) => s.removeControls);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([FORM_NODE_ID]));
  const [contextMenu, setContextMenu] = useState<ZOrderContextMenuState | null>(null);

  // 트리 구축
  const tree = useMemo<TreeNode | null>(() => {
    if (!currentFormId) return null;

    // 부모-자식 맵 구성
    const childrenMap = new Map<string, TreeNode[]>();
    const nodeMap = new Map<string, TreeNode>();

    for (const ctrl of controls) {
      const node: TreeNode = {
        id: ctrl.id,
        name: ctrl.name,
        icon: getIcon(ctrl.type),
        children: [],
      };
      nodeMap.set(ctrl.id, node);
    }

    // 자식 분류
    for (const ctrl of controls) {
      const parentId = ctrl.properties._parentId as string | undefined;
      const key = parentId ?? FORM_NODE_ID;
      if (!childrenMap.has(key)) childrenMap.set(key, []);
      childrenMap.get(key)!.push(nodeMap.get(ctrl.id)!);
    }

    // 재귀적으로 자식 할당
    for (const [, node] of nodeMap) {
      node.children = childrenMap.get(node.id) ?? [];
    }

    return {
      id: FORM_NODE_ID,
      name: formProperties.title || 'Form',
      icon: '📋',
      children: childrenMap.get(FORM_NODE_ID) ?? [],
    };
  }, [controls, formProperties.title, currentFormId]);

  // 캔버스 선택 변경 → 조상 자동 펼침
  useEffect(() => {
    if (selectedIds.size === 0) return;

    // parentId 맵 구축
    const parentMap = new Map<string, string>();
    for (const ctrl of controls) {
      const parentId = ctrl.properties._parentId as string | undefined;
      if (parentId) {
        parentMap.set(ctrl.id, parentId);
      }
    }

    const toExpand = new Set<string>();
    for (const id of selectedIds) {
      let current = parentMap.get(id);
      while (current) {
        toExpand.add(current);
        current = parentMap.get(current);
      }
      toExpand.add(FORM_NODE_ID);
    }

    if (toExpand.size > 0) {
      setExpandedNodes((prev) => {
        let changed = false;
        for (const id of toExpand) {
          if (!prev.has(id)) {
            changed = true;
            break;
          }
        }
        if (!changed) return prev;
        const next = new Set(prev);
        for (const id of toExpand) next.add(id);
        return next;
      });
    }
  }, [selectedIds, controls]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (id: string, ctrlKey: boolean) => {
      if (id === FORM_NODE_ID) {
        clearSelection();
        return;
      }
      if (ctrlKey) {
        toggleSelect(id);
      } else {
        select(id);
      }
    },
    [select, toggleSelect, clearSelection],
  );

  const handleDelete = useCallback(() => {
    const ids = useSelectionStore.getState().selectedIds;
    if (ids.size === 0) return;
    useHistoryStore.getState().pushSnapshot(createSnapshot());
    removeControls(Array.from(ids));
    clearSelection();
  }, [removeControls, clearSelection]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDelete();
        e.preventDefault();
      }
    },
    [handleDelete],
  );

  // 컨텍스트 메뉴 핸들러
  const handleContextMenu = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (id === FORM_NODE_ID) return;
      e.preventDefault();
      select(id);
      setContextMenu({ x: e.clientX, y: e.clientY, controlId: id });
    },
    [select],
  );

  // 선택 ID에 __form__ 포함 여부 (폼 노드 하이라이트용)
  const displaySelectedIds = useMemo(() => {
    if (selectedIds.size === 0) {
      return new Set([FORM_NODE_ID]);
    }
    return selectedIds;
  }, [selectedIds]);

  return (
    <div
      role="region"
      aria-label="요소 목록"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', outline: 'none' }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          borderBottom: '1px solid #ddd',
          backgroundColor: '#e8e8e8',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        <span>요소 목록</span>
      </div>

      {/* 트리뷰 */}
      <div role="tree" aria-label="요소 트리" style={{ flex: 1, overflow: 'auto', fontSize: 12 }}>
        {!currentFormId && (
          <div style={{ padding: 8, color: '#888', fontSize: 11 }}>폼을 열어주세요</div>
        )}
        {tree && (
          <ElementTreeNode
            node={tree}
            depth={0}
            expandedNodes={expandedNodes}
            selectedIds={displaySelectedIds}
            onToggleExpand={handleToggleExpand}
            onSelect={handleSelect}
            onContextMenu={handleContextMenu}
          />
        )}
      </div>

      {contextMenu && (
        <ZOrderContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}
