import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useControlColors } from '../theme/useControlColors';

interface TagProps {
  id: string;
  name: string;
  tags?: string[];
  tagColor?: 'Default' | 'Blue' | 'Green' | 'Red' | 'Orange' | 'Purple' | 'Cyan' | 'Gold';
  closable?: boolean;
  addable?: boolean;
  foreColor?: string;
  backColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onTagAdded?: () => void;
  onTagRemoved?: () => void;
  onTagClicked?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
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

export function Tag({
  id,
  tags = [],
  tagColor = 'Default',
  closable = false,
  addable = false,
  foreColor,
  backColor,
  style,
  enabled = true,
  onTagAdded,
  onTagRemoved,
  onTagClicked,
}: TagProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const colors = useControlColors('Tag', { backColor, foreColor });
  const [isAdding, setIsAdding] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');

  const colorSet = TAG_COLORS[tagColor] || TAG_COLORS.Default;

  const handleRemove = (index: number) => {
    if (!enabled) return;
    const newTags = tags.filter((_, i) => i !== index);
    updateControlState(id, 'tags', newTags);
    onTagRemoved?.();
  };

  const handleTagClick = (index: number) => {
    if (!enabled) return;
    // Store the clicked tag info for server-side event args
    updateControlState(id, '_lastClickedTag', { tag: tags[index], index });
    onTagClicked?.();
  };

  const handleAddConfirm = () => {
    const trimmed = newTagValue.trim();
    if (trimmed) {
      const newTags = [...tags, trimmed];
      updateControlState(id, 'tags', newTags);
      onTagAdded?.();
    }
    setNewTagValue('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddConfirm();
    if (e.key === 'Escape') {
      setNewTagValue('');
      setIsAdding(false);
    }
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    alignItems: 'center',
    boxSizing: 'border-box',
    color: colors.color,
    ...style,
  };

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
    cursor: enabled ? 'pointer' : 'default',
    userSelect: 'none',
  };

  return (
    <div className="wf-tag" data-control-id={id} style={containerStyle}>
      {tags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          style={tagStyle}
          onClick={() => handleTagClick(index)}
        >
          {tag}
          {closable && enabled && (
            <span
              style={{ cursor: 'pointer', opacity: 0.6, marginLeft: '2px' }}
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(index);
              }}
            >
              ✕
            </span>
          )}
        </span>
      ))}
      {addable && enabled && !isAdding && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px dashed #d9d9d9',
            fontSize: '0.85em',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => setIsAdding(true)}
        >
          + New Tag
        </span>
      )}
      {addable && isAdding && (
        <input
          style={{
            width: '80px',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid #d9d9d9',
            fontSize: '0.85em',
            outline: 'none',
          }}
          autoFocus
          value={newTagValue}
          onChange={(e) => setNewTagValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleAddConfirm}
        />
      )}
    </div>
  );
}
