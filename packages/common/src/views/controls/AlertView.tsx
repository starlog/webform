import type { CSSProperties } from 'react';
import { ALERT_STYLES, alertContainerStyle, alertIconStyle } from '../../styles/controlStyles.js';

export interface AlertViewProps {
  message?: string;
  description?: string;
  alertType?: string;
  showIcon?: boolean;
  closable?: boolean;
  banner?: boolean;
  interactive?: boolean;
  onClose?: () => void;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function AlertView({
  message = 'Alert message',
  description,
  alertType = 'Info',
  showIcon = true,
  closable = false,
  banner = false,
  interactive = false,
  onClose,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: AlertViewProps) {
  const alertStyle = ALERT_STYLES[alertType] || ALERT_STYLES.Info;

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={{ ...alertContainerStyle(alertType, banner, foreColor), ...style }}
    >
      {showIcon && (
        <div style={alertIconStyle(alertType)}>{alertStyle.icon}</div>
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
            cursor: interactive ? 'pointer' : 'default',
            fontSize: '0.9em',
            opacity: 0.6,
            lineHeight: 1.4,
          }}
          onClick={interactive ? onClose : undefined}
        >
          {'\u2715'}
        </span>
      )}
    </div>
  );
}
