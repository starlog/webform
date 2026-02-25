import { useMemo, useCallback } from 'react';
import { useDrop } from 'react-dnd';
import type { ControlType, ControlDefinition } from '@webform/common';
import { useDesignerStore, createDefaultControl } from '../../stores/designerStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { ThemeProvider, useTheme } from '../../theme/ThemeContext';
import { getDesignerComponent } from '../../controls/registry';
import { DragItemTypes } from './CanvasControl';

const SHELL_CONTROL_TYPES: ControlType[] = ['MenuStrip', 'ToolStrip', 'StatusStrip', 'Panel'];

export function ShellCanvas() {
  const shellControls = useDesignerStore((s) => s.shellControls);
  const shellProperties = useDesignerStore((s) => s.shellProperties);
  const addShellControl = useDesignerStore((s) => s.addShellControl);
  const removeShellControl = useDesignerStore((s) => s.removeShellControl);
  const clearSelection = useSelectionStore((s) => s.clearSelection);

  const topControls = useMemo(
    () => shellControls.filter((c) => c.dock === 'Top'),
    [shellControls],
  );
  const bottomControls = useMemo(
    () => shellControls.filter((c) => c.dock === 'Bottom'),
    [shellControls],
  );

  // Top 영역 드롭 타겟
  const [{ isOverTop }, topDropRef] = useDrop(
    () => ({
      accept: [DragItemTypes.TOOLBOX_CONTROL],
      drop: (item: { type: ControlType }) => {
        if (!SHELL_CONTROL_TYPES.includes(item.type)) return;
        const control = createDefaultControl(item.type, { x: 0, y: 0 });
        control.dock = item.type === 'StatusStrip' ? 'Bottom' : 'Top';
        control.size.width = shellProperties.width;
        addShellControl(control);
      },
      canDrop: (item: { type: ControlType }) => {
        return item.type !== 'StatusStrip' && SHELL_CONTROL_TYPES.includes(item.type);
      },
      collect: (monitor) => ({ isOverTop: monitor.isOver() && monitor.canDrop() }),
    }),
    [addShellControl, shellProperties.width],
  );

  // Bottom 영역 드롭 타겟
  const [{ isOverBottom }, bottomDropRef] = useDrop(
    () => ({
      accept: [DragItemTypes.TOOLBOX_CONTROL],
      drop: (item: { type: ControlType }) => {
        if (!SHELL_CONTROL_TYPES.includes(item.type)) return;
        const control = createDefaultControl(item.type, { x: 0, y: 0 });
        control.dock = 'Bottom';
        control.size.width = shellProperties.width;
        addShellControl(control);
      },
      canDrop: (item: { type: ControlType }) => {
        return (
          (item.type === 'StatusStrip' || item.type === 'Panel') &&
          SHELL_CONTROL_TYPES.includes(item.type)
        );
      },
      collect: (monitor) => ({ isOverBottom: monitor.isOver() && monitor.canDrop() }),
    }),
    [addShellControl, shellProperties.width],
  );

  // Delete 키 처리
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const currentSelectedIds = useSelectionStore.getState().selectedIds;
        if (currentSelectedIds.size > 0) {
          for (const id of currentSelectedIds) {
            removeShellControl(id);
          }
          clearSelection();
          e.preventDefault();
        }
      }
    },
    [removeShellControl, clearSelection],
  );

  return (
    <ThemeProvider themeId={shellProperties.theme}>
    <ShellCanvasInner
      shellProperties={shellProperties}
      topControls={topControls}
      bottomControls={bottomControls}
      topDropRef={topDropRef}
      bottomDropRef={bottomDropRef}
      isOverTop={isOverTop}
      isOverBottom={isOverBottom}
      handleKeyDown={handleKeyDown}
      clearSelection={clearSelection}
    />
    </ThemeProvider>
  );
}

function ShellCanvasInner({
  shellProperties,
  topControls,
  bottomControls,
  topDropRef,
  bottomDropRef,
  isOverTop,
  isOverBottom,
  handleKeyDown,
  clearSelection,
}: {
  shellProperties: ReturnType<typeof useDesignerStore.getState>['shellProperties'];
  topControls: ControlDefinition[];
  bottomControls: ControlDefinition[];
  topDropRef: unknown;
  bottomDropRef: unknown;
  isOverTop: boolean;
  isOverBottom: boolean;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  clearSelection: () => void;
}) {
  const theme = useTheme();

  return (
    <div
      style={{
        width: shellProperties.width,
        height: shellProperties.height,
        backgroundColor: shellProperties.backgroundColor,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #999',
        fontFamily: shellProperties.font?.family || 'Segoe UI, sans-serif',
        fontSize: shellProperties.font ? `${shellProperties.font.size}pt` : '9pt',
        position: 'relative',
        outline: 'none',
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) clearSelection();
      }}
    >
      {/* Top Zone */}
      <div
        ref={topDropRef as unknown as React.Ref<HTMLDivElement>}
        style={{
          minHeight: topControls.length === 0 ? 40 : undefined,
          borderBottom: '1px dashed #bbb',
          backgroundColor: isOverTop ? 'rgba(0,120,215,0.1)' : undefined,
        }}
      >
        {topControls.length === 0 && (
          <div style={{ padding: 8, color: '#aaa', fontSize: 11, textAlign: 'center' }}>
            MenuStrip/ToolStrip을 여기에 드롭
          </div>
        )}
        {topControls.map((control) => (
          <ShellControlItem key={control.id} control={control} />
        ))}
      </div>

      {/* Middle Zone - Form Preview */}
      <div
        style={{
          flex: 1,
          backgroundColor: theme.form.backgroundColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.form.foreground,
          opacity: 0.5,
          fontSize: 14,
          userSelect: 'none',
        }}
        onClick={() => clearSelection()}
      >
        폼이 여기에 표시됩니다
      </div>

      {/* Bottom Zone */}
      <div
        ref={bottomDropRef as unknown as React.Ref<HTMLDivElement>}
        style={{
          minHeight: bottomControls.length === 0 ? 30 : undefined,
          borderTop: '1px dashed #bbb',
          backgroundColor: isOverBottom ? 'rgba(0,120,215,0.1)' : undefined,
        }}
      >
        {bottomControls.length === 0 && (
          <div style={{ padding: 6, color: '#aaa', fontSize: 11, textAlign: 'center' }}>
            StatusStrip을 여기에 드롭
          </div>
        )}
        {bottomControls.map((control) => (
          <ShellControlItem key={control.id} control={control} />
        ))}
      </div>
    </div>
  );
}

function ShellControlItem({ control }: { control: ControlDefinition }) {
  const select = useSelectionStore((s) => s.select);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const isSelected = selectedIds.has(control.id);
  const Component = getDesignerComponent(control.type);

  return (
    <div
      style={{
        width: '100%',
        height: control.size.height,
        border: isSelected ? '2px solid #0078D7' : '1px solid transparent',
        boxSizing: 'border-box',
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={(e) => {
        e.stopPropagation();
        select(control.id);
      }}
    >
      {Component ? (
        <Component
          id={control.id}
          properties={control.properties}
          size={{ width: control.size.width, height: control.size.height }}
        />
      ) : (
        <div style={{ padding: 4, fontSize: 11 }}>
          {control.name} ({control.type})
        </div>
      )}
    </div>
  );
}
