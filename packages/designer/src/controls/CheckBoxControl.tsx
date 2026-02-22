import type { DesignerControlProps } from './registry';

export function CheckBoxControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? 'CheckBox';
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
        border: '1px solid #848484',
        backgroundColor: '#FFFFFF',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
      }}>
        {checked ? '\u2713' : ''}
      </div>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {text}
      </span>
    </div>
  );
}
