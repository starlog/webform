import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

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

export function PictureBox({
  id,
  imageUrl,
  sizeMode = 'Normal',
  backColor,
  borderStyle,
  style,
}: PictureBoxProps) {
  const theme = useTheme();
  const colors = useControlColors('PictureBox', { backColor });

  function getBorder(): string {
    if (borderStyle === 'FixedSingle') return theme.controls.panel.border;
    if (borderStyle === 'Fixed3D') return theme.controls.panel.border;
    return 'none';
  }

  const containerStyle: CSSProperties = {
    boxSizing: 'border-box',
    overflow: 'hidden',
    display: 'flex',
    alignItems: sizeMode === 'CenterImage' ? 'center' : 'flex-start',
    justifyContent: sizeMode === 'CenterImage' ? 'center' : 'flex-start',
    background: colors.background,
    border: getBorder(),
    borderRadius: theme.controls.panel.borderRadius,
    ...style,
  };

  if (!imageUrl) {
    return (
      <div className="wf-picturebox" data-control-id={id} style={containerStyle}>
        <span style={{ color: '#999', fontSize: '20px', userSelect: 'none' }}>
          {'\uD83D\uDDBC'}
        </span>
      </div>
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
