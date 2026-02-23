import type { DesignerControlProps } from './registry';

export function NumericUpDownControl({ properties, size }: DesignerControlProps) {
  const value = (properties.value as number) ?? 0;
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
        fontSize: 'inherit',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
      }}>
        {value}
      </div>
      <div style={{
        width: arrowWidth,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid #A0A0A0',
      }}>
        <div style={{
          flex: 1,
          backgroundColor: '#E1E1E1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '6px',
          borderBottom: '1px solid #A0A0A0',
        }}>
          {'\u25B2'}
        </div>
        <div style={{
          flex: 1,
          backgroundColor: '#E1E1E1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '6px',
        }}>
          {'\u25BC'}
        </div>
      </div>
    </div>
  );
}
