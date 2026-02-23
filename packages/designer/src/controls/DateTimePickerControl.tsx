import type { DesignerControlProps } from './registry';

export function DateTimePickerControl({ properties, size }: DesignerControlProps) {
  const format = (properties.format as string) ?? 'Short';
  const displayText = format === 'Long'
    ? '2026\uB144 2\uC6D4 22\uC77C \uC77C\uC694\uC77C'
    : '2026-02-22';
  const arrowWidth = 21;

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
        padding: '1px 4px',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
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
        fontSize: '10px',
      }}>
        {'\u25BC'}
      </div>
    </div>
  );
}
