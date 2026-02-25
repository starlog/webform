import { useState, useRef, useCallback, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import type { ControlType, ControlDefinition } from '@webform/common';
import { useDesignerStore, createDefaultControl } from '../../stores/designerStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useHistoryStore, createSnapshot } from '../../stores/historyStore';
import { ThemeProvider } from '../../theme/ThemeContext';
import { snapToGrid, snapPositionToGrid } from '../../utils/snapGrid';
import type { Snapline as SnaplineType } from '../../utils/snapGrid';
import { CanvasControl, DragItemTypes } from './CanvasControl';
import { Snapline } from './Snapline';

type FormResizeDirection = 'e' | 's' | 'se';

const FORM_MIN_WIDTH = 200;
const FORM_MIN_HEIGHT = 150;

/**
 * TabControl의 탭 페이지 기반 숨김 컨트롤 ID를 계산한다.
 * - 탭 페이지 Panel 자체는 항상 숨김 (TabControl 프리뷰가 시각적 경계를 표시)
 * - 선택되지 않은 탭 페이지의 자식 컨트롤은 숨김
 */
function getHiddenControlIds(controls: ControlDefinition[]): Set<string> {
  const hidden = new Set<string>();
  const tabControls = controls.filter((c) => c.type === 'TabControl');

  for (const tc of tabControls) {
    const selectedIndex = (tc.properties.selectedIndex as number) ?? 0;

    // TabControl의 직접 자식 Panel(탭 페이지)을 순서대로 찾기
    const tabPagePanels = controls.filter(
      (c) => (c.properties._parentId as string) === tc.id,
    );

    // tabs 속성에서 선택된 탭의 id를 가져옴 (tabId 기반 매칭)
    const tabs = tc.properties.tabs as Array<{ title: string; id: string }> | undefined;
    const selectedTabId = tabs?.[selectedIndex]?.id;

    // 모든 탭 페이지 Panel은 캔버스에서 숨김
    for (const panel of tabPagePanels) {
      hidden.add(panel.id);
    }

    // 선택되지 않은 탭 페이지의 모든 자손 컨트롤을 숨김
    for (let i = 0; i < tabPagePanels.length; i++) {
      const panel = tabPagePanels[i];
      const panelTabId = panel.properties.tabId as string | undefined;

      // tabId 기반 매칭 (tabs 속성이 있는 경우), 없으면 인덱스 기반
      const isSelected = selectedTabId && panelTabId
        ? panelTabId === selectedTabId
        : i === selectedIndex;

      if (!isSelected) {
        collectDescendants(controls, panel.id, hidden);
      }
    }
  }

  return hidden;
}

function collectDescendants(
  controls: ControlDefinition[],
  parentId: string,
  hidden: Set<string>,
) {
  for (const c of controls) {
    if ((c.properties._parentId as string) === parentId) {
      hidden.add(c.id);
      collectDescendants(controls, c.id, hidden);
    }
  }
}

function getSelectionBoxStyle(box: { startX: number; startY: number; endX: number; endY: number }): React.CSSProperties {
  const left = Math.min(box.startX, box.endX);
  const top = Math.min(box.startY, box.endY);
  const width = Math.abs(box.endX - box.startX);
  const height = Math.abs(box.endY - box.startY);
  return {
    position: 'absolute',
    left,
    top,
    width,
    height,
    border: '1px dashed #0078D7',
    backgroundColor: 'rgba(0, 120, 215, 0.1)',
    pointerEvents: 'none',
    zIndex: 999,
  };
}

export function DesignerCanvas() {
  const controls = useDesignerStore((s) => s.controls);
  const formProperties = useDesignerStore((s) => s.formProperties);
  const gridSize = useDesignerStore((s) => s.gridSize);
  const addControl = useDesignerStore((s) => s.addControl);
  const removeControls = useDesignerStore((s) => s.removeControls);

  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const selectMultiple = useSelectionStore((s) => s.selectMultiple);

  const [snaplines, setSnaplines] = useState<SnaplineType[]>([]);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number; startY: number;
    endX: number; endY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  // TabControl 탭 페이지 기반 숨김 컨트롤 계산
  const hiddenControlIds = useMemo(() => getHiddenControlIds(controls), [controls]);

  // --- Drop target: 도구상자에서 새 컨트롤 드롭 ---
  const [{ isOver }, dropRef] = useDrop(() => ({
    accept: [DragItemTypes.TOOLBOX_CONTROL],
    drop: (item: { type: ControlType }, monitor) => {
      const offset = monitor.getClientOffset();
      if (!offset || !canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const position = snapPositionToGrid({
        x: offset.x - canvasRect.left,
        y: offset.y - canvasRect.top,
      }, gridSize);

      // 변경 전 스냅샷 저장
      useHistoryStore.getState().pushSnapshot(createSnapshot());

      const control = createDefaultControl(item.type, position);
      addControl(control);

      // TabControl 드롭 시 탭 페이지 Panel을 자동 생성
      if (item.type === 'TabControl') {
        const tabs = (control.properties.tabs as Array<{ title: string; id: string }>) ?? [];
        for (const tab of tabs) {
          addControl({
            id: crypto.randomUUID(),
            type: 'Panel',
            name: `tabPage_${tab.title.replace(/\s+/g, '')}`,
            properties: { _parentId: control.id, tabId: tab.id, borderStyle: 'None' },
            position: { x: position.x, y: position.y },
            size: { width: control.size.width, height: control.size.height },
            anchor: { top: true, bottom: false, left: true, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
          });
        }
      }

      setSnaplines([]);
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  }), [gridSize, addControl]);

  const handleCopy = useCallback(() => {
    const currentControls = useDesignerStore.getState().controls;
    const currentSelectedIds = useSelectionStore.getState().selectedIds;
    const selected = currentControls.filter((c) => currentSelectedIds.has(c.id));
    if (selected.length > 0) {
      useSelectionStore.getState().copySelected(selected);
    }
  }, []);

  const handlePaste = useCallback(() => {
    const pasted = useSelectionStore.getState().pasteControls();
    if (pasted.length > 0) {
      // 변경 전 스냅샷 저장
      useHistoryStore.getState().pushSnapshot(createSnapshot());

      for (const control of pasted) {
        useDesignerStore.getState().addControl(control);
      }
      useSelectionStore.getState().selectMultiple(pasted.map((c) => c.id));
    }
  }, []);

  const handleDelete = useCallback(() => {
    const currentSelectedIds = useSelectionStore.getState().selectedIds;
    if (currentSelectedIds.size > 0) {
      // 변경 전 스냅샷 저장
      useHistoryStore.getState().pushSnapshot(createSnapshot());

      removeControls(Array.from(currentSelectedIds));
      clearSelection();
    }
  }, [removeControls, clearSelection]);

  // --- 키보드 이벤트 (Ctrl+Z/Y는 App.tsx에서 글로벌 처리) ---
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'c': handleCopy(); e.preventDefault(); break;
        case 'v': handlePaste(); e.preventDefault(); break;
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      handleDelete();
      e.preventDefault();
    }
  }, [handleCopy, handlePaste, handleDelete]);

  // --- 드래그 선택 박스 ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      clearSelection();
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (selectionBox) {
      const rect = canvasRef.current!.getBoundingClientRect();
      setSelectionBox({
        ...selectionBox,
        endX: e.clientX - rect.left,
        endY: e.clientY - rect.top,
      });
    }
  };

  const handleMouseUp = () => {
    if (selectionBox) {
      // 선택 박스 내 컨트롤 찾기
      const left = Math.min(selectionBox.startX, selectionBox.endX);
      const top = Math.min(selectionBox.startY, selectionBox.endY);
      const right = Math.max(selectionBox.startX, selectionBox.endX);
      const bottom = Math.max(selectionBox.startY, selectionBox.endY);

      const selectedControls = controls.filter((c) => {
        if (hiddenControlIds.has(c.id)) return false;
        const cx = c.position.x;
        const cy = c.position.y;
        const cRight = cx + c.size.width;
        const cBottom = cy + c.size.height;
        // 컨트롤이 선택 박스와 겹치는지 확인
        return cx < right && cRight > left && cy < bottom && cBottom > top;
      });

      if (selectedControls.length > 0) {
        selectMultiple(selectedControls.map((c) => c.id));
      }

      setSelectionBox(null);
    }
  };

  // --- 폼 리사이즈 핸들 ---
  const handleFormResizeMouseDown = useCallback((direction: FormResizeDirection, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // 변경 전 스냅샷 저장
    useHistoryStore.getState().pushSnapshot(createSnapshot());

    const startX = e.clientX;
    const startY = e.clientY;
    const { formProperties: fp, gridSize: gs } = useDesignerStore.getState();
    const startWidth = fp.width;
    const startHeight = fp.height;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;

      if (direction.includes('e')) newWidth = Math.max(FORM_MIN_WIDTH, startWidth + deltaX);
      if (direction.includes('s')) newHeight = Math.max(FORM_MIN_HEIGHT, startHeight + deltaY);

      useDesignerStore.getState().setFormProperties({
        width: snapToGrid(newWidth, gs),
        height: snapToGrid(newHeight, gs),
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <ThemeProvider themeId={formProperties.theme}>
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        ref={(node) => {
          dropRef(node);
          canvasRef.current = node;
        }}
        className="designer-canvas"
        style={{
          width: formProperties.width,
          height: formProperties.height,
          backgroundColor: formProperties.backgroundColor,
          position: 'relative',
          backgroundImage: 'radial-gradient(circle, #ccc 1px, transparent 1px)',
          backgroundSize: `${gridSize}px ${gridSize}px`,
          outline: 'none',
          border: isOver ? '2px dashed #0078D7' : '1px solid #999',
          boxSizing: 'border-box',
          fontFamily: formProperties.font?.family || 'Segoe UI, sans-serif',
          fontSize: formProperties.font ? `${formProperties.font.size}pt` : '9pt',
        }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {controls
          .filter((c) => !hiddenControlIds.has(c.id))
          .map((control) => (
            <CanvasControl
              key={control.id}
              control={control}
              isSelected={selectedIds.has(control.id)}
              onSnaplineChange={setSnaplines}
            />
          ))}

        {snaplines.map((line, i) => (
          <Snapline key={`${line.type}-${line.position}-${i}`} snapline={line} />
        ))}

        {selectionBox && (
          <div style={getSelectionBoxStyle(selectionBox)} />
        )}
      </div>

      {/* 폼 리사이즈 핸들: 오른쪽(e) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: -4,
          width: 8,
          height: '100%',
          cursor: 'e-resize',
          zIndex: 10,
        }}
        onMouseDown={(e) => handleFormResizeMouseDown('e', e)}
      />
      {/* 폼 리사이즈 핸들: 아래(s) */}
      <div
        style={{
          position: 'absolute',
          bottom: -4,
          left: 0,
          width: '100%',
          height: 8,
          cursor: 's-resize',
          zIndex: 10,
        }}
        onMouseDown={(e) => handleFormResizeMouseDown('s', e)}
      />
      {/* 폼 리사이즈 핸들: 우하단(se) */}
      <div
        style={{
          position: 'absolute',
          bottom: -4,
          right: -4,
          width: 12,
          height: 12,
          cursor: 'se-resize',
          zIndex: 11,
        }}
        onMouseDown={(e) => handleFormResizeMouseDown('se', e)}
      />
    </div>
    </ThemeProvider>
  );
}
