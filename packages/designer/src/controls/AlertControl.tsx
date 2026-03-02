import type { DesignerControlProps } from './registry';

const ALERT_STYLES: Record<
  string,
  { bg: string; border: string; icon: string; iconColor: string; color: string }
> = {
  Success: { bg: '#f6ffed', border: '#b7eb8f', icon: '✓', iconColor: '#52c41a', color: '#135200' },
  Info: { bg: '#e6f4ff', border: '#91caff', icon: 'ℹ', iconColor: '#1677ff', color: '#003a8c' },
  Warning: { bg: '#fffbe6', border: '#ffe58f', icon: '⚠', iconColor: '#faad14', color: '#614700' },
  Error: { bg: '#fff2f0', border: '#ffccc7', icon: '✕', iconColor: '#ff4d4f', color: '#820014' },
};

export function AlertControl({ properties, size }: DesignerControlProps) {
  const message = (properties.message as string) ?? 'Alert message';
  const description = (properties.description as string) ?? '';
  const alertType = (properties.alertType as string) ?? 'Info';
  const showIcon = (properties.showIcon as boolean) ?? true;
  const closable = (properties.closable as boolean) ?? false;
  const banner = (properties.banner as boolean) ?? false;
  const foreColor = properties.foreColor as string | undefined;

  const alertStyle = ALERT_STYLES[alertType] || ALERT_STYLES.Info;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: alertStyle.bg,
        border: banner ? 'none' : `1px solid ${alertStyle.border}`,
        borderRadius: banner ? 0 : '6px',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        color: foreColor ?? alertStyle.color,
        userSelect: 'none',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {showIcon && (
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: alertStyle.iconColor,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {alertStyle.icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 'bold' }}>{message}</div>
        {description && (
          <div style={{ fontSize: '0.9em', marginTop: '4px', opacity: 0.85 }}>{description}</div>
        )}
      </div>
      {closable && (
        <span
          style={{
            flexShrink: 0,
            cursor: 'default',
            fontSize: '0.9em',
            opacity: 0.6,
            lineHeight: 1.4,
          }}
        >
          ✕
        </span>
      )}
    </div>
  );
}
