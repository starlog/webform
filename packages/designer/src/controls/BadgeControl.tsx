import type { CSSProperties } from 'react';
import type { DesignerControlProps } from './registry';

const STATUS_COLORS: Record<string, string> = {
  Default: '#ff4d4f',
  Success: '#52c41a',
  Processing: '#1677ff',
  Error: '#ff4d4f',
  Warning: '#faad14',
};

export function BadgeControl({ properties, size }: DesignerControlProps) {
  const count = (properties.count as number) ?? 0;
  const overflowCount = (properties.overflowCount as number) ?? 99;
  const showZero = (properties.showZero as boolean) ?? false;
  const dot = (properties.dot as boolean) ?? false;
  const status = (properties.status as string) ?? 'Default';
  const text = (properties.text as string) ?? '';
  const badgeColor = (properties.badgeColor as string) ?? '';

  const resolvedColor = badgeColor || STATUS_COLORS[status] || STATUS_COLORS.Default;
  const displayCount = count > overflowCount ? `${overflowCount}+` : `${count}`;
  const shouldShowBadge = dot || count > 0 || showZero;

  const badgeBaseStyle: CSSProperties = {
    backgroundColor: resolvedColor,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    lineHeight: 1,
  };

  const dotStyle: CSSProperties = {
    ...badgeBaseStyle,
    width: 6,
    height: 6,
    borderRadius: '50%',
  };

  const countStyle: CSSProperties = {
    ...badgeBaseStyle,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    fontSize: '0.75em',
    padding: '0 6px',
    boxSizing: 'border-box',
  };

  const renderBadge = (positioned: boolean) => {
    if (!shouldShowBadge) return null;

    const posStyle: CSSProperties = positioned
      ? { position: 'absolute', top: 0, right: 0, transform: 'translate(50%, -50%)' }
      : {};

    if (dot) {
      return <span style={{ ...dotStyle, ...posStyle }} />;
    }
    return <span style={{ ...countStyle, ...posStyle }}>{displayCount}</span>;
  };

  if (text) {
    return (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: 'inline-flex',
          position: 'relative',
          alignItems: 'center',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 'inherit', fontFamily: 'inherit' }}>{text}</span>
        {renderBadge(true)}
      </div>
    );
  }

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: 'inline-flex',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {renderBadge(false)}
    </div>
  );
}
