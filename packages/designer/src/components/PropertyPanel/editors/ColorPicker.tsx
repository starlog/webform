interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const color = value || '#FFFFFF';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 22,
          height: 18,
          padding: 0,
          border: '1px solid #ccc',
          cursor: 'pointer',
        }}
      />
      <input
        type="text"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          boxSizing: 'border-box',
          padding: '1px 2px',
          border: '1px solid #ccc',
          fontSize: 12,
          fontFamily: 'Segoe UI, sans-serif',
        }}
      />
    </div>
  );
}
