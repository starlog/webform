import { useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

interface CollectionEditorProps {
  value: AnyItem[];
  onChange: (value: AnyItem[]) => void;
}

/** 객체 아이템의 요약 라벨을 생성 */
function getItemLabel(item: AnyItem, index: number): string {
  if (item == null) return `[${index}]`;
  if (typeof item === 'string') return item || `(empty)`;
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);
  if (typeof item === 'object') {
    // 의미 있는 첫 번째 문자열 속성을 라벨로 사용
    const labelKeys = ['headerText', 'title', 'name', 'text', 'label', 'field', 'key'];
    for (const key of labelKeys) {
      if (typeof item[key] === 'string' && item[key]) {
        return item[key];
      }
    }
    // 의미 있는 키가 없으면 compact JSON
    return JSON.stringify(item);
  }
  return String(item);
}

/** 기존 아이템의 구조를 기반으로 빈 아이템 생성 */
function createEmptyItem(existing: AnyItem[]): AnyItem {
  const sample = existing.find((item) => item != null && typeof item === 'object');
  if (sample && !Array.isArray(sample)) {
    const empty: Record<string, unknown> = {};
    for (const key of Object.keys(sample)) {
      const val = sample[key];
      if (typeof val === 'string') empty[key] = '';
      else if (typeof val === 'number') empty[key] = 0;
      else if (typeof val === 'boolean') empty[key] = false;
      else empty[key] = null;
    }
    return empty;
  }
  return '';
}

export function CollectionEditor({ value, onChange }: CollectionEditorProps) {
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
        (Collection) [{items.length}]
      </button>
      {open && (
        <CollectionModal
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

interface CollectionModalProps {
  items: AnyItem[];
  onClose: () => void;
  onSave: (items: AnyItem[]) => void;
}

function CollectionModal({ items: initial, onClose, onSave }: CollectionModalProps) {
  const [items, setItems] = useState<AnyItem[]>(() =>
    initial.map((item) =>
      item != null && typeof item === 'object' && !Array.isArray(item)
        ? { ...item }
        : item,
    ),
  );
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const isObjectMode =
    items.length > 0 &&
    items.some((item) => item != null && typeof item === 'object' && !Array.isArray(item));

  const add = () => {
    const newItem = createEmptyItem(items);
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
    [next[selectedIndex - 1], next[selectedIndex]] = [next[selectedIndex], next[selectedIndex - 1]];
    setItems(next);
    setSelectedIndex(selectedIndex - 1);
  };

  const moveDown = () => {
    if (selectedIndex < 0 || selectedIndex >= items.length - 1) return;
    const next = [...items];
    [next[selectedIndex], next[selectedIndex + 1]] = [next[selectedIndex + 1], next[selectedIndex]];
    setItems(next);
    setSelectedIndex(selectedIndex + 1);
  };

  const updateStringItem = (index: number, val: string) => {
    const next = [...items];
    next[index] = val;
    setItems(next);
  };

  const updateObjectProperty = (index: number, key: string, val: string) => {
    const next = [...items];
    const obj = { ...next[index] };
    // 원래 값의 타입에 맞게 변환
    const originalVal = next[index][key];
    if (typeof originalVal === 'number') {
      obj[key] = Number(val) || 0;
    } else if (typeof originalVal === 'boolean') {
      obj[key] = val === 'true';
    } else {
      obj[key] = val;
    }
    next[index] = obj;
    setItems(next);
  };

  const selectedItem =
    selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex] : null;

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
          width: isObjectMode ? 450 : 350,
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
          Collection Editor
        </div>
        <div style={{ padding: 8 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button type="button" onClick={add} style={btnStyle}>Add</button>
            <button type="button" onClick={remove} disabled={selectedIndex < 0} style={btnStyle}>Remove</button>
            <button type="button" onClick={moveUp} disabled={selectedIndex <= 0} style={btnStyle}>Up</button>
            <button type="button" onClick={moveDown} disabled={selectedIndex < 0 || selectedIndex >= items.length - 1} style={btnStyle}>Down</button>
          </div>

          {isObjectMode ? (
            /* 객체 모드: 리스트 + 속성 편집기 */
            <div style={{ display: 'flex', gap: 8 }}>
              {/* 아이템 리스트 */}
              <div style={{ width: 160, minWidth: 160, maxHeight: 250, overflow: 'auto', border: '1px solid #ccc' }}>
                {items.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedIndex(i)}
                    style={{
                      padding: '3px 6px',
                      backgroundColor: i === selectedIndex ? '#0078d4' : i % 2 === 0 ? '#fff' : '#f9f9f9',
                      color: i === selectedIndex ? '#fff' : '#000',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={getItemLabel(item, i)}
                  >
                    {getItemLabel(item, i)}
                  </div>
                ))}
                {items.length === 0 && (
                  <div style={{ padding: 8, color: '#999', textAlign: 'center' }}>No items</div>
                )}
              </div>

              {/* 속성 편집기 */}
              <div style={{ flex: 1, maxHeight: 250, overflow: 'auto', border: '1px solid #ccc' }}>
                {selectedItem != null && typeof selectedItem === 'object' ? (
                  Object.keys(selectedItem).map((key) => (
                    <div key={key} style={{ display: 'flex', borderBottom: '1px solid #f0f0f0' }}>
                      <div
                        style={{
                          width: 70,
                          minWidth: 70,
                          padding: '3px 4px',
                          backgroundColor: '#f9f9f9',
                          color: '#555',
                          fontSize: 11,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={key}
                      >
                        {key}
                      </div>
                      <input
                        type="text"
                        value={String(selectedItem[key] ?? '')}
                        onChange={(e) => updateObjectProperty(selectedIndex, key, e.target.value)}
                        style={{
                          flex: 1,
                          border: 'none',
                          borderLeft: '1px solid #f0f0f0',
                          padding: '3px 4px',
                          fontSize: 12,
                          outline: 'none',
                        }}
                      />
                    </div>
                  ))
                ) : (
                  <div style={{ padding: 8, color: '#999', textAlign: 'center' }}>
                    Select an item
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 문자열 모드: 기존 인라인 편집 */
            <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #ccc' }}>
              {items.map((item, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  style={{
                    display: 'flex',
                    padding: '2px 4px',
                    backgroundColor: i === selectedIndex ? '#0078d4' : i % 2 === 0 ? '#fff' : '#f9f9f9',
                    color: i === selectedIndex ? '#fff' : '#000',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="text"
                    value={String(item ?? '')}
                    onChange={(e) => updateStringItem(i, e.target.value)}
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
                <div style={{ padding: 8, color: '#999', textAlign: 'center' }}>No items</div>
              )}
            </div>
          )}
        </div>
        <div style={{ padding: '6px 8px', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
          <button type="button" onClick={() => onSave(items)} style={btnStyle}>OK</button>
          <button type="button" onClick={onClose} style={btnStyle}>Cancel</button>
        </div>
      </div>
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
