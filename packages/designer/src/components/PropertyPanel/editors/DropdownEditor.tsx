type DropdownOption = string | { label: string; value: string };

interface DropdownEditorProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}

export function DropdownEditor({ value, options, onChange }: DropdownEditorProps) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '1px 2px',
        border: '1px solid #ccc',
        fontSize: 12,
        fontFamily: 'Segoe UI, sans-serif',
      }}
    >
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        return (
          <option key={val} value={val}>{label}</option>
        );
      })}
    </select>
  );
}
