import type { CSSProperties } from 'react';

export interface CollapseHeaderViewProps {
  title: string;
  isActive: boolean;
  expandIconPosition?: string;
  interactive?: boolean;
  onClick?: () => void;
}

export function CollapseHeaderView({
  title,
  isActive,
  expandIconPosition = 'Start',
  interactive = false,
  onClick,
}: CollapseHeaderViewProps) {
  const icon = (
    <span
      style={{
        fontSize: '0.7em',
        display: 'inline-block',
        transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: interactive ? 'transform 0.3s' : undefined,
      }}
    >
      ▶
    </span>
  );

  const headerStyle: CSSProperties = {
    padding: '8px 12px',
    backgroundColor: 'rgba(0,0,0,0.02)',
    cursor: interactive ? 'pointer' : 'default',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    userSelect: 'none',
    flexShrink: 0,
  };

  const handleClick = interactive
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        onClick?.();
      }
    : undefined;

  const handleMouseDown = interactive
    ? (e: React.MouseEvent) => e.stopPropagation()
    : undefined;

  return (
    <div style={headerStyle} onMouseDown={handleMouseDown} onClick={handleClick}>
      {expandIconPosition === 'Start' && icon}
      <span style={{ flex: 1 }}>{title}</span>
      {expandIconPosition === 'End' && icon}
    </div>
  );
}
