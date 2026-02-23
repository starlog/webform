import { useDrop } from 'react-dnd';
import type { ControlType, ControlDefinition } from '@webform/common';
import { useDesignerStore, createDefaultControl } from '../../stores/designerStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useHistoryStore } from '../../stores/historyStore';
import { isNonVisualControl, controlMetadata } from '../../controls/registry';
import { DragItemTypes } from './CanvasControl';

interface ComponentTrayProps {
  controls: ControlDefinition[];
}

export function ComponentTray({ controls }: ComponentTrayProps) {
  const addControl = useDesignerStore((s) => s.addControl);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const select = useSelectionStore((s) => s.select);
  const clearSelection = useSelectionStore((s) => s.clearSelection);

  const nonVisualControls = controls.filter((c) => isNonVisualControl(c.type));

  const [{ isOver }, dropRef] = useDrop(() => ({
    accept: [DragItemTypes.TOOLBOX_CONTROL],
    canDrop: (item: { type: ControlType }) => isNonVisualControl(item.type),
    drop: (item: { type: ControlType }) => {
      const snapshot = JSON.stringify(useDesignerStore.getState().controls);
      useHistoryStore.getState().pushSnapshot(snapshot);

      const control = createDefaultControl(item.type, { x: 0, y: 0 });
      addControl(control);
    },
    collect: (monitor) => ({ isOver: monitor.isOver() && monitor.canDrop() }),
  }), [addControl]);

  if (nonVisualControls.length === 0 && !isOver) return null;

  const handleItemClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      if (selectedIds.has(id)) {
        clearSelection();
      } else {
        select(id);
      }
    } else {
      select(id);
    }
  };

  return (
    <div
      ref={dropRef}
      style={{
        marginTop: 4,
        padding: '6px 8px',
        minHeight: 36,
        border: isOver ? '2px dashed #0078D7' : '1px solid #ccc',
        borderRadius: 4,
        backgroundColor: isOver ? '#e8f0fe' : '#fafafa',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
      }}
    >
      {nonVisualControls.length === 0 && isOver && (
        <span style={{ color: '#888', fontSize: 11 }}>여기에 비시각적 컴포넌트를 놓으세요</span>
      )}
      {nonVisualControls.map((ctrl) => {
        const meta = controlMetadata.find((m) => m.type === ctrl.type);
        const isSelected = selectedIds.has(ctrl.id);
        return (
          <div
            key={ctrl.id}
            onClick={(e) => handleItemClick(ctrl.id, e)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              border: isSelected ? '2px solid #0078D7' : '1px solid #bbb',
              borderRadius: 3,
              backgroundColor: isSelected ? '#e0ecff' : '#fff',
              cursor: 'pointer',
              fontSize: 11,
              color: '#333',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: 13 }}>{meta?.icon ?? '?'}</span>
            <span>{ctrl.name}</span>
          </div>
        );
      })}
    </div>
  );
}
