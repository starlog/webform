import type { CSSProperties, ReactNode } from 'react';
import { useControlColors } from '../theme/useControlColors';

interface DividerProps {
  id: string;
  name: string;
  text?: string;
  orientation?: 'Horizontal' | 'Vertical';
  textAlign?: 'Left' | 'Center' | 'Right';
  lineStyle?: 'Solid' | 'Dashed' | 'Dotted';
  lineColor?: string;
  foreColor?: string;
  backColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Divider({
  id,
  text,
  orientation = 'Horizontal',
  textAlign = 'Center',
  lineStyle = 'Solid',
  lineColor,
  foreColor,
  backColor,
  style,
}: DividerProps) {
  const colors = useControlColors('Divider', { backColor, foreColor });

  const resolvedLineColor = lineColor || colors.color;
  const borderStr = `1px ${lineStyle.toLowerCase()} ${resolvedLineColor}`;

  if (orientation === 'Vertical') {
    return (
      <div
        className="wf-divider"
        data-control-id={id}
        style={{
          display: 'flex',
          justifyContent: 'center',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        <div style={{ height: '100%', borderLeft: borderStr }} />
      </div>
    );
  }

  const flexMap: Record<string, [number, number]> = {
    Left: [0.05, 0.95],
    Center: [1, 1],
    Right: [0.95, 0.05],
  };

  const [leftFlex, rightFlex] = flexMap[textAlign] || flexMap.Center;

  if (!text) {
    return (
      <div
        className="wf-divider"
        data-control-id={id}
        style={{
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
          ...style,
        }}
      >
        <div style={{ flex: 1, borderTop: borderStr }} />
      </div>
    );
  }

  return (
    <div
      className="wf-divider"
      data-control-id={id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div style={{ flex: leftFlex, borderTop: borderStr }} />
      <span
        style={{
          color: colors.color,
          fontSize: '0.9em',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {text}
      </span>
      <div style={{ flex: rightFlex, borderTop: borderStr }} />
    </div>
  );
}
