interface BooleanToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function BooleanToggle({ value, onChange }: BooleanToggleProps) {
  return (
    <input
      type="checkbox"
      checked={value ?? false}
      onChange={(e) => onChange(e.target.checked)}
      style={{ margin: 0 }}
    />
  );
}
