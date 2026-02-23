import { useDesignerStore } from '../stores/designerStore';
import type { DesignerControlProps } from './registry';

function getTabNames(properties: Record<string, unknown>): string[] {
  if (properties.tabs && Array.isArray(properties.tabs)) {
    return (properties.tabs as Array<{ title: string }>).map((t) => t.title);
  }
  if (properties.tabPages && Array.isArray(properties.tabPages)) {
    return properties.tabPages as string[];
  }
  return ['TabPage1', 'TabPage2'];
}

export function TabControlControl({ id, properties, size }: DesignerControlProps) {
  const updateControl = useDesignerStore((s) => s.updateControl);
  const selectedIndex = (properties.selectedIndex as number) ?? 0;
  const tabNames = getTabNames(properties);

  const handleTabClick = (index: number) => {
    if (id) {
      updateControl(id, {
        properties: { ...properties, selectedIndex: index },
      });
    }
  };

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
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleTabClick(i);
            }}
            style={{
              padding: '4px 12px',
              border: '1px solid #A0A0A0',
              borderBottom: i === selectedIndex ? '1px solid #FFFFFF' : 'none',
              backgroundColor: i === selectedIndex ? '#FFFFFF' : '#E8E8E8',
              marginRight: '-1px',
              marginBottom: i === selectedIndex ? '-1px' : '0',
              fontSize: '11px',
              fontFamily: 'Segoe UI, sans-serif',
              cursor: 'pointer',
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
      }} />
    </div>
  );
}
