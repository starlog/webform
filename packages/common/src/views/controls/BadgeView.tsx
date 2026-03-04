import { useState, useEffect, type CSSProperties } from 'react';
import { BADGE_STATUS_COLORS } from '../../styles/controlStyles.js';

export interface BadgeViewProps {
  count?: number;
  overflowCount?: number;
  showZero?: boolean;
  dot?: boolean;
  status?: string;
  text?: string;
  badgeColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function BadgeView({
  count = 0,
  overflowCount = 99,
  showZero = false,
  dot = false,
  status = 'Default',
  text = '',
  badgeColor,
  style,
  className,
  'data-control-id': dataControlId,
}: BadgeViewProps) {
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    if (status !== 'Processing') return;
    const timer = setInterval(() => setPulse((p) => !p), 800);
    return () => clearInterval(timer);
  }, [status]);

  const resolvedColor = badgeColor || BADGE_STATUS_COLORS[status] || BADGE_STATUS_COLORS.Default;
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
        className={className}
        data-control-id={dataControlId}
        style={{
          display: 'inline-flex',
          position: 'relative',
          alignItems: 'center',
          userSelect: 'none',
          ...style,
        }}
      >
        <span style={{ fontSize: 'inherit', fontFamily: 'inherit' }}>{text}</span>
        {renderBadge(true)}
      </div>
    );
  }

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={{
        display: 'inline-flex',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        ...style,
      }}
    >
      {renderBadge(false)}
    </div>
  );
}
