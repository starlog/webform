import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { MenuStripView, type MenuItem } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';
import { apiClient } from '../communication/apiClient';

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

  return (
    <MenuStripView
      items={items}
      openMenuIndex={openMenuIndex}
      backColor={backColor}
      foreColor={foreColor}
      font={font}
      interactive={enabled}
      disabled={!enabled}
      onTopLevelClick={handleTopLevelClick}
      onTopLevelHover={handleTopLevelHover}
      onMenuItemClick={handleItemClick}
      rootRef={menuRef}
      className="wf-menustrip"
      data-control-id={id}
      style={style}
    />
  );
}
