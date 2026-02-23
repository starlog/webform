import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

interface ToolStripItem {
  type: 'button' | 'separator' | 'label' | 'dropdown';
  text?: string;
  tooltip?: string;
  icon?: string;
  enabled?: boolean;
  checked?: boolean;
  items?: ToolStripItem[];
}

interface ToolStripProps {
  id: string;
  name: string;
  items?: ToolStripItem[];
  style?: CSSProperties;
  enabled?: boolean;
  backColor?: string;
  foreColor?: string;
  font?: { family?: string; size?: number };
  onItemClicked?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function ToolStrip({
  id,
  items = [],
  style,
  enabled = true,
  backColor,
  foreColor,
  font,
  onItemClicked,
}: ToolStripProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openDropdown === null) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openDropdown]);

  const handleItemClick = useCallback(
    (item: ToolStripItem, index: number) => {
      if (!enabled || item.enabled === false) return;

      if (item.type === 'dropdown' && item.items?.length) {
        setOpenDropdown((prev) => (prev === index ? null : index));
        return;
      }

      updateControlState(id, 'clickedItem', { text: item.text, icon: item.icon, index });
      onItemClicked?.();
    },
    [id, enabled, updateControlState, onItemClicked],
  );

  const handleSubItemClick = useCallback(
    (subItem: ToolStripItem, parentIndex: number, subIndex: number) => {
      if (!enabled || subItem.enabled === false) return;
      setOpenDropdown(null);
      updateControlState(id, 'clickedItem', {
        text: subItem.text,
        icon: subItem.icon,
        index: parentIndex,
        subIndex,
      });
      onItemClicked?.();
    },
    [id, enabled, updateControlState, onItemClicked],
  );

  const mergedStyle: CSSProperties = {
    backgroundColor: backColor ?? '#F0F0F0',
    color: foreColor,
    borderBottom: '1px solid #D0D0D0',
    display: 'flex',
    alignItems: 'center',
    fontFamily: font?.family ?? 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: font?.size ? `${font.size}pt` : '12px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    paddingLeft: 2,
    paddingRight: 2,
    position: 'relative',
    opacity: enabled ? 1 : 0.6,
    ...style,
  };

  return (
    <div className="wf-toolstrip" data-control-id={id} style={mergedStyle} ref={dropdownRef}>
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return (
            <div
              key={i}
              style={{
                width: 1,
                height: 16,
                backgroundColor: '#C0C0C0',
                margin: '0 3px',
              }}
            />
          );
        }

        const isDisabled = item.enabled === false || !enabled;
        const isDropdown = item.type === 'dropdown';
        const isOpen = openDropdown === i;

        return (
          <div key={i} style={{ position: 'relative' }}>
            <div
              onClick={() => handleItemClick(item, i)}
              title={item.tooltip}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: '1px 4px',
                borderRadius: 2,
                cursor: isDisabled ? 'default' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
                whiteSpace: 'nowrap',
                ...(item.checked
                  ? { backgroundColor: '#CCE4F7', border: '1px solid #99C9EF' }
                  : {}),
              }}
              onMouseEnter={(e) => {
                if (!isDisabled && !item.checked) {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = '#E0E0E0';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDisabled && !item.checked) {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = '';
                }
              }}
            >
              {item.icon && <span style={{ fontSize: '12px' }}>{item.icon}</span>}
              {item.text && <span>{item.text}</span>}
              {isDropdown && <span style={{ fontSize: '8px', marginLeft: 1 }}>&#9660;</span>}
            </div>

            {isDropdown && isOpen && item.items && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D0D0D0',
                  boxShadow: '2px 2px 4px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  minWidth: 120,
                }}
              >
                {item.items.map((sub, si) => {
                  if (sub.type === 'separator') {
                    return (
                      <div
                        key={si}
                        style={{ height: 1, backgroundColor: '#E0E0E0', margin: '2px 0' }}
                      />
                    );
                  }
                  const subDisabled = sub.enabled === false;
                  return (
                    <div
                      key={si}
                      onClick={() => handleSubItemClick(sub, i, si)}
                      style={{
                        padding: '4px 12px',
                        cursor: subDisabled ? 'default' : 'pointer',
                        opacity: subDisabled ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => {
                        if (!subDisabled)
                          (e.currentTarget as HTMLDivElement).style.backgroundColor = '#E8E8E8';
                      }}
                      onMouseLeave={(e) => {
                        if (!subDisabled)
                          (e.currentTarget as HTMLDivElement).style.backgroundColor = '';
                      }}
                    >
                      {sub.checked && <span>&#10003;</span>}
                      {sub.icon && <span>{sub.icon}</span>}
                      <span>{sub.text ?? ''}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
