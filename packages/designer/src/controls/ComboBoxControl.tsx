import type { DesignerControlProps } from './registry';

export function ComboBoxControl({ properties, size }: DesignerControlProps) {
  const items = (properties.items as string[]) ?? [];
  const selectedIndex = (properties.selectedIndex as number) ?? -1;
  const displayText = selectedIndex >= 0 && selectedIndex < items.length
    ? items[selectedIndex]
    : '';

  const arrowWidth = 17;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      display: 'flex',
      boxSizing: 'border-box',
      border: '1px solid #A0A0A0',
    }}>
      <div style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: '1px 2px',
        fontSize: '12px',
        fontFamily: 'Segoe UI, sans-serif',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
      }}>
        {displayText}
      </div>
      <div style={{
        width: arrowWidth,
        backgroundColor: '#E1E1E1',
        borderLeft: '1px solid #A0A0A0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '8px',
      }}>
        {'\u25BC'}
      </div>
    </div>
  );
}
