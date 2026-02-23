import type { DesignerControlProps } from './registry';

export function TextBoxControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? '';
  const multiline = (properties.multiline as boolean) ?? false;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: '#FFFFFF',
      border: '1px inset #D0D0D0',
      padding: '1px 2px',
      fontSize: 'inherit',
      fontFamily: 'inherit',
      overflow: 'hidden',
      whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
      color: '#000',
      boxSizing: 'border-box',
    }}>
      {text}
    </div>
  );
}
