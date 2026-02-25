import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useDesignerStore } from '../stores/designerStore';
import { useHistoryStore, createSnapshot } from '../stores/historyStore';

export interface ZOrderContextMenuState {
  x: number;
  y: number;
  controlId: string;
}

interface ZOrderContextMenuProps {
  menu: ZOrderContextMenuState;
  onClose: () => void;
}

export function ZOrderContextMenu({ menu, onClose }: ZOrderContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useDesignerStore((s) => s.controls);
  const bringToFront = useDesignerStore((s) => s.bringToFront);
  const sendToBack = useDesignerStore((s) => s.sendToBack);
  const bringForward = useDesignerStore((s) => s.bringForward);
  const sendBackward = useDesignerStore((s) => s.sendBackward);

  const indexInfo = useMemo(() => {
    const index = controls.findIndex((c) => c.id === menu.controlId);
    return { index, isFirst: index === 0, isLast: index === controls.length - 1 };
  }, [menu.controlId, controls]);

  const handleAction = useCallback(
    (action: 'bringToFront' | 'bringForward' | 'sendBackward' | 'sendToBack') => {
      useHistoryStore.getState().pushSnapshot(createSnapshot());
      switch (action) {
        case 'bringToFront': bringToFront(menu.controlId); break;
        case 'bringForward': bringForward(menu.controlId); break;
        case 'sendBackward': sendBackward(menu.controlId); break;
        case 'sendToBack': sendToBack(menu.controlId); break;
      }
      onClose();
    },
    [menu.controlId, bringToFront, bringForward, sendBackward, sendToBack, onClose],
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: menu.x,
        top: menu.y,
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 10000,
        padding: '4px 0',
        minWidth: 160,
        fontSize: 12,
      }}
    >
      <MenuItem label="맨 앞으로" disabled={indexInfo.isLast} onClick={() => handleAction('bringToFront')} />
      <MenuItem label="앞으로" disabled={indexInfo.isLast} onClick={() => handleAction('bringForward')} />
      <MenuItem label="뒤로" disabled={indexInfo.isFirst} onClick={() => handleAction('sendBackward')} />
      <MenuItem label="맨 뒤로" disabled={indexInfo.isFirst} onClick={() => handleAction('sendToBack')} />
    </div>
  );
}

function MenuItem({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <div
      style={{
        padding: '6px 12px',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#bbb' : '#333',
        backgroundColor: 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#e8f0fe';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
      }}
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      {label}
    </div>
  );
}
