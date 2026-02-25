import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
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
  const [focusedIndex, setFocusedIndex] = useState(0);
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

  // 열릴 때 첫 항목 포커스
  useEffect(() => {
    const items = ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (items && items.length > 0) items[0].focus();
  }, []);

  const menuItems: { label: string; disabled: boolean; action: 'bringToFront' | 'bringForward' | 'sendBackward' | 'sendToBack' }[] = [
    { label: '맨 앞으로', disabled: indexInfo.isLast, action: 'bringToFront' },
    { label: '앞으로', disabled: indexInfo.isLast, action: 'bringForward' },
    { label: '뒤로', disabled: indexInfo.isFirst, action: 'sendBackward' },
    { label: '맨 뒤로', disabled: indexInfo.isFirst, action: 'sendToBack' },
  ];

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!items) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => { const next = (prev + 1) % items.length; items[next].focus(); return next; });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => { const next = (prev - 1 + items.length) % items.length; items[next].focus(); return next; });
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="정렬 순서"
      onKeyDown={handleMenuKeyDown}
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
      {menuItems.map((item, i) => (
        <MenuItem
          key={item.label}
          label={item.label}
          disabled={item.disabled}
          focused={i === focusedIndex}
          onClick={() => handleAction(item.action)}
        />
      ))}
    </div>
  );
}

function MenuItem({ label, disabled, focused, onClick }: { label: string; disabled: boolean; focused: boolean; onClick: () => void }) {
  return (
    <div
      role="menuitem"
      tabIndex={focused ? 0 : -1}
      aria-disabled={disabled}
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
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {label}
    </div>
  );
}
