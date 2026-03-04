import type { CSSProperties, ReactNode } from 'react';
import { SliderView } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

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
  id, value = 0, minimum = 0, maximum = 100, step = 1,
  orientation = 'Horizontal', showValue = true, trackColor, fillColor,
  backColor, foreColor, style, enabled = true, onValueChanged,
}: SliderProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!enabled) return;
    const newValue = Number(e.target.value);
    updateControlState(id, 'value', newValue);
    onValueChanged?.();
  };

  return (
    <SliderView
      value={value}
      minimum={minimum}
      maximum={maximum}
      step={step}
      orientation={orientation}
      showValue={showValue}
      trackColor={trackColor}
      fillColor={fillColor}
      interactive={enabled}
      disabled={!enabled}
      onChange={handleChange}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-slider"
      data-control-id={id}
      style={style}
    />
  );
}
