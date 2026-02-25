import { useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import { useControlColors } from '../theme/useControlColors';

interface BadgeProps {
  id: string;
  name: string;
  count?: number;
  overflowCount?: number;
  showZero?: boolean;
  dot?: boolean;
  status?: 'Default' | 'Success' | 'Processing' | 'Error' | 'Warning';
  text?: string;
  badgeColor?: string;
  offset?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

const STATUS_COLORS: Record<string, string> = {
  Default: '#ff4d4f',
  Success: '#52c41a',
  Processing: '#1677ff',
  Error: '#ff4d4f',
  Warning: '#faad14',
};

export function Badge({
  id,
  count = 0,
  overflowCount = 99,
  showZero = false,
  dot = false,
  status = 'Default',
  text = '',
  badgeColor,
  backColor,
  foreColor,
  style,
}: BadgeProps) {
  useControlColors('Badge', { backColor, foreColor });

  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    if (status !== 'Processing') return;
    const timer = setInterval(() => setPulse((p: boolean) => !p), 800);
    return () => clearInterval(timer);
  }, [status]);

  const resolvedColor = badgeColor || STATUS_COLORS[status] || STATUS_COLORS.Default;
  const shouldShowBadge = dot || count > 0 || showZero;
  const displayCount = count > overflowCount ? `${overflowCount}+` : `${count}`;

  const badgeBaseStyle: CSSProperties = {
    backgroundColor: resolvedColor,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    lineHeight: 1,
    opacity: status === 'Processing' ? (pulse ? 1 : 0.4) : 1,
    transition: 'opacity 0.4s ease',
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
        className="wf-badge"
        data-control-id={id}
        style={{ display: 'inline-flex', position: 'relative', alignItems: 'center', ...style }}
      >
        <span>{text}</span>
        {renderBadge(true)}
      </div>
    );
  }

  return (
    <div
      className="wf-badge"
      data-control-id={id}
      style={{ display: 'inline-flex', position: 'relative', alignItems: 'center', ...style }}
    >
      {renderBadge(false)}
    </div>
  );
}
