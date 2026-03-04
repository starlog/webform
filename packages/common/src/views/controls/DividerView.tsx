import type { CSSProperties } from 'react';
import { DIVIDER_FLEX_MAP } from '../../styles/controlStyles.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface DividerViewProps {
  text?: string;
  orientation?: string;
  textAlign?: string;
  lineStyle?: string;
  lineColor?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function DividerView({
  text,
  orientation = 'Horizontal',
  textAlign = 'Center',
  lineStyle = 'Solid',
  lineColor,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: DividerViewProps) {
  const colors = useViewControlColors('Divider', { backColor, foreColor });
  const resolvedLineColor = lineColor || colors.color;
  const borderStr = `1px ${lineStyle.toLowerCase()} ${resolvedLineColor}`;

  if (orientation === 'Vertical') {
    return (
      <div
        className={className}
        data-control-id={dataControlId}
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

  const [leftFlex, rightFlex] = DIVIDER_FLEX_MAP[textAlign] || DIVIDER_FLEX_MAP.Center;

  if (!text) {
    return (
      <div
        className={className}
        data-control-id={dataControlId}
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
      className={className}
      data-control-id={dataControlId}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxSizing: 'border-box',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        userSelect: 'none',
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
