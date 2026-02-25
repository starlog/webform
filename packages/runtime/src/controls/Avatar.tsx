import { useState, type CSSProperties, type ReactNode } from 'react';
import { useControlColors } from '../theme/useControlColors';

interface AvatarProps {
  id: string;
  name: string;
  imageUrl?: string;
  text?: string;
  shape?: 'Circle' | 'Square';
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Avatar({
  id,
  imageUrl = '',
  text = 'U',
  shape = 'Circle',
  backColor,
  foreColor,
  style,
  onClick,
}: AvatarProps) {
  useControlColors('Avatar', { backColor, foreColor });
  const [imgError, setImgError] = useState(false);

  const width = (style?.width as number) || 40;
  const height = (style?.height as number) || 40;
  const sz = Math.min(width, height);

  const initials = (text || 'U').slice(0, 2).toUpperCase();

  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    userSelect: 'none',
    cursor: onClick ? 'pointer' : 'default',
    borderRadius: shape === 'Circle' ? '50%' : '4px',
    backgroundColor: backColor || '#1677ff',
    color: foreColor || '#ffffff',
    ...style,
    width: sz,
    height: sz,
  };

  const handleClick = () => {
    onClick?.();
  };

  return (
    <div className="wf-avatar" data-control-id={id} style={containerStyle} onClick={handleClick}>
      {imageUrl && !imgError ? (
        <img
          src={imageUrl}
          alt={text}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setImgError(true)}
        />
      ) : (
        <span style={{ fontSize: sz * 0.4, fontWeight: 'bold' }}>{initials}</span>
      )}
    </div>
  );
}
