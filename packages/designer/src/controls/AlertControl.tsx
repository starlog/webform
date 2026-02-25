import type { DesignerControlProps } from './registry';

const ALERT_STYLES = {
  Success: { bg: '#f6ffed', border: '#b7eb8f', icon: '✓', color: '#52c41a' },
  Info: { bg: '#e6f4ff', border: '#91caff', icon: 'ℹ', color: '#1677ff' },
  Warning: { bg: '#fffbe6', border: '#ffe58f', icon: '⚠', color: '#faad14' },
  Error: { bg: '#fff2f0', border: '#ffccc7', icon: '✕', color: '#ff4d4f' },
} as const;

type AlertType = keyof typeof ALERT_STYLES;

export function AlertControl({ properties, size }: DesignerControlProps) {
  const message = (properties.message as string) ?? 'Alert message';
  const description = (properties.description as string) ?? '';
  const alertType = (properties.alertType as AlertType) ?? 'Info';
  const showIcon = (properties.showIcon as boolean) ?? true;
  const closable = (properties.closable as boolean) ?? false;
  const banner = (properties.banner as boolean) ?? false;

  const style = ALERT_STYLES[alertType] ?? ALERT_STYLES.Info;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: style.bg,
        border: banner ? 'none' : `1px solid ${style.border}`,
        borderRadius: banner ? 0 : 6,
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontSize: 'inherit',
        fontFamily: 'inherit',
        userSelect: 'none',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {showIcon && (
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: style.color,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {style.icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 'bold',
            color: 'rgba(0,0,0,0.88)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {message}
        </div>
        {description && (
          <div
            style={{
              color: 'rgba(0,0,0,0.65)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {description}
          </div>
        )}
      </div>
      {closable && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 12,
            cursor: 'default',
            color: 'rgba(0,0,0,0.45)',
            fontSize: 14,
          }}
        >
          ✕
        </div>
      )}
    </div>
  );
}
