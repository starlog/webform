import { TabHeaderView } from '@webform/common/views';
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
      <TabHeaderView
        tabNames={tabNames}
        selectedIndex={selectedIndex}
        interactive
        onTabClick={handleTabClick}
      />
      <div style={{
        flex: 1,
        border: theme.controls.tabControl.contentBorder,
        borderTop: 'none',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: theme.controls.tabControl.contentBackground,
      }} />
    </div>
  );
}
