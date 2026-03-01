import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';
import { apiClient } from '../communication/apiClient';

interface ToolStripItem {
  type: 'button' | 'separator' | 'label' | 'dropdown';
  text?: string;
  tooltip?: string;
  icon?: string;
  enabled?: boolean;
  checked?: boolean;
  hasScript?: boolean;
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
  onItemScript?: (path: number[], item: { text?: string }) => void;
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
  onItemScript,
}: ToolStripProps) {
  const theme = useTheme();
  const colors = useControlColors('ToolStrip', { backColor, foreColor });
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

  const sendItemScript = useCallback(
    (itemScriptPath: number[], item?: { text?: string }) => {
      if (onItemScript) {
        onItemScript(itemScriptPath, { text: item?.text });
        return;
      }

      const store = useRuntimeStore.getState();
      const formDef = store.currentFormDef;
      if (!formDef) return;

      const formState: Record<string, Record<string, unknown>> = {};
      for (const [cid, cstate] of Object.entries(store.controlStates)) {
        formState[cid] = { ...cstate };
      }

      apiClient
        .postEvent(formDef.id, {
          formId: formDef.id,
          controlId: id,
          eventName: 'ItemClicked',
          eventArgs: { type: 'ItemClicked', timestamp: Date.now(), path: itemScriptPath },
          formState,
          itemScriptPath,
        })
        .then((res) => {
          if (res.patches?.length) {
            store.applyPatches(res.patches);
          }
        })
        .catch((err) => console.error('[ToolStrip] item script error:', err));
    },
    [id, onItemScript],
  );

  const handleItemClick = useCallback(
    (item: ToolStripItem, index: number) => {
      if (!enabled || item.enabled === false) return;

      if (item.type === 'dropdown' && item.items?.length) {
        setOpenDropdown((prev) => (prev === index ? null : index));
        return;
      }

      if (item.hasScript) {
        sendItemScript([index], item);
        return;
      }

      updateControlState(id, 'clickedItem', { text: item.text, icon: item.icon, index });
      onItemClicked?.();
    },
    [id, enabled, updateControlState, onItemClicked, sendItemScript],
  );

  const handleSubItemClick = useCallback(
    (subItem: ToolStripItem, parentIndex: number, subIndex: number) => {
      if (!enabled || subItem.enabled === false) return;
      setOpenDropdown(null);

      if (subItem.hasScript) {
        sendItemScript([parentIndex, subIndex], subItem);
        return;
      }

      updateControlState(id, 'clickedItem', {
        text: subItem.text,
        icon: subItem.icon,
        index: parentIndex,
        subIndex,
      });
      onItemClicked?.();
    },
    [id, enabled, updateControlState, onItemClicked, sendItemScript],
  );

  const mergedStyle: CSSProperties = {
    background: colors.background,
    color: colors.color,
    borderBottom: theme.controls.toolStrip.border,
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
                backgroundColor: theme.controls.toolStrip.separator,
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
                  ? { backgroundColor: theme.accent.primary, border: `1px solid ${theme.accent.primaryHover}` }
                  : {}),
              }}
              onMouseEnter={(e) => {
                if (!isDisabled && !item.checked) {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = theme.controls.toolStrip.buttonHoverBackground;
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
                  backgroundColor: theme.controls.toolStrip.background,
                  color: theme.controls.toolStrip.foreground,
                  border: theme.popup.border,
                  boxShadow: theme.popup.shadow,
                  borderRadius: theme.popup.borderRadius,
                  zIndex: 1000,
                  minWidth: 120,
                }}
              >
                {item.items.map((sub, si) => {
                  if (sub.type === 'separator') {
                    return (
                      <div
                        key={si}
                        style={{ height: 1, backgroundColor: theme.controls.toolStrip.separator, margin: '2px 0' }}
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
                          (e.currentTarget as HTMLDivElement).style.backgroundColor = theme.controls.toolStrip.buttonHoverBackground;
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
