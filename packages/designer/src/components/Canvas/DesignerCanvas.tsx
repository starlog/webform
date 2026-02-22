import { useState, useRef, useCallback } from 'react';
import { useDrop } from 'react-dnd';
import type { ControlType, ControlDefinition } from '@webform/common';
import { useDesignerStore, createDefaultControl } from '../../stores/designerStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useHistoryStore } from '../../stores/historyStore';
import { snapPositionToGrid } from '../../utils/snapGrid';
import type { Snapline as SnaplineType } from '../../utils/snapGrid';
import { CanvasControl, DragItemTypes } from './CanvasControl';
import { Snapline } from './Snapline';

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
      const snapshot = JSON.stringify(useDesignerStore.getState().controls);
      useHistoryStore.getState().pushSnapshot(snapshot);

      const control = createDefaultControl(item.type, position);
      addControl(control);

      setSnaplines([]);
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  }), [gridSize, addControl]);

  // --- 히스토리 연동 ---
  const handleUndo = useCallback(() => {
    const snapshot = useHistoryStore.getState().undo();
    if (snapshot) {
      const restoredControls = JSON.parse(snapshot) as ControlDefinition[];
      useDesignerStore.getState().loadForm(
        useDesignerStore.getState().currentFormId ?? '',
        restoredControls,
        useDesignerStore.getState().formProperties,
      );
    }
  }, []);

  const handleRedo = useCallback(() => {
    const snapshot = useHistoryStore.getState().redo();
    if (snapshot) {
      const restoredControls = JSON.parse(snapshot) as ControlDefinition[];
      useDesignerStore.getState().loadForm(
        useDesignerStore.getState().currentFormId ?? '',
        restoredControls,
        useDesignerStore.getState().formProperties,
      );
    }
  }, []);

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
      const snapshot = JSON.stringify(useDesignerStore.getState().controls);
      useHistoryStore.getState().pushSnapshot(snapshot);

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
      const snapshot = JSON.stringify(useDesignerStore.getState().controls);
      useHistoryStore.getState().pushSnapshot(snapshot);

      removeControls(Array.from(currentSelectedIds));
      clearSelection();
    }
  }, [removeControls, clearSelection]);

  // --- 키보드 이벤트 ---
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'z': handleUndo(); e.preventDefault(); break;
        case 'y': handleRedo(); e.preventDefault(); break;
        case 'c': handleCopy(); e.preventDefault(); break;
        case 'v': handlePaste(); e.preventDefault(); break;
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      handleDelete();
      e.preventDefault();
    }
  }, [handleUndo, handleRedo, handleCopy, handlePaste, handleDelete]);

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

  return (
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
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {controls.map((control) => (
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
  );
}
