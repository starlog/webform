import type { DesignerControlProps } from './registry';

export function PanelControl({ properties, size, children }: DesignerControlProps) {
  const borderStyle = (properties.borderStyle as string) ?? 'None';

  let border = 'none';
  if (borderStyle === 'FixedSingle') border = '1px solid #888888';
  else if (borderStyle === 'Fixed3D') border = '2px inset #D0D0D0';

  return (
    <div style={{
      width: size.width,
      height: size.height,
      border,
      backgroundColor: '#F0F0F0',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {children}
    </div>
  );
}
