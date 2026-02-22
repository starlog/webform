import type { CSSProperties, ReactNode } from 'react';

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

const SIZE_MODE_MAP: Record<string, CSSProperties['objectFit']> = {
  Normal: 'none',
  StretchImage: 'fill',
  AutoSize: 'none',
  CenterImage: 'none',
  Zoom: 'contain',
};

function getBorderStyle(borderStyle?: string): string {
  if (borderStyle === 'FixedSingle') return '1px solid #7A7A7A';
  if (borderStyle === 'Fixed3D') return '2px inset #7A7A7A';
  return 'none';
}

export function PictureBox({
  id,
  imageUrl,
  sizeMode = 'Normal',
  backColor,
  borderStyle,
  style,
}: PictureBoxProps) {
  const containerStyle: CSSProperties = {
    boxSizing: 'border-box',
    overflow: 'hidden',
    display: 'flex',
    alignItems: sizeMode === 'CenterImage' ? 'center' : 'flex-start',
    justifyContent: sizeMode === 'CenterImage' ? 'center' : 'flex-start',
    backgroundColor: backColor ?? '#E0E0E0',
    border: getBorderStyle(borderStyle),
    ...style,
  };

  if (!imageUrl) {
    return (
      <div className="wf-picturebox" data-control-id={id} style={containerStyle} />
    );
  }

  return (
    <div className="wf-picturebox" data-control-id={id} style={containerStyle}>
      <img
        src={imageUrl}
        alt=""
        style={{
          objectFit: SIZE_MODE_MAP[sizeMode] ?? 'none',
          width: sizeMode === 'StretchImage' || sizeMode === 'Zoom' ? '100%' : undefined,
          height: sizeMode === 'StretchImage' || sizeMode === 'Zoom' ? '100%' : undefined,
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      />
    </div>
  );
}
