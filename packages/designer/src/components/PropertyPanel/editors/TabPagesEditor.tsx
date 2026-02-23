import { useState } from 'react';
import { useDesignerStore } from '../../../stores/designerStore';
import { useSelectionStore } from '../../../stores/selectionStore';

interface TabInfo {
  title: string;
  id: string;
}

interface TabPagesEditorProps {
  value: unknown;
  onChange: (value: TabInfo[]) => void;
}

/** 문자열 배열, id 없는 객체 등 다양한 입력을 TabInfo[]로 정규화 */
function normalizeTabItems(raw: unknown): TabInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string') {
      return { title: item, id: crypto.randomUUID() };
    }
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      return {
        title: (obj.title as string) ?? (obj.name as string) ?? String(obj),
        id: (obj.id as string) ?? crypto.randomUUID(),
      };
    }
    return { title: String(item), id: crypto.randomUUID() };
  });
}

export function TabPagesEditor({ value, onChange }: TabPagesEditorProps) {
  const [open, setOpen] = useState(false);
  const items = normalizeTabItems(value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '1px 2px',
          border: '1px solid #ccc',
          background: '#fff',
          fontSize: 12,
          fontFamily: 'Segoe UI, sans-serif',
          cursor: 'pointer',
        }}
      >
        (Tabs) [{items.length}]
      </button>
      {open && (
        <TabPagesModal
          items={items}
          onClose={() => setOpen(false)}
          onSave={(newItems) => {
            onChange(newItems);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

interface TabPagesModalProps {
  items: TabInfo[];
  onClose: () => void;
  onSave: (items: TabInfo[]) => void;
}

function TabPagesModal({ items: initial, onClose, onSave }: TabPagesModalProps) {
  const [items, setItems] = useState<TabInfo[]>(() => initial.map((t) => ({ title: t.title, id: t.id })));
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const addControl = useDesignerStore((s) => s.addControl);
  const removeControls = useDesignerStore((s) => s.removeControls);
  const controls = useDesignerStore((s) => s.controls);

  // 현재 선택된 TabControl의 ID를 가져옴
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const tabControlId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const tabControl = tabControlId
    ? controls.find((c) => c.id === tabControlId)
    : null;

  const add = () => {
    const newTab: TabInfo = {
      title: `Tab ${items.length + 1}`,
      id: crypto.randomUUID(),
    };
    setItems([...items, newTab]);
    setSelectedIndex(items.length);
  };

  const remove = () => {
    if (selectedIndex < 0 || selectedIndex >= items.length) return;
    const removedTab = items[selectedIndex];
    const next = items.filter((_, i) => i !== selectedIndex);
    setItems(next);
    setSelectedIndex(Math.min(selectedIndex, next.length - 1));

    // 해당 탭 페이지 Panel과 자손 컨트롤 삭제
    if (tabControlId) {
      const tabPagePanels = controls.filter(
        (c) => (c.properties._parentId as string) === tabControlId,
      );
      const panelToRemove = tabPagePanels.find(
        (p) => (p.properties.tabId as string) === removedTab.id,
      ) ?? tabPagePanels[selectedIndex];

      if (panelToRemove) {
        const idsToRemove = collectAllDescendantIds(controls, panelToRemove.id);
        idsToRemove.push(panelToRemove.id);
        removeControls(idsToRemove);
      }
    }
  };

  const moveUp = () => {
    if (selectedIndex <= 0) return;
    const next = [...items];
    [next[selectedIndex - 1], next[selectedIndex]] = [
      next[selectedIndex],
      next[selectedIndex - 1],
    ];
    setItems(next);
    setSelectedIndex(selectedIndex - 1);
  };

  const moveDown = () => {
    if (selectedIndex < 0 || selectedIndex >= items.length - 1) return;
    const next = [...items];
    [next[selectedIndex], next[selectedIndex + 1]] = [
      next[selectedIndex + 1],
      next[selectedIndex],
    ];
    setItems(next);
    setSelectedIndex(selectedIndex + 1);
  };

  const updateTitle = (index: number, title: string) => {
    const next = items.map((t, i) => (i === index ? { ...t, title } : t));
    setItems(next);
  };

  const handleSave = () => {
    // 새로 추가된 탭에 대해 Panel 생성
    if (tabControlId && tabControl) {
      const existingPanels = controls.filter(
        (c) => (c.properties._parentId as string) === tabControlId,
      );
      const existingTabIds = new Set(
        existingPanels.map((p) => p.properties.tabId as string).filter(Boolean),
      );

      for (const tab of items) {
        if (!existingTabIds.has(tab.id)) {
          // 탭 헤더 높이(약 30px) 아래에 위치하도록 오프셋 적용
          const TAB_HEADER_OFFSET_X = 10;
          const TAB_HEADER_OFFSET_Y = 40;
          addControl({
            id: crypto.randomUUID(),
            type: 'Panel',
            name: `tabPage_${tab.title.replace(/\s+/g, '')}`,
            properties: {
              _parentId: tabControlId,
              tabId: tab.id,
              borderStyle: 'None',
            },
            position: {
              x: tabControl.position.x + TAB_HEADER_OFFSET_X,
              y: tabControl.position.y + TAB_HEADER_OFFSET_Y,
            },
            size: {
              width: tabControl.size.width - TAB_HEADER_OFFSET_X * 2,
              height: tabControl.size.height - TAB_HEADER_OFFSET_Y - TAB_HEADER_OFFSET_X,
            },
            anchor: { top: true, bottom: false, left: true, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
          });
        }
      }
    }
    onSave(items);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 350,
          backgroundColor: '#fff',
          border: '1px solid #999',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: 12,
        }}
      >
        <div
          style={{
            padding: '6px 8px',
            backgroundColor: '#f0f0f0',
            borderBottom: '1px solid #ccc',
            fontWeight: 600,
          }}
        >
          Tab Pages Editor
        </div>
        <div style={{ padding: 8 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button type="button" onClick={add} style={btnStyle}>
              Add
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={selectedIndex < 0}
              style={btnStyle}
            >
              Remove
            </button>
            <button
              type="button"
              onClick={moveUp}
              disabled={selectedIndex <= 0}
              style={btnStyle}
            >
              Up
            </button>
            <button
              type="button"
              onClick={moveDown}
              disabled={selectedIndex < 0 || selectedIndex >= items.length - 1}
              style={btnStyle}
            >
              Down
            </button>
          </div>
          <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #ccc' }}>
            {items.map((tab, i) => (
              <div
                key={tab.id}
                onClick={() => setSelectedIndex(i)}
                style={{
                  display: 'flex',
                  padding: '2px 4px',
                  backgroundColor:
                    i === selectedIndex
                      ? '#0078d4'
                      : i % 2 === 0
                        ? '#fff'
                        : '#f9f9f9',
                  color: i === selectedIndex ? '#fff' : '#000',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="text"
                  value={tab.title}
                  onChange={(e) => updateTitle(i, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>
            ))}
            {items.length === 0 && (
              <div style={{ padding: 8, color: '#999', textAlign: 'center' }}>
                No tabs
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            padding: '6px 8px',
            borderTop: '1px solid #ccc',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 4,
          }}
        >
          <button type="button" onClick={handleSave} style={btnStyle}>
            OK
          </button>
          <button type="button" onClick={onClose} style={btnStyle}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function collectAllDescendantIds(
  controls: { id: string; properties: Record<string, unknown> }[],
  parentId: string,
): string[] {
  const ids: string[] = [];
  for (const c of controls) {
    if ((c.properties._parentId as string) === parentId) {
      ids.push(c.id);
      ids.push(...collectAllDescendantIds(controls, c.id));
    }
  }
  return ids;
}

const btnStyle: React.CSSProperties = {
  padding: '2px 8px',
  border: '1px solid #ccc',
  backgroundColor: '#f0f0f0',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'Segoe UI, sans-serif',
};
