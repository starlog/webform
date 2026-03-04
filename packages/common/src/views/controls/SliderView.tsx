import type { CSSProperties } from 'react';
import {
  sliderInputStyle,
  sliderContainerStyle,
  sliderValueStyle,
  computePercent,
} from '../../styles/controlStyles.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface SliderViewProps {
  value?: number;
  minimum?: number;
  maximum?: number;
  step?: number;
  orientation?: string;
  showValue?: boolean;
  trackColor?: string;
  fillColor?: string;
  interactive?: boolean;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function SliderView({
  value = 0,
  minimum = 0,
  maximum = 100,
  step = 1,
  orientation = 'Horizontal',
  showValue = true,
  trackColor,
  fillColor,
  interactive = false,
  disabled,
  onChange,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: SliderViewProps) {
  const colors = useViewControlColors('Slider', { backColor, foreColor });
  const isVertical = orientation === 'Vertical';
  const percent = computePercent(value, minimum, maximum);
  const resolvedTrackColor = trackColor || colors.background;
  const resolvedFillColor = fillColor || '#1677ff';

  const inputStyle: CSSProperties = {
    ...sliderInputStyle({ isVertical, percent, trackColor: resolvedTrackColor, fillColor: resolvedFillColor }),
    cursor: interactive ? 'pointer' : 'default',
    pointerEvents: interactive ? 'auto' : 'none',
  };

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={{
        ...sliderContainerStyle(colors, isVertical),
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      <input
        type="range"
        readOnly={!interactive}
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        disabled={disabled}
        onChange={interactive ? onChange : undefined}
        style={inputStyle}
      />
      {showValue && <span style={sliderValueStyle}>{value}</span>}
    </div>
  );
}
