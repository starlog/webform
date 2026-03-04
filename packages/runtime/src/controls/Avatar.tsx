import type { CSSProperties, ReactNode } from 'react';
import { AvatarView } from '@webform/common/views';

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
  id, imageUrl = '', text = 'U', shape = 'Circle',
  backColor, foreColor, style, onClick,
}: AvatarProps) {
  return (
    <AvatarView
      imageUrl={imageUrl}
      text={text}
      shape={shape}
      backColor={backColor}
      foreColor={foreColor}
      interactive={!!onClick}
      onClick={onClick}
      className="wf-avatar"
      data-control-id={id}
      style={style}
    />
  );
}
