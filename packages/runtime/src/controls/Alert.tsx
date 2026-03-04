import type { CSSProperties, ReactNode } from 'react';
import { AlertView } from '@webform/common/views';
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
  id, message = 'Alert message', description, alertType = 'Info',
  showIcon = true, closable = false, banner = false, visible = true,
  foreColor, style, onClosed,
}: AlertProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  if (!visible) return null;

  const handleClose = () => {
    updateControlState(id, 'visible', false);
    onClosed?.();
  };

  return (
    <AlertView
      message={message}
      description={description}
      alertType={alertType}
      showIcon={showIcon}
      closable={closable}
      banner={banner}
      interactive
      onClose={handleClose}
      foreColor={foreColor}
      className="wf-alert"
      data-control-id={id}
      style={style}
    />
  );
}
