import { useState } from 'react';
import { ItemScriptEditor } from './ItemScriptEditor';

interface MenuItemData {
  id: string;
  text: string;
  shortcut?: string;
  enabled: boolean;
  checked: boolean;
  separator: boolean;
  formId?: string;
  script?: string;
  children?: MenuItemData[];
}

interface MenuItemEditorProps {
  value: unknown[];
  onChange: (items: unknown[]) => void;
}

// --- 정규화: Runtime MenuItem → MenuItemData (id 부여) ---
function normalizeMenuItems(raw: unknown[]): MenuItemData[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      return {
        id: (obj.id as string) ?? crypto.randomUUID(),
        text: (obj.text as string) ?? '',
        shortcut: obj.shortcut as string | undefined,
        enabled: obj.enabled !== false,
        checked: obj.checked === true,
        separator: obj.separator === true,
        formId: obj.formId as string | undefined,
        script: obj.script as string | undefined,
        children: Array.isArray(obj.children)
          ? normalizeMenuItems(obj.children)
          : undefined,
      };
    }
    return {
      id: crypto.randomUUID(),
      text: String(item ?? ''),
      enabled: true,
      checked: false,
      separator: false,
    };
  });
}

// --- 역정규화: MenuItemData → Runtime MenuItem (id 제거) ---
function denormalizeMenuItems(
  items: MenuItemData[],
): Record<string, unknown>[] {
  return items.map((item) => {
    const result: Record<string, unknown> = { text: item.text };
    if (item.shortcut) result.shortcut = item.shortcut;
    if (!item.enabled) result.enabled = false;
    if (item.checked) result.checked = true;
    if (item.separator) result.separator = true;
    if (item.formId) result.formId = item.formId;
    if (item.script) result.script = item.script;
    if (item.children && item.children.length > 0) {
      result.children = denormalizeMenuItems(item.children);
    }
    return result;
  });
}

// --- 트리 유틸 ---
function findItemByPath(
  items: MenuItemData[],
  path: number[],
): MenuItemData | null {
  if (path.length === 0) return null;
  const [head, ...rest] = path;
  const item = items[head];
  if (!item) return null;
  if (rest.length === 0) return item;
  return findItemByPath(item.children ?? [], rest);
}

function updateItemAtPath(
  items: MenuItemData[],
  path: number[],
  updater: (item: MenuItemData) => MenuItemData,
): MenuItemData[] {
  if (path.length === 0) return items;
  const [head, ...rest] = path;
  return items.map((item, i) => {
    if (i !== head) return item;
    if (rest.length === 0) return updater(item);
    return {
      ...item,
      children: updateItemAtPath(item.children ?? [], rest, updater),
    };
  });
}

function removeItemAtPath(
  items: MenuItemData[],
  path: number[],
): MenuItemData[] {
  if (path.length === 0) return items;
  const [head, ...rest] = path;
  if (rest.length === 0) return items.filter((_, i) => i !== head);
  return items.map((item, i) => {
    if (i !== head) return item;
    return { ...item, children: removeItemAtPath(item.children ?? [], rest) };
  });
}

function addItemAtPath(
  items: MenuItemData[],
  path: number[],
  asChild: boolean,
): { items: MenuItemData[]; newPath: number[] } {
  const newItem: MenuItemData = {
    id: crypto.randomUUID(),
    text: 'New Item',
    enabled: true,
    checked: false,
    separator: false,
  };

  if (path.length === 0) {
    // 루트에 추가
    return { items: [...items, newItem], newPath: [items.length] };
  }

  if (asChild) {
    // 선택된 아이템의 자식으로 추가
    const updated = updateItemAtPath(items, path, (item) => ({
      ...item,
      children: [...(item.children ?? []), newItem],
    }));
    const parent = findItemByPath(updated, path);
    const childIdx = (parent?.children?.length ?? 1) - 1;
    return { items: updated, newPath: [...path, childIdx] };
  }

  // 같은 레벨에 추가 (선택된 아이템 다음에)
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1];
  if (parentPath.length === 0) {
    const next = [...items];
    next.splice(idx + 1, 0, newItem);
    return { items: next, newPath: [idx + 1] };
  }
  const updated = updateItemAtPath(items, parentPath, (parent) => {
    const children = [...(parent.children ?? [])];
    children.splice(idx + 1, 0, newItem);
    return { ...parent, children };
  });
  return { items: updated, newPath: [...parentPath, idx + 1] };
}

function moveItemAtPath(
  items: MenuItemData[],
  path: number[],
  direction: 'up' | 'down',
): { items: MenuItemData[]; newPath: number[] } | null {
  if (path.length === 0) return null;
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1];

  const getSiblings = (
    items: MenuItemData[],
    parentPath: number[],
  ): MenuItemData[] => {
    if (parentPath.length === 0) return items;
    const parent = findItemByPath(items, parentPath);
    return parent?.children ?? [];
  };

  const siblings = getSiblings(items, parentPath);
  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= siblings.length) return null;

  const swapped = [...siblings];
  [swapped[idx], swapped[newIdx]] = [swapped[newIdx], swapped[idx]];

  let updated: MenuItemData[];
  if (parentPath.length === 0) {
    updated = swapped;
  } else {
    updated = updateItemAtPath(items, parentPath, (parent) => ({
      ...parent,
      children: swapped,
    }));
  }
  return { items: updated, newPath: [...parentPath, newIdx] };
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// --- 컴포넌트 ---
export function MenuItemEditor({ value, onChange }: MenuItemEditorProps) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(value) ? value : [];

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
        (Menu Items) [{items.length}]
      </button>
      {open && (
        <MenuItemModal
          items={normalizeMenuItems(items)}
          onClose={() => setOpen(false)}
          onSave={(newItems) => {
            onChange(denormalizeMenuItems(newItems));
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

interface MenuItemModalProps {
  items: MenuItemData[];
  onClose: () => void;
  onSave: (items: MenuItemData[]) => void;
}

function MenuItemModal({
  items: initial,
  onClose,
  onSave,
}: MenuItemModalProps) {
  const [items, setItems] = useState<MenuItemData[]>(initial);
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [scriptEditorOpen, setScriptEditorOpen] = useState(false);

  const selectedItem = findItemByPath(items, selectedPath);

  const handleAdd = () => {
    if (selectedPath.length === 0) {
      const newItem: MenuItemData = {
        id: crypto.randomUUID(),
        text: 'New Item',
        enabled: true,
        checked: false,
        separator: false,
      };
      setItems([...items, newItem]);
      setSelectedPath([items.length]);
    } else {
      const result = addItemAtPath(items, selectedPath, false);
      setItems(result.items);
      setSelectedPath(result.newPath);
    }
  };

  const handleAddChild = () => {
    if (selectedPath.length === 0) return;
    const result = addItemAtPath(items, selectedPath, true);
    setItems(result.items);
    setSelectedPath(result.newPath);
  };

  const handleDelete = () => {
    if (selectedPath.length === 0) return;
    const next = removeItemAtPath(items, selectedPath);
    setItems(next);
    setSelectedPath([]);
  };

  const handleMoveUp = () => {
    if (selectedPath.length === 0) return;
    const result = moveItemAtPath(items, selectedPath, 'up');
    if (result) {
      setItems(result.items);
      setSelectedPath(result.newPath);
    }
  };

  const handleMoveDown = () => {
    if (selectedPath.length === 0) return;
    const result = moveItemAtPath(items, selectedPath, 'down');
    if (result) {
      setItems(result.items);
      setSelectedPath(result.newPath);
    }
  };

  const handlePropertyChange = (key: string, val: unknown) => {
    if (selectedPath.length === 0) return;
    setItems(
      updateItemAtPath(items, selectedPath, (item) => ({
        ...item,
        [key]: val,
      })),
    );
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
    >
      <div
        style={{
          width: 550,
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
          Menu Items Editor
        </div>
        <div style={{ padding: 8 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button type="button" onClick={handleAdd} style={btnStyle}>
              Add
            </button>
            <button
              type="button"
              onClick={handleAddChild}
              disabled={selectedPath.length === 0}
              style={btnStyle}
            >
              Add Child
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={selectedPath.length === 0}
              style={btnStyle}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={handleMoveUp}
              disabled={
                selectedPath.length === 0 ||
                selectedPath[selectedPath.length - 1] <= 0
              }
              style={btnStyle}
            >
              Up
            </button>
            <button
              type="button"
              onClick={handleMoveDown}
              disabled={selectedPath.length === 0}
              style={btnStyle}
            >
              Down
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {/* 좌측: 트리뷰 */}
            <div
              style={{
                width: 220,
                minWidth: 220,
                maxHeight: 300,
                overflow: 'auto',
                border: '1px solid #ccc',
              }}
            >
              {items.map((item, i) => (
                <TreeNode
                  key={item.id}
                  item={item}
                  depth={0}
                  path={[i]}
                  selectedPath={selectedPath}
                  onSelect={setSelectedPath}
                />
              ))}
              {items.length === 0 && (
                <div
                  style={{ padding: 8, color: '#999', textAlign: 'center' }}
                >
                  No items
                </div>
              )}
            </div>

            {/* 우측: 속성 패널 */}
            <div
              style={{
                flex: 1,
                maxHeight: 300,
                overflow: 'auto',
                border: '1px solid #ccc',
              }}
            >
              {selectedItem ? (
                <>
                  <PropRow label="text">
                    <input
                      type="text"
                      value={selectedItem.text}
                      onChange={(e) =>
                        handlePropertyChange('text', e.target.value)
                      }
                      style={inputStyle}
                    />
                  </PropRow>
                  <PropRow label="shortcut">
                    <input
                      type="text"
                      value={selectedItem.shortcut ?? ''}
                      onChange={(e) =>
                        handlePropertyChange(
                          'shortcut',
                          e.target.value || undefined,
                        )
                      }
                      style={inputStyle}
                    />
                  </PropRow>
                  <PropRow label="enabled">
                    <input
                      type="checkbox"
                      checked={selectedItem.enabled}
                      onChange={(e) =>
                        handlePropertyChange('enabled', e.target.checked)
                      }
                    />
                  </PropRow>
                  <PropRow label="checked">
                    <input
                      type="checkbox"
                      checked={selectedItem.checked}
                      onChange={(e) =>
                        handlePropertyChange('checked', e.target.checked)
                      }
                    />
                  </PropRow>
                  <PropRow label="separator">
                    <input
                      type="checkbox"
                      checked={selectedItem.separator}
                      onChange={(e) =>
                        handlePropertyChange('separator', e.target.checked)
                      }
                    />
                  </PropRow>
                  <PropRow label="formId">
                    <input
                      type="text"
                      value={selectedItem.formId ?? ''}
                      onChange={(e) =>
                        handlePropertyChange(
                          'formId',
                          e.target.value || undefined,
                        )
                      }
                      placeholder="Form ID to navigate"
                      style={inputStyle}
                    />
                  </PropRow>
                  {!selectedItem.separator && (
                    <PropRow label="script">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <span style={{ flex: 1, fontSize: 11, color: selectedItem.script ? '#333' : '#999' }}>
                          {selectedItem.script ? '(has script)' : 'No script'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setScriptEditorOpen(true)}
                          style={{ ...btnStyle, padding: '0 4px', fontSize: 11 }}
                        >
                          ...
                        </button>
                        {selectedItem.script && (
                          <button
                            type="button"
                            onClick={() => handlePropertyChange('script', undefined)}
                            style={{ ...btnStyle, padding: '0 4px', fontSize: 11 }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </PropRow>
                  )}
                  {scriptEditorOpen && (
                    <ItemScriptEditor
                      script={selectedItem.script ?? ''}
                      onSave={(code) => {
                        handlePropertyChange('script', code || undefined);
                        setScriptEditorOpen(false);
                      }}
                      onClose={() => setScriptEditorOpen(false)}
                    />
                  )}
                </>
              ) : (
                <div
                  style={{ padding: 8, color: '#999', textAlign: 'center' }}
                >
                  Select an item
                </div>
              )}
            </div>
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
          <button
            type="button"
            onClick={() => onSave(items)}
            style={btnStyle}
          >
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

// --- TreeNode ---
interface TreeNodeProps {
  item: MenuItemData;
  depth: number;
  path: number[];
  selectedPath: number[];
  onSelect: (path: number[]) => void;
}

function TreeNode({
  item,
  depth,
  path,
  selectedPath,
  onSelect,
}: TreeNodeProps) {
  const isSelected = arraysEqual(path, selectedPath);
  return (
    <>
      <div
        onClick={() => onSelect(path)}
        style={{
          paddingLeft: 8 + depth * 20,
          paddingRight: 6,
          paddingTop: 3,
          paddingBottom: 3,
          backgroundColor: isSelected ? '#0078d4' : undefined,
          color: isSelected ? '#fff' : '#000',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={item.separator ? '(Separator)' : item.text}
      >
        {item.separator ? '── (Separator) ──' : item.text || '(empty)'}
      </div>
      {item.children?.map((child, i) => (
        <TreeNode
          key={child.id}
          item={child}
          depth={depth + 1}
          path={[...path, i]}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

// --- PropRow ---
function PropRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0' }}>
      <div
        style={{
          width: 70,
          minWidth: 70,
          padding: '3px 4px',
          backgroundColor: '#f9f9f9',
          color: '#555',
          fontSize: 11,
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, padding: '2px 4px' }}>{children}</div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '2px 8px',
  border: '1px solid #ccc',
  backgroundColor: '#f0f0f0',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'Segoe UI, sans-serif',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: 'none',
  padding: '2px 4px',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
};

