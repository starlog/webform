import type { CSSProperties, ReactNode } from 'react';
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
  const range = maximum - minimum || 1;
  const percent = Math.max(0, Math.min(100, ((value - minimum) / range) * 100));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!enabled) return;
    const newValue = Number(e.target.value);
    updateControlState(id, 'value', newValue);
    onValueChanged?.();
  };

  const resolvedTrackColor = trackColor || colors.backgroundColor;
  const resolvedFillColor = fillColor || '#1677ff';

  const inputStyle: CSSProperties = {
    width: isVertical ? undefined : '100%',
    height: isVertical ? '100%' : undefined,
    cursor: enabled ? 'pointer' : 'default',
    accentColor: resolvedFillColor,
    background: `linear-gradient(${isVertical ? 'to top' : 'to right'}, ${resolvedFillColor} 0%, ${resolvedFillColor} ${percent}%, ${resolvedTrackColor} ${percent}%, ${resolvedTrackColor} 100%)`,
    borderRadius: '4px',
    margin: 0,
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxSizing: 'border-box',
    color: colors.color,
    opacity: enabled ? 1 : 0.6,
    ...style,
  };

  if (isVertical) {
    containerStyle.flexDirection = 'column';
    containerStyle.writingMode = 'vertical-lr';
    containerStyle.direction = 'rtl';
  }

  return (
    <div className="wf-slider" data-control-id={id} style={containerStyle}>
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
