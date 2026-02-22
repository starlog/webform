import type { DesignerControlProps } from './registry';

export function RadioButtonControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? 'RadioButton';
  const checked = (properties.checked as boolean) ?? false;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '12px',
      fontFamily: 'Segoe UI, sans-serif',
      userSelect: 'none',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: 13,
        height: 13,
        borderRadius: '50%',
        border: '1px solid #848484',
        backgroundColor: '#FFFFFF',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {checked && (
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: '#000000',
          }} />
        )}
      </div>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {text}
      </span>
    </div>
  );
}
