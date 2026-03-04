import type { CSSProperties, ReactNode } from 'react';
import { PictureBoxView } from '@webform/common/views';

interface PictureBoxProps {
  id: string;
  name: string;
  imageUrl?: string;
  sizeMode?: 'Normal' | 'StretchImage' | 'AutoSize' | 'CenterImage' | 'Zoom';
  backColor?: string;
  borderStyle?: 'None' | 'FixedSingle' | 'Fixed3D';
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function PictureBox({ id, imageUrl, sizeMode = 'Normal', backColor, borderStyle, style }: PictureBoxProps) {
  return (
    <PictureBoxView
      imageUrl={imageUrl}
      sizeMode={sizeMode}
      borderStyle={borderStyle}
      backColor={backColor}
      className="wf-picturebox"
      data-control-id={id}
      style={style}
    />
  );
}
