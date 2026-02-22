import type { DesignerControlProps } from './registry';

export function GroupBoxControl({ properties, size, children }: DesignerControlProps) {
  const text = (properties.text as string) ?? 'GroupBox';

  return (
    <fieldset style={{
      width: size.width,
      height: size.height,
      border: '1px solid #D0D0D0',
      borderRadius: '2px',
      margin: 0,
      padding: '8px 4px 4px',
      position: 'relative',
      boxSizing: 'border-box',
      fontSize: '12px',
      fontFamily: 'Segoe UI, sans-serif',
    }}>
      <legend style={{
        padding: '0 4px',
        fontSize: '12px',
        color: '#000',
      }}>
        {text}
      </legend>
      {children}
    </fieldset>
  );
}
