import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ToolStripView, type ToolStripItem } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';
import { apiClient } from '../communication/apiClient';

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

  return (
    <ToolStripView
      items={items}
      openDropdownIndex={openDropdown}
      backColor={backColor}
      foreColor={foreColor}
      font={font}
      interactive={enabled}
      disabled={!enabled}
      onItemClick={handleItemClick}
      onSubItemClick={handleSubItemClick}
      rootRef={dropdownRef}
      className="wf-toolstrip"
      data-control-id={id}
      style={style}
    />
  );
}
