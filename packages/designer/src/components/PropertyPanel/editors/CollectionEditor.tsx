import { useState } from 'react';

interface CollectionEditorProps {
  value: string[];
  onChange: (value: string[]) => void;
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
        <CollectionModal items={items} onClose={() => setOpen(false)} onSave={(newItems) => { onChange(newItems); setOpen(false); }} />
      )}
    </>
  );
}

interface CollectionModalProps {
  items: string[];
  onClose: () => void;
  onSave: (items: string[]) => void;
}

function CollectionModal({ items: initial, onClose, onSave }: CollectionModalProps) {
  const [items, setItems] = useState<string[]>([...initial]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const add = () => {
    setItems([...items, '']);
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

  const updateItem = (index: number, val: string) => {
    const next = [...items];
    next[index] = val;
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
        <div style={{ padding: '6px 8px', backgroundColor: '#f0f0f0', borderBottom: '1px solid #ccc', fontWeight: 600 }}>
          Collection Editor
        </div>
        <div style={{ padding: 8 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button type="button" onClick={add} style={btnStyle}>Add</button>
            <button type="button" onClick={remove} disabled={selectedIndex < 0} style={btnStyle}>Remove</button>
            <button type="button" onClick={moveUp} disabled={selectedIndex <= 0} style={btnStyle}>Up</button>
            <button type="button" onClick={moveDown} disabled={selectedIndex < 0 || selectedIndex >= items.length - 1} style={btnStyle}>Down</button>
          </div>
          <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #ccc' }}>
            {items.map((item, i) => (
              <div
                key={i}
                onClick={() => setSelectedIndex(i)}
                style={{
                  display: 'flex',
                  padding: '2px 4px',
                  backgroundColor: i === selectedIndex ? '#0078d4' : (i % 2 === 0 ? '#fff' : '#f9f9f9'),
                  color: i === selectedIndex ? '#fff' : '#000',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateItem(i, e.target.value)}
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
