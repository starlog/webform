import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

interface CardProps {
  id: string;
  name: string;
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  showBorder?: boolean;
  hoverable?: boolean;
  size?: 'Default' | 'Small';
  borderRadius?: number;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Card({
  id,
  title = 'Card Title',
  subtitle = '',
  showHeader = true,
  showBorder = true,
  hoverable = false,
  size = 'Default',
  borderRadius = 8,
  backColor,
  foreColor,
  style,
  children,
}: CardProps) {
  const theme = useTheme();
  const colors = useControlColors('Card', { backColor, foreColor });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    if (hoverable) setIsHovered(true);
  };
  const handleMouseLeave = () => {
    if (hoverable) setIsHovered(false);
  };

  const isSmall = size === 'Small';

  const containerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
    backgroundColor: colors.backgroundColor,
    color: colors.color,
    borderRadius,
    border: showBorder ? theme.controls.panel.border : 'none',
    boxShadow: hoverable && isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.06)',
    transition: 'box-shadow 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    ...style,
  };

  const headerPadding = isSmall ? '8px 12px' : '12px 16px';

  return (
    <div
      className="wf-card"
      data-control-id={id}
      style={containerStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showHeader && (
        <div style={{ padding: headerPadding, borderBottom: theme.controls.panel.border }}>
          <div style={{ fontWeight: 600, fontSize: isSmall ? '14px' : '16px' }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: '13px', opacity: 0.6, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
      )}
      <div style={{ position: 'relative', flex: 1, padding: isSmall ? '12px' : '16px' }}>
        {children}
      </div>
    </div>
  );
}
