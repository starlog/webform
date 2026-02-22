import type { DesignerControlProps } from './registry';

export function TabControlControl({ properties, size, children }: DesignerControlProps) {
  const selectedIndex = (properties.selectedIndex as number) ?? 0;
  const tabNames = (properties.tabPages as string[]) ?? ['TabPage1', 'TabPage2'];

  return (
    <div style={{
      width: size.width,
      height: size.height,
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #A0A0A0',
        backgroundColor: '#F0F0F0',
        flexShrink: 0,
      }}>
        {tabNames.map((name, i) => (
          <div
            key={i}
            style={{
              padding: '4px 12px',
              border: '1px solid #A0A0A0',
              borderBottom: i === selectedIndex ? '1px solid #FFFFFF' : 'none',
              backgroundColor: i === selectedIndex ? '#FFFFFF' : '#E8E8E8',
              marginRight: '-1px',
              marginBottom: i === selectedIndex ? '-1px' : '0',
              fontSize: '11px',
              fontFamily: 'Segoe UI, sans-serif',
            }}
          >
            {name}
          </div>
        ))}
      </div>
      <div style={{
        flex: 1,
        border: '1px solid #A0A0A0',
        borderTop: 'none',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
      }}>
        {children}
      </div>
    </div>
  );
}
