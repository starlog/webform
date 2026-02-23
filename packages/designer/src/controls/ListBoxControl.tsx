import type { DesignerControlProps } from './registry';

export function ListBoxControl({ properties, size }: DesignerControlProps) {
  const items = (properties.items as string[]) ?? [];
  const selectedIndex = (properties.selectedIndex as number) ?? -1;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: '#FFFFFF',
      border: '1px inset #D0D0D0',
      overflow: 'auto',
      fontSize: 'inherit',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
    }}>
      {items.length === 0 ? (
        <div style={{ padding: '2px 4px', color: '#999' }}>(항목 없음)</div>
      ) : (
        items.map((item, i) => (
          <div
            key={i}
            style={{
              padding: '1px 4px',
              backgroundColor: i === selectedIndex ? '#0078D7' : 'transparent',
              color: i === selectedIndex ? '#FFFFFF' : '#000000',
            }}
          >
            {item}
          </div>
        ))
      )}
    </div>
  );
}
