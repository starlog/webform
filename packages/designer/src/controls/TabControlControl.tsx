import { useDesignerStore } from '../stores/designerStore';
import { useTheme } from '../theme/ThemeContext';
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
  const theme = useTheme();
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
        borderBottom: `1px solid ${theme.controls.tabControl.tabBorder}`,
        backgroundColor: theme.controls.tabControl.tabBackground,
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
              border: `1px solid ${theme.controls.tabControl.tabBorder}`,
              borderBottom: i === selectedIndex ? `1px solid ${theme.controls.tabControl.contentBackground}` : 'none',
              backgroundColor: i === selectedIndex ? theme.controls.tabControl.tabActiveBackground : theme.controls.tabControl.tabBackground,
              color: i === selectedIndex ? theme.controls.tabControl.tabActiveForeground : theme.controls.tabControl.tabForeground,
              marginRight: '-1px',
              marginBottom: i === selectedIndex ? '-1px' : '0',
              fontSize: '11px',
              fontFamily: 'Segoe UI, sans-serif',
              borderRadius: theme.controls.tabControl.tabBorderRadius,
              cursor: 'pointer',
            }}
          >
            {name}
          </div>
        ))}
      </div>
      <div style={{
        flex: 1,
        border: `1px solid ${theme.controls.tabControl.contentBorder}`,
        borderTop: 'none',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: theme.controls.tabControl.contentBackground,
      }} />
    </div>
  );
}
