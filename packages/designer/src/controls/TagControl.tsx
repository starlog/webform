import type { DesignerControlProps } from './registry';

const TAG_COLORS = {
  Default: { bg: '#fafafa', border: '#d9d9d9', text: 'rgba(0,0,0,0.88)' },
  Blue: { bg: '#e6f4ff', border: '#91caff', text: '#1677ff' },
  Green: { bg: '#f6ffed', border: '#b7eb8f', text: '#52c41a' },
  Red: { bg: '#fff2f0', border: '#ffccc7', text: '#ff4d4f' },
  Orange: { bg: '#fff7e6', border: '#ffd591', text: '#fa8c16' },
  Purple: { bg: '#f9f0ff', border: '#d3adf7', text: '#722ed1' },
  Cyan: { bg: '#e6fffb', border: '#87e8de', text: '#13c2c2' },
  Gold: { bg: '#fffbe6', border: '#ffe58f', text: '#faad14' },
} as const;

type TagColor = keyof typeof TAG_COLORS;

export function TagControl({ properties, size }: DesignerControlProps) {
  const tags = (properties.tags as string[]) ?? ['Tag1', 'Tag2'];
  const tagColor = (properties.tagColor as TagColor) ?? 'Default';
  const closable = (properties.closable as boolean) ?? false;
  const addable = (properties.addable as boolean) ?? false;

  const colorStyle = TAG_COLORS[tagColor] ?? TAG_COLORS.Default;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        alignItems: 'center',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {tags.map((tag, i) => (
        <span
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            border: `1px solid ${colorStyle.border}`,
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 12,
            backgroundColor: colorStyle.bg,
            color: colorStyle.text,
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {tag}
          {closable && (
            <span style={{ marginLeft: 4, opacity: 0.6, fontSize: 10 }}>✕</span>
          )}
        </span>
      ))}
      {addable && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            border: '1px dashed #d9d9d9',
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 12,
            color: 'rgba(0,0,0,0.65)',
            backgroundColor: 'transparent',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          + New Tag
        </span>
      )}
    </div>
  );
}
