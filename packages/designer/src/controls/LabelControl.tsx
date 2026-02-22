import type { DesignerControlProps } from './registry';

function getAlignItems(align: string): string {
  if (align.startsWith('Top')) return 'flex-start';
  if (align.startsWith('Middle')) return 'center';
  if (align.startsWith('Bottom')) return 'flex-end';
  return 'flex-start';
}

function getJustifyContent(align: string): string {
  if (align.endsWith('Left')) return 'flex-start';
  if (align.endsWith('Center')) return 'center';
  if (align.endsWith('Right')) return 'flex-end';
  return 'flex-start';
}

export function LabelControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? 'Label';
  const foreColor = (properties.foreColor as string) ?? '#000000';
  const textAlign = (properties.textAlign as string) ?? 'TopLeft';

  return (
    <div style={{
      width: size.width,
      height: size.height,
      color: foreColor,
      fontSize: '12px',
      fontFamily: 'Segoe UI, sans-serif',
      display: 'flex',
      alignItems: getAlignItems(textAlign),
      justifyContent: getJustifyContent(textAlign),
      overflow: 'hidden',
      userSelect: 'none',
      boxSizing: 'border-box',
    }}>
      {text}
    </div>
  );
}
