import type { CSSProperties, ReactNode } from 'react';
import { CardView } from '@webform/common/views';

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
  id, title = 'Card Title', subtitle = '', showHeader = true, showBorder = true,
  hoverable = false, size = 'Default', borderRadius = 8,
  backColor, foreColor, style, children,
}: CardProps) {
  return (
    <CardView
      title={title}
      subtitle={subtitle}
      showHeader={showHeader}
      showBorder={showBorder}
      hoverable={hoverable}
      size={size}
      borderRadius={borderRadius}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-card"
      data-control-id={id}
      style={style}
    >
      {children}
    </CardView>
  );
}
