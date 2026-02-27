import type { CSSProperties, ReactNode } from 'react';
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

const ALERT_STYLES: Record<
  string,
  { bg: string; border: string; icon: string; iconColor: string; color: string }
> = {
  Success: { bg: '#f6ffed', border: '#b7eb8f', icon: '✓', iconColor: '#52c41a', color: '#135200' },
  Info: { bg: '#e6f4ff', border: '#91caff', icon: 'ℹ', iconColor: '#1677ff', color: '#003a8c' },
  Warning: { bg: '#fffbe6', border: '#ffe58f', icon: '⚠', iconColor: '#faad14', color: '#614700' },
  Error: { bg: '#fff2f0', border: '#ffccc7', icon: '✕', iconColor: '#ff4d4f', color: '#820014' },
};

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

  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: banner ? 0 : '6px',
    border: banner ? 'none' : `1px solid ${alertStyle.border}`,
    backgroundColor: alertStyle.bg,
    color: foreColor ?? alertStyle.color,
    boxSizing: 'border-box',
    ...style,
  };

  return (
    <div className="wf-alert" data-control-id={id} style={containerStyle}>
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
            cursor: 'pointer',
            fontSize: '0.9em',
            opacity: 0.6,
            lineHeight: 1.4,
          }}
          onClick={handleClose}
        >
          ✕
        </span>
      )}
    </div>
  );
}
