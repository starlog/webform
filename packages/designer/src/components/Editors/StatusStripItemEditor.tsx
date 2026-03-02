import { useState } from 'react';

interface StatusStripItemData {
  id: string;
  type: 'label' | 'progressBar' | 'dropDownButton';
  text: string;
  spring: boolean;
  width?: number;
  value?: number;
}

interface StatusStripItemEditorProps {
  value: unknown[];
  onChange: (items: unknown[]) => void;
}

function normalizeStatusStripItems(raw: unknown[]): StatusStripItemData[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      return {
        id: (obj.id as string) ?? crypto.randomUUID(),
        type: (['label', 'progressBar', 'dropDownButton'].includes(
          obj.type as string,
        )
          ? obj.type
          : 'label') as StatusStripItemData['type'],
        text: (obj.text as string) ?? '',
        spring: obj.spring === true,
        width: typeof obj.width === 'number' ? obj.width : undefined,
        value: typeof obj.value === 'number' ? obj.value : undefined,
      };
    }
    return {
      id: crypto.randomUUID(),
      type: 'label' as const,
      text: String(item ?? ''),
      spring: false,
    };
  });
}

function denormalizeStatusStripItems(
  items: StatusStripItemData[],
): Record<string, unknown>[] {
  return items.map((item) => {
    const result: Record<string, unknown> = { type: item.type };
    if (item.text) result.text = item.text;
    if (item.spring) result.spring = true;
    if (item.width != null && !item.spring) result.width = item.width;
    if (item.type === 'progressBar' && item.value != null)
      result.value = item.value;
    return result;
  });
}

function getStatusStripLabel(item: StatusStripItemData): string {
  const suffix = item.spring ? ' (spring)' : '';
  return `[${item.type}] ${item.text || '(empty)'}${suffix}`;
}

export function StatusStripItemEditor({
  value,
  onChange,
}: StatusStripItemEditorProps) {
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
        (StatusStrip Items) [{items.length}]
      </button>
      {open && (
        <StatusStripItemModal
          items={normalizeStatusStripItems(items)}
          onClose={() => setOpen(false)}
          onSave={(newItems) => {
            onChange(denormalizeStatusStripItems(newItems));
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

interface StatusStripItemModalProps {
  items: StatusStripItemData[];
  onClose: () => void;
  onSave: (items: StatusStripItemData[]) => void;
}

function StatusStripItemModal({
  items: initial,
  onClose,
  onSave,
}: StatusStripItemModalProps) {
  const [items, setItems] = useState<StatusStripItemData[]>(initial);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const selectedItem =
    selectedIndex >= 0 && selectedIndex < items.length
      ? items[selectedIndex]
      : null;

  const add = () => {
    const newItem: StatusStripItemData = {
      id: crypto.randomUUID(),
      type: 'label',
      text: 'Status',
      spring: false,
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
          StatusStrip Items Editor
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
                  title={getStatusStripLabel(item)}
                >
                  {getStatusStripLabel(item)}
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
                          e.target.value as StatusStripItemData['type'],
                        )
                      }
                      style={selectStyle}
                    >
                      <option value="label">label</option>
                      <option value="progressBar">progressBar</option>
                      <option value="dropDownButton">dropDownButton</option>
                    </select>
                  </PropRow>
                  <PropRow label="text">
                    <input
                      type="text"
                      value={selectedItem.text}
                      onChange={(e) =>
                        updateProperty('text', e.target.value)
                      }
                      style={inputStyle}
                    />
                  </PropRow>
                  <PropRow label="spring">
                    <input
                      type="checkbox"
                      checked={selectedItem.spring}
                      onChange={(e) =>
                        updateProperty('spring', e.target.checked)
                      }
                    />
                  </PropRow>
                  {!selectedItem.spring && (
                    <PropRow label="width">
                      <input
                        type="number"
                        value={selectedItem.width ?? ''}
                        onChange={(e) =>
                          updateProperty(
                            'width',
                            e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          )
                        }
                        min={0}
                        style={inputStyle}
                      />
                    </PropRow>
                  )}
                  {selectedItem.type === 'progressBar' && (
                    <PropRow label="value">
                      <input
                        type="number"
                        value={selectedItem.value ?? 0}
                        onChange={(e) =>
                          updateProperty('value', Number(e.target.value) || 0)
                        }
                        min={0}
                        max={100}
                        style={inputStyle}
                      />
                    </PropRow>
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
