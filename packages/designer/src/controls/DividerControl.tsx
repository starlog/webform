import { DIVIDER_FLEX_MAP } from '@webform/common';
import type { DesignerControlProps } from './registry';
import { useControlColors } from '../theme/useControlColors';

export function DividerControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? '';
  const orientation = (properties.orientation as string) ?? 'Horizontal';
  const textAlign = (properties.textAlign as string) ?? 'Center';
  const lineStyle = (properties.lineStyle as string) ?? 'Solid';
  const colors = useControlColors('Divider', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  const resolvedLineColor = (properties.lineColor as string) || colors.color;
  const borderStr = `1px ${lineStyle.toLowerCase()} ${resolvedLineColor}`;

  if (orientation === 'Vertical') {
    return (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: 'flex',
          justifyContent: 'center',
          boxSizing: 'border-box',
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
        style={{
          width: size.width,
          height: size.height,
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ flex: 1, borderTop: borderStr }} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxSizing: 'border-box',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        userSelect: 'none',
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
