import type { DesignerControlProps } from './registry';

const STATUS_COLORS: Record<string, string> = {
  Default: '#ff4d4f',
  Error: '#ff4d4f',
  Success: '#52c41a',
  Processing: '#1677ff',
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

  const color = badgeColor || STATUS_COLORS[status] || STATUS_COLORS.Default;
  const displayCount = count > overflowCount ? `${overflowCount}+` : `${count}`;
  const showBadge = dot || count > 0 || showZero;

  const badgeEl = showBadge ? (
    <span
      style={
        dot
          ? {
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: color,
              display: 'inline-block',
            }
          : {
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: color,
              color: '#fff',
              fontSize: 12,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 6px',
              boxSizing: 'border-box' as const,
              lineHeight: 1,
            }
      }
    >
      {dot ? null : displayCount}
    </span>
  ) : null;

  if (!text) {
    return (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        {badgeEl}
      </div>
    );
  }

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 'inherit', fontFamily: 'inherit' }}>{text}</span>
      {showBadge && (
        <span style={{ position: 'absolute', top: -4, right: -4 }}>{badgeEl}</span>
      )}
    </div>
  );
}
