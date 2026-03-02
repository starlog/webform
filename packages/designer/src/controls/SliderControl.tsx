import type { CSSProperties } from 'react';
import type { DesignerControlProps } from './registry';
import { useControlColors } from '../theme/useControlColors';

export function SliderControl({ properties, size }: DesignerControlProps) {
  const value = (properties.value as number) ?? 0;
  const minimum = (properties.minimum as number) ?? 0;
  const maximum = (properties.maximum as number) ?? 100;
  const step = (properties.step as number) ?? 1;
  const orientation = (properties.orientation as string) ?? 'Horizontal';
  const showValue = (properties.showValue as boolean) ?? true;
  const trackColor = properties.trackColor as string | undefined;
  const fillColor = properties.fillColor as string | undefined;
  const colors = useControlColors('Slider', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  const isVertical = orientation === 'Vertical';
  const range = maximum - minimum || 1;
  const percent = Math.max(0, Math.min(100, ((value - minimum) / range) * 100));

  const resolvedTrackColor = trackColor || colors.background;
  const resolvedFillColor = fillColor || '#1677ff';

  const inputStyle: CSSProperties = {
    width: isVertical ? undefined : '100%',
    height: isVertical ? '100%' : undefined,
    cursor: 'default',
    accentColor: resolvedFillColor,
    background: `linear-gradient(${isVertical ? 'to top' : 'to right'}, ${resolvedFillColor} 0%, ${resolvedFillColor} ${percent}%, ${resolvedTrackColor} ${percent}%, ${resolvedTrackColor} 100%)`,
    borderRadius: '4px',
    margin: 0,
    pointerEvents: 'none',
  };

  const containerStyle: CSSProperties = {
    width: size.width,
    height: size.height,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxSizing: 'border-box',
    color: colors.color,
  };

  if (isVertical) {
    containerStyle.flexDirection = 'column';
    containerStyle.writingMode = 'vertical-lr';
    containerStyle.direction = 'rtl';
  }

  return (
    <div style={containerStyle}>
      <input
        type="range"
        readOnly
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        style={inputStyle}
      />
      {showValue && (
        <span
          style={{
            fontSize: '0.85em',
            minWidth: '2em',
            textAlign: 'center',
            writingMode: 'horizontal-tb',
            direction: 'ltr',
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
