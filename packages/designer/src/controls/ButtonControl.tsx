import type { DesignerControlProps } from './registry';

export function ButtonControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? 'Button';

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: '#E1E1E1',
      border: '1px outset #D0D0D0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 'inherit',
      fontFamily: 'inherit',
      userSelect: 'none',
      boxSizing: 'border-box',
    }}>
      {text}
    </div>
  );
}
