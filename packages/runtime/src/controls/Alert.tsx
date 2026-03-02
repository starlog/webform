import type { CSSProperties, ReactNode } from 'react';
import { ALERT_STYLES, alertContainerStyle, alertIconStyle } from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';

interface AlertProps {
  id: string;
  name: string;
  message?: string;
  description?: string;
  alertType?: 'Success' | 'Info' | 'Warning' | 'Error';
  showIcon?: boolean;
  closable?: boolean;
  banner?: boolean;
  visible?: boolean;
  foreColor?: string;
  backColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onClosed?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Alert({
  id,
  message = 'Alert message',
  description,
  alertType = 'Info',
  showIcon = true,
  closable = false,
  banner = false,
  visible = true,
  foreColor,
  style,
  onClosed,
}: AlertProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  if (!visible) return null;

  const alertStyle = ALERT_STYLES[alertType] || ALERT_STYLES.Info;

  const handleClose = () => {
    updateControlState(id, 'visible', false);
    onClosed?.();
  };

  return (
    <div
      className="wf-alert"
      data-control-id={id}
      style={{ ...alertContainerStyle(alertType, banner, foreColor), ...style }}
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
            cursor: 'pointer',
            fontSize: '0.9em',
            opacity: 0.6,
            lineHeight: 1.4,
          }}
          onClick={handleClose}
        >
          {'\u2715'}
        </span>
      )}
    </div>
  );
}
