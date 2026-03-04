import type { CSSProperties } from 'react';
import { listBoxBaseStyle, listBoxItemStyle } from '../../styles/controlStyles.js';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface ListBoxViewProps {
  items?: string[];
  selectedIndex?: number;
  interactive?: boolean;
  disabled?: boolean;
  onItemClick?: (index: number) => void;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function ListBoxView({
  items = [],
  selectedIndex = -1,
  interactive = false,
  disabled,
  onItemClick,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: ListBoxViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('ListBox', { backColor, foreColor });

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={{
        ...listBoxBaseStyle(theme, colors),
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            ...listBoxItemStyle(theme, i === selectedIndex),
            cursor: interactive ? 'pointer' : 'default',
          }}
          onClick={interactive && onItemClick ? () => onItemClick(i) : undefined}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
