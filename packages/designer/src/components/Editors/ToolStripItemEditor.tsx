import { useState } from 'react';
import { ItemScriptEditor } from './ItemScriptEditor';

interface ToolStripItemData {
  id: string;
  type: 'button' | 'separator' | 'label' | 'dropdown';
  text: string;
  icon?: string;
  tooltip?: string;
  enabled: boolean;
  checked: boolean;
  script?: string;
}

interface ToolStripItemEditorProps {
  value: unknown[];
  onChange: (items: unknown[]) => void;
}

function normalizeToolStripItems(raw: unknown[]): ToolStripItemData[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      return {
        id: (obj.id as string) ?? crypto.randomUUID(),
        type: (['button', 'separator', 'label', 'dropdown'].includes(
          obj.type as string,
        )
          ? obj.type
          : 'button') as ToolStripItemData['type'],
        text: (obj.text as string) ?? '',
        icon: obj.icon as string | undefined,
        tooltip: obj.tooltip as string | undefined,
        enabled: obj.enabled !== false,
        checked: obj.checked === true,
        script: obj.script as string | undefined,
      };
    }
    return {
      id: crypto.randomUUID(),
      type: 'button' as const,
      text: String(item ?? ''),
      enabled: true,
      checked: false,
    };
  });
}

function denormalizeToolStripItems(
  items: ToolStripItemData[],
): Record<string, unknown>[] {
  return items.map((item) => {
    const result: Record<string, unknown> = { type: item.type };
    if (item.type !== 'separator') {
      if (item.text) result.text = item.text;
      if (item.icon) result.icon = item.icon;
      if (item.tooltip) result.tooltip = item.tooltip;
      if (!item.enabled) result.enabled = false;
      if (item.checked) result.checked = true;
      if (item.script) result.script = item.script;
    }
    return result;
  });
}

function getToolStripLabel(item: ToolStripItemData): string {
  if (item.type === 'separator') return '── (Separator) ──';
  const icon = item.icon ? `${item.icon} ` : '';
  return `[${item.type}] ${icon}${item.text || '(empty)'}`;
}

export function ToolStripItemEditor({
  value,
  onChange,
}: ToolStripItemEditorProps) {
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
        (ToolStrip Items) [{items.length}]
      </button>
      {open && (
        <ToolStripItemModal
          items={normalizeToolStripItems(items)}
          onClose={() => setOpen(false)}
          onSave={(newItems) => {
            onChange(denormalizeToolStripItems(newItems));
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

interface ToolStripItemModalProps {
  items: ToolStripItemData[];
  onClose: () => void;
  onSave: (items: ToolStripItemData[]) => void;
}

function ToolStripItemModal({
  items: initial,
  onClose,
  onSave,
}: ToolStripItemModalProps) {
  const [items, setItems] = useState<ToolStripItemData[]>(initial);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [scriptEditorOpen, setScriptEditorOpen] = useState(false);

  const selectedItem =
    selectedIndex >= 0 && selectedIndex < items.length
      ? items[selectedIndex]
      : null;

  const add = () => {
    const newItem: ToolStripItemData = {
      id: crypto.randomUUID(),
      type: 'button',
      text: 'Button',
      enabled: true,
      checked: false,
    };
    setItems([...items, newItem]);
    setSelectedIndex(items.length);
  };

  const remove = () => {
    if (selectedIndex < 0 || selectedIndex >= items.length) return;
    const next = items.filter((_, i) => i !== selectedIndex);
    setItems(next);
    setSelectedIndex(Math.min(selectedIndex, next.length - 1));
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

  const updateProperty = (key: string, val: unknown) => {
    if (selectedIndex < 0) return;
    const next = [...items];
    next[selectedIndex] = { ...next[selectedIndex], [key]: val };
    setItems(next);
  };

  const isSeparator = selectedItem?.type === 'separator';

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
          width: 450,
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
          ToolStrip Items Editor
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
              Delete
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

          <div style={{ display: 'flex', gap: 8 }}>
            {/* 좌측: 리스트 */}
            <div
              style={{
                width: 180,
                minWidth: 180,
                maxHeight: 300,
                overflow: 'auto',
                border: '1px solid #ccc',
              }}
            >
              {items.map((item, i) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedIndex(i)}
                  style={{
                    padding: '3px 6px',
                    backgroundColor:
                      i === selectedIndex
                        ? '#0078d4'
                        : i % 2 === 0
                          ? '#fff'
                          : '#f9f9f9',
                    color: i === selectedIndex ? '#fff' : '#000',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={getToolStripLabel(item)}
                >
                  {getToolStripLabel(item)}
                </div>
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
                  <PropRow label="type">
                    <select
                      value={selectedItem.type}
                      onChange={(e) =>
                        updateProperty(
                          'type',
                          e.target.value as ToolStripItemData['type'],
                        )
                      }
                      style={selectStyle}
                    >
                      <option value="button">button</option>
                      <option value="separator">separator</option>
                      <option value="label">label</option>
                      <option value="dropdown">dropdown</option>
                    </select>
                  </PropRow>
                  <PropRow label="text">
                    <input
                      type="text"
                      value={selectedItem.text}
                      onChange={(e) =>
                        updateProperty('text', e.target.value)
                      }
                      disabled={isSeparator}
                      style={inputStyle}
                    />
                  </PropRow>
                  <PropRow label="icon">
                    <input
                      type="text"
                      value={selectedItem.icon ?? ''}
                      onChange={(e) =>
                        updateProperty(
                          'icon',
                          e.target.value || undefined,
                        )
                      }
                      disabled={isSeparator}
                      placeholder="e.g. 📁, ✂, ⚙"
                      style={inputStyle}
                    />
                  </PropRow>
                  <PropRow label="tooltip">
                    <input
                      type="text"
                      value={selectedItem.tooltip ?? ''}
                      onChange={(e) =>
                        updateProperty(
                          'tooltip',
                          e.target.value || undefined,
                        )
                      }
                      disabled={isSeparator}
                      style={inputStyle}
                    />
                  </PropRow>
                  <PropRow label="enabled">
                    <input
                      type="checkbox"
                      checked={selectedItem.enabled}
                      onChange={(e) =>
                        updateProperty('enabled', e.target.checked)
                      }
                      disabled={isSeparator}
                    />
                  </PropRow>
                  <PropRow label="checked">
                    <input
                      type="checkbox"
                      checked={selectedItem.checked}
                      onChange={(e) =>
                        updateProperty('checked', e.target.checked)
                      }
                      disabled={isSeparator}
                    />
                  </PropRow>
                  {!isSeparator && (
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
                            onClick={() => updateProperty('script', undefined)}
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
                        updateProperty('script', code || undefined);
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

const selectStyle: React.CSSProperties = {
  width: '100%',
  border: 'none',
  padding: '2px 2px',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
};

