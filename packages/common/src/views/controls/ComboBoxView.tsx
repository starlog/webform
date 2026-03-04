import type { CSSProperties } from 'react';
import { comboBoxBaseStyle } from '../../styles/controlStyles.js';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface ComboBoxViewProps {
  items?: string[];
  selectedIndex?: number;
  interactive?: boolean;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function ComboBoxView({
  items = [],
  selectedIndex = -1,
  interactive = false,
  disabled,
  onChange,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: ComboBoxViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('ComboBox', { backColor, foreColor });

  return (
    <select
      className={className}
      data-control-id={dataControlId}
      style={{
        ...comboBoxBaseStyle(theme, colors),
        pointerEvents: interactive ? 'auto' : 'none',
        ...style,
      }}
      disabled={disabled ?? !interactive}
      value={selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex] : ''}
      onChange={interactive ? onChange : undefined}
    >
      {items.map((item, i) => (
        <option key={i} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}
