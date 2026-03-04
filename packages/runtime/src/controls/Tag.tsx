import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { TagView } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

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

export function Tag({
  id, tags = [], tagColor = 'Default', closable = false, addable = false,
  foreColor, backColor, style, enabled = true,
  onTagAdded, onTagRemoved, onTagClicked,
}: TagProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const [isAdding, setIsAdding] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');

  const handleRemove = (index: number) => {
    if (!enabled) return;
    const newTags = tags.filter((_, i) => i !== index);
    updateControlState(id, 'tags', newTags);
    onTagRemoved?.();
  };

  const handleTagClick = (index: number) => {
    if (!enabled) return;
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

  const addButton = enabled && !isAdding ? (
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
  ) : isAdding ? (
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
  ) : undefined;

  return (
    <TagView
      tags={tags}
      tagColor={tagColor}
      closable={closable}
      addable={addable}
      interactive={enabled}
      onRemove={handleRemove}
      onTagClick={handleTagClick}
      addButton={addButton}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-tag"
      data-control-id={id}
      style={style}
    />
  );
}
