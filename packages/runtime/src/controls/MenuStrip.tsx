import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';
import { apiClient } from '../communication/apiClient';

interface MenuItem {
  text: string;
  shortcut?: string;
  children?: MenuItem[];
  enabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  formId?: string;
  hasScript?: boolean;
}

interface MenuStripProps {
  id: string;
  name: string;
  items?: MenuItem[];
  style?: CSSProperties;
  enabled?: boolean;
  backColor?: string;
  foreColor?: string;
  font?: { family?: string; size?: number };
  onItemClicked?: () => void;
  onItemScript?: (path: number[], item: { text: string }) => void;
  children?: ReactNode;
  [key: string]: unknown;
}

function DropdownMenu({
  items,
  onItemClick,
  enabled,
}: {
  items: MenuItem[];
  onItemClick: (item: MenuItem, path: number[]) => void;
  enabled: boolean;
}) {
  const theme = useTheme();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        backgroundColor: theme.controls.menuStrip.background,
        color: theme.controls.menuStrip.foreground,
        border: theme.popup.border,
        boxShadow: theme.popup.shadow,
        borderRadius: theme.popup.borderRadius,
        zIndex: 1000,
        minWidth: 180,
        padding: '2px 0',
      }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return (
            <div
              key={i}
              style={{ height: 1, backgroundColor: theme.controls.menuStrip.border, margin: '2px 0' }}
            />
          );
        }

        const isDisabled = item.enabled === false || !enabled;
        const hasChildren = item.children && item.children.length > 0;
        const isHovered = hoverIndex === i;

        return (
          <div
            key={i}
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <div
              onClick={() => {
                if (isDisabled) return;
                if (!hasChildren) {
                  onItemClick(item, [i]);
                }
              }}
              style={{
                padding: '4px 30px 4px 28px',
                cursor: isDisabled ? 'default' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                whiteSpace: 'nowrap',
                backgroundColor: isHovered && !isDisabled ? theme.controls.menuStrip.hoverBackground : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 8,
                    width: 16,
                    textAlign: 'center',
                  }}
                >
                  {item.checked ? '✓' : ''}
                </span>
                <span>{item.text}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 20 }}>
                {item.shortcut && (
                  <span style={{ opacity: 0.6, fontSize: '11px' }}>{item.shortcut}</span>
                )}
                {hasChildren && <span style={{ fontSize: '10px' }}>&#9654;</span>}
              </div>
            </div>

            {hasChildren && isHovered && (
              <SubMenu
                items={item.children!}
                onItemClick={(subItem, subPath) => onItemClick(subItem, [i, ...subPath])}
                enabled={enabled && !isDisabled}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SubMenu({
  items,
  onItemClick,
  enabled,
}: {
  items: MenuItem[];
  onItemClick: (item: MenuItem, path: number[]) => void;
  enabled: boolean;
}) {
  const theme = useTheme();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: '100%',
        backgroundColor: theme.controls.menuStrip.background,
        color: theme.controls.menuStrip.foreground,
        border: theme.popup.border,
        boxShadow: theme.popup.shadow,
        borderRadius: theme.popup.borderRadius,
        zIndex: 1001,
        minWidth: 160,
        padding: '2px 0',
      }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return (
            <div
              key={i}
              style={{ height: 1, backgroundColor: theme.controls.menuStrip.border, margin: '2px 0' }}
            />
          );
        }

        const isDisabled = item.enabled === false || !enabled;
        const hasChildren = item.children && item.children.length > 0;
        const isHovered = hoverIndex === i;

        return (
          <div
            key={i}
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <div
              onClick={() => {
                if (isDisabled || hasChildren) return;
                onItemClick(item, [i]);
              }}
              style={{
                padding: '4px 30px 4px 28px',
                cursor: isDisabled ? 'default' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                whiteSpace: 'nowrap',
                backgroundColor: isHovered && !isDisabled ? theme.controls.menuStrip.hoverBackground : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 8,
                    width: 16,
                    textAlign: 'center',
                  }}
                >
                  {item.checked ? '✓' : ''}
                </span>
                <span>{item.text}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 20 }}>
                {item.shortcut && (
                  <span style={{ opacity: 0.6, fontSize: '11px' }}>{item.shortcut}</span>
                )}
                {hasChildren && <span style={{ fontSize: '10px' }}>&#9654;</span>}
              </div>
            </div>

            {hasChildren && isHovered && (
              <SubMenu
                items={item.children!}
                onItemClick={(subItem, subPath) => onItemClick(subItem, [i, ...subPath])}
                enabled={enabled && !isDisabled}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MenuStrip({
  id,
  items = [],
  style,
  enabled = true,
  backColor,
  foreColor,
  font,
  onItemClicked,
  onItemScript,
}: MenuStripProps) {
  const theme = useTheme();
  const colors = useControlColors('MenuStrip', { backColor, foreColor });
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openMenuIndex === null) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuIndex]);

  const handleItemClick = useCallback(
    (item: MenuItem, path: number[], topIndex: number) => {
      setOpenMenuIndex(null);
      const fullPath = [topIndex, ...path];

      if (item.hasScript) {
        if (onItemScript) {
          onItemScript(fullPath, { text: item.text });
        } else {
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
              eventArgs: { type: 'ItemClicked', timestamp: Date.now(), text: item.text, path: fullPath },
              formState,
              itemScriptPath: fullPath,
            })
            .then((res) => {
              if (res.patches?.length) {
                store.applyPatches(res.patches);
              }
            })
            .catch((err) => console.error('[MenuStrip] item script error:', err));
        }
        return;
      }

      updateControlState(id, 'clickedItem', {
        text: item.text,
        shortcut: item.shortcut,
        formId: item.formId,
        path: fullPath,
      });
      if (item.formId) {
        useRuntimeStore.getState().requestNavigate(item.formId);
      }
      onItemClicked?.();
    },
    [id, updateControlState, onItemClicked, onItemScript],
  );

  const handleTopLevelClick = useCallback(
    (index: number) => {
      if (!enabled) return;
      const item = items[index];
      const hasChildren = item?.children && item.children.length > 0;
      if (!hasChildren && item) {
        setOpenMenuIndex(null);
        handleItemClick(item, [], index);
        return;
      }
      setOpenMenuIndex((prev) => (prev === index ? null : index));
    },
    [enabled, items, handleItemClick],
  );

  const handleTopLevelHover = useCallback(
    (index: number) => {
      if (openMenuIndex !== null) {
        setOpenMenuIndex(index);
      }
    },
    [openMenuIndex],
  );

  const mergedStyle: CSSProperties = {
    background: colors.background,
    color: colors.color,
    borderBottom: theme.controls.menuStrip.border,
    display: 'flex',
    alignItems: 'center',
    fontFamily: font?.family ?? 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: font?.size ? `${font.size}pt` : '12px',
    boxSizing: 'border-box',
    overflow: 'visible',
    position: 'relative',
    opacity: enabled ? 1 : 0.6,
    ...style,
  };

  return (
    <div className="wf-menustrip" data-control-id={id} style={mergedStyle} ref={menuRef}>
      {items.map((item, i) => {
        const isOpen = openMenuIndex === i;
        const hasChildren = item.children && item.children.length > 0;

        return (
          <div key={i} style={{ position: 'relative' }}>
            <div
              onClick={() => handleTopLevelClick(i)}
              onMouseEnter={() => handleTopLevelHover(i)}
              style={{
                padding: '2px 8px',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                cursor: enabled ? 'pointer' : 'default',
                backgroundColor: isOpen ? theme.controls.menuStrip.activeBackground : undefined,
              }}
              onMouseOver={(e) => {
                if (!isOpen && enabled)
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = theme.controls.menuStrip.hoverBackground;
              }}
              onMouseOut={(e) => {
                if (!isOpen)
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = '';
              }}
            >
              {item.text}
            </div>

            {isOpen && hasChildren && (
              <DropdownMenu
                items={item.children!}
                onItemClick={(subItem, path) => handleItemClick(subItem, path, i)}
                enabled={enabled}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
