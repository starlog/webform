import { useState, type CSSProperties } from 'react';

export interface AvatarViewProps {
  imageUrl?: string;
  text?: string;
  shape?: string;
  backColor?: string;
  foreColor?: string;
  interactive?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function AvatarView({
  imageUrl = '',
  text = 'U',
  shape = 'Circle',
  backColor,
  foreColor,
  interactive = false,
  onClick,
  style,
  className,
  'data-control-id': dataControlId,
}: AvatarViewProps) {
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
    cursor: interactive && onClick ? 'pointer' : 'default',
    borderRadius: shape === 'Circle' ? '50%' : '4px',
    backgroundColor: backColor || '#1677ff',
    color: foreColor || '#ffffff',
    ...style,
    width: sz,
    height: sz,
  };

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={containerStyle}
      onClick={interactive ? onClick : undefined}
    >
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
