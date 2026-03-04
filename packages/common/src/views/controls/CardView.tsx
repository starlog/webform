import { useState, type CSSProperties, type ReactNode } from 'react';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface CardViewProps {
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  showBorder?: boolean;
  hoverable?: boolean;
  size?: string;
  borderRadius?: number;
  backColor?: string;
  foreColor?: string;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function CardView({
  title = 'Card Title',
  subtitle = '',
  showHeader = true,
  showBorder = true,
  hoverable = false,
  size = 'Default',
  borderRadius = 8,
  backColor,
  foreColor,
  children,
  style,
  className,
  'data-control-id': dataControlId,
}: CardViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('Card', { backColor, foreColor });
  const [isHovered, setIsHovered] = useState(false);

  const isSmall = size === 'Small';
  const headerPadding = isSmall ? '8px 12px' : '12px 16px';

  const containerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
    background: colors.background,
    color: colors.color,
    borderRadius,
    border: showBorder ? theme.controls.panel.border : 'none',
    boxShadow:
      hoverable && isHovered
        ? '0 4px 12px rgba(0,0,0,0.15)'
        : '0 1px 2px rgba(0,0,0,0.06)',
    transition: 'box-shadow 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    cursor: hoverable ? 'pointer' : undefined,
    ...style,
  };

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={containerStyle}
      onMouseEnter={() => hoverable && setIsHovered(true)}
      onMouseLeave={() => hoverable && setIsHovered(false)}
    >
      {showHeader && (
        <div
          style={{
            padding: headerPadding,
            borderBottom: theme.controls.panel.border,
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: isSmall ? '14px' : '16px' }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: '13px', opacity: 0.6, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
      )}
      <div
        style={{
          flex: 1,
          padding: isSmall ? 12 : 16,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
