import type { CSSProperties } from 'react';
import type { DesignerControlProps } from './registry';

export function AvatarControl({ properties, size }: DesignerControlProps) {
  const imageUrl = (properties.imageUrl as string) ?? '';
  const text = (properties.text as string) ?? 'U';
  const shape = (properties.shape as string) ?? 'Circle';
  const backColor = (properties.backColor as string) ?? '#1677ff';
  const foreColor = (properties.foreColor as string) ?? '#ffffff';

  const sz = Math.min(size.width, size.height);
  const initials = (text || 'U').slice(0, 2).toUpperCase();

  const containerStyle: CSSProperties = {
    width: sz,
    height: sz,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    userSelect: 'none',
    borderRadius: shape === 'Circle' ? '50%' : '4px',
    backgroundColor: backColor,
    color: foreColor,
  };

  return (
    <div style={containerStyle}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={text}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: sz * 0.4, fontWeight: 'bold' }}>{initials}</span>
      )}
    </div>
  );
}
