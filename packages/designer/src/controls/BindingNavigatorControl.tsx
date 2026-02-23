import type { DesignerControlProps } from './registry';

export function BindingNavigatorControl({ properties, size }: DesignerControlProps) {
  const backColor = (properties.backColor as string) ?? '#F0F0F0';
  const showAddButton = (properties.showAddButton as boolean) ?? true;
  const showDeleteButton = (properties.showDeleteButton as boolean) ?? true;

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 20,
    fontSize: 11,
    cursor: 'default',
    borderRadius: 2,
  };

  const sepStyle: React.CSSProperties = {
    width: 1,
    height: 16,
    backgroundColor: '#C0C0C0',
    margin: '0 3px',
  };

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: backColor,
        borderBottom: '1px solid #D0D0D0',
        display: 'flex',
        alignItems: 'center',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fontSize: '12px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        paddingLeft: 2,
        paddingRight: 2,
        gap: 1,
      }}
    >
      <div style={btnStyle} title="Move first">|&#9664;</div>
      <div style={btnStyle} title="Move previous">&#9664;</div>
      <div style={sepStyle} />
      <input
        type="text"
        value="1"
        readOnly
        style={{
          width: 32,
          height: 18,
          textAlign: 'center',
          fontSize: 11,
          border: '1px solid #C0C0C0',
          padding: 0,
        }}
      />
      <span style={{ fontSize: 11, margin: '0 2px' }}>/ 10</span>
      <div style={sepStyle} />
      <div style={btnStyle} title="Move next">&#9654;</div>
      <div style={btnStyle} title="Move last">&#9654;|</div>
      {(showAddButton || showDeleteButton) && <div style={sepStyle} />}
      {showAddButton && <div style={btnStyle} title="Add new">&#10010;</div>}
      {showDeleteButton && <div style={btnStyle} title="Delete">&#10005;</div>}
    </div>
  );
}
