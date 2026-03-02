import type { CSSProperties, ReactNode } from 'react';
import {
  sliderInputStyle,
  sliderContainerStyle,
  sliderValueStyle,
  computePercent,
} from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useControlColors } from '../theme/useControlColors';

interface SliderProps {
  id: string;
  name: string;
  value?: number;
  minimum?: number;
  maximum?: number;
  step?: number;
  orientation?: 'Horizontal' | 'Vertical';
  showValue?: boolean;
  trackColor?: string;
  fillColor?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onValueChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Slider({
  id,
  value = 0,
  minimum = 0,
  maximum = 100,
  step = 1,
  orientation = 'Horizontal',
  showValue = true,
  trackColor,
  fillColor,
  backColor,
  foreColor,
  style,
  enabled = true,
  onValueChanged,
}: SliderProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const colors = useControlColors('Slider', { backColor, foreColor });

  const isVertical = orientation === 'Vertical';
  const percent = computePercent(value, minimum, maximum);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!enabled) return;
    const newValue = Number(e.target.value);
    updateControlState(id, 'value', newValue);
    onValueChanged?.();
  };

  const resolvedTrackColor = trackColor || colors.background;
  const resolvedFillColor = fillColor || '#1677ff';

  const inputStyle: CSSProperties = {
    ...sliderInputStyle({ isVertical, percent, trackColor: resolvedTrackColor, fillColor: resolvedFillColor }),
    cursor: enabled ? 'pointer' : 'default',
  };

  return (
    <div
      className="wf-slider"
      data-control-id={id}
      style={{
        ...sliderContainerStyle(colors, isVertical),
        opacity: enabled ? 1 : 0.6,
        ...style,
      }}
    >
      <input
        type="range"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        disabled={!enabled}
        onChange={handleChange}
        style={inputStyle}
      />
      {showValue && (
        <span style={sliderValueStyle}>
          {value}
        </span>
      )}
    </div>
  );
}
