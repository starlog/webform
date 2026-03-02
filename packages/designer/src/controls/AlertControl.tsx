import { ALERT_STYLES, alertContainerStyle, alertIconStyle } from '@webform/common';
import type { DesignerControlProps } from './registry';

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
        ...alertContainerStyle(alertType, banner, foreColor),
        width: size.width,
        height: size.height,
      }}
    >
      {showIcon && (
        <div style={alertIconStyle(alertType)}>
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
          {'\u2715'}
        </span>
      )}
    </div>
  );
}
