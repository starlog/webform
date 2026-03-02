import {
  sliderInputStyle,
  sliderContainerStyle,
  sliderValueStyle,
  computePercent,
} from '@webform/common';
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
  const percent = computePercent(value, minimum, maximum);

  const resolvedTrackColor = trackColor || colors.background;
  const resolvedFillColor = fillColor || '#1677ff';

  return (
    <div style={{
      ...sliderContainerStyle(colors, isVertical),
      width: size.width,
      height: size.height,
    }}>
      <input
        type="range"
        readOnly
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        style={{
          ...sliderInputStyle({ isVertical, percent, trackColor: resolvedTrackColor, fillColor: resolvedFillColor }),
          cursor: 'default',
          pointerEvents: 'none',
        }}
      />
      {showValue && (
        <span style={sliderValueStyle}>
          {value}
        </span>
      )}
    </div>
  );
}
