import type { CSSProperties, ReactNode } from 'react';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface TagViewProps {
  tags?: string[];
  tagColor?: string;
  closable?: boolean;
  addable?: boolean;
  interactive?: boolean;
  onRemove?: (index: number) => void;
  onTagClick?: (index: number) => void;
  addButton?: ReactNode;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

const TAG_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Default: { bg: '#fafafa', border: '#d9d9d9', text: 'rgba(0,0,0,0.88)' },
  Blue: { bg: '#e6f4ff', border: '#91caff', text: '#1677ff' },
  Green: { bg: '#f6ffed', border: '#b7eb8f', text: '#52c41a' },
  Red: { bg: '#fff2f0', border: '#ffccc7', text: '#ff4d4f' },
  Orange: { bg: '#fff7e6', border: '#ffd591', text: '#fa8c16' },
  Purple: { bg: '#f9f0ff', border: '#d3adf7', text: '#722ed1' },
  Cyan: { bg: '#e6fffb', border: '#87e8de', text: '#13c2c2' },
  Gold: { bg: '#fffbe6', border: '#ffe58f', text: '#faad14' },
};

export function TagView({
  tags = [],
  tagColor = 'Default',
  closable = false,
  addable = false,
  interactive = false,
  onRemove,
  onTagClick,
  addButton,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: TagViewProps) {
  const colors = useViewControlColors('Tag', { backColor, foreColor });
  const colorSet = TAG_COLORS[tagColor] || TAG_COLORS.Default;

  const tagStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '4px',
    border: `1px solid ${colorSet.border}`,
    backgroundColor: colorSet.bg,
    color: colorSet.text,
    fontSize: '0.85em',
    cursor: interactive ? 'pointer' : 'default',
    userSelect: 'none',
  };

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        alignItems: 'center',
        boxSizing: 'border-box',
        color: colors.color,
        overflow: 'hidden',
        ...style,
      }}
    >
      {tags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          style={tagStyle}
          onClick={interactive && onTagClick ? () => onTagClick(index) : undefined}
        >
          {tag}
          {closable && interactive && onRemove && (
            <span
              style={{ cursor: 'pointer', opacity: 0.6, marginLeft: '2px' }}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(index);
              }}
            >
              ✕
            </span>
          )}
          {closable && !interactive && (
            <span style={{ opacity: 0.6, marginLeft: '2px' }}>✕</span>
          )}
        </span>
      ))}
      {addable && addButton}
      {addable && !addButton && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px dashed #d9d9d9',
            fontSize: '0.85em',
            userSelect: 'none',
          }}
        >
          + New Tag
        </span>
      )}
    </div>
  );
}
