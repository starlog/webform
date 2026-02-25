import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useControlColors } from '../theme/useControlColors';

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

const ALERT_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  Success: { bg: '#f6ffed', border: '#b7eb8f', icon: '✓' },
  Info: { bg: '#e6f4ff', border: '#91caff', icon: 'ℹ' },
  Warning: { bg: '#fffbe6', border: '#ffe58f', icon: '⚠' },
  Error: { bg: '#fff2f0', border: '#ffccc7', icon: '✕' },
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
  backColor,
  style,
  onClosed,
}: AlertProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const colors = useControlColors('Alert', { backColor, foreColor });

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
    color: colors.color,
    boxSizing: 'border-box',
    ...style,
  };

  return (
    <div className="wf-alert" data-control-id={id} style={containerStyle}>
      {showIcon && (
        <span style={{ flexShrink: 0, fontSize: '1.1em', lineHeight: 1.4 }}>
          {alertStyle.icon}
        </span>
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
