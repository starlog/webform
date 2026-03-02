import type { CSSProperties } from 'react';
import type { DesignerControlProps } from './registry';

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

export function TagControl({ properties, size }: DesignerControlProps) {
  const tags = (properties.tags as string[]) ?? ['Tag1', 'Tag2'];
  const tagColor = (properties.tagColor as string) ?? 'Default';
  const closable = (properties.closable as boolean) ?? false;
  const addable = (properties.addable as boolean) ?? false;

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
    userSelect: 'none',
  };

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        alignItems: 'center',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {tags.map((tag, i) => (
        <span key={i} style={tagStyle}>
          {tag}
          {closable && (
            <span style={{ opacity: 0.6, marginLeft: '2px' }}>✕</span>
          )}
        </span>
      ))}
      {addable && (
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
