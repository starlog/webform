import type { CSSProperties } from 'react';
import { PICTURE_SIZE_MODE_MAP } from '../../styles/controlStyles.js';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface PictureBoxViewProps {
  imageUrl?: string;
  sizeMode?: string;
  borderStyle?: string;
  backColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function PictureBoxView({
  imageUrl,
  sizeMode = 'Normal',
  borderStyle,
  backColor,
  style,
  className,
  'data-control-id': dataControlId,
}: PictureBoxViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('PictureBox', { backColor });

  let border = 'none';
  if (borderStyle === 'FixedSingle' || borderStyle === 'Fixed3D') {
    border = theme.controls.panel.border;
  }

  const containerStyle: CSSProperties = {
    boxSizing: 'border-box',
    overflow: 'hidden',
    display: 'flex',
    alignItems: sizeMode === 'CenterImage' ? 'center' : 'flex-start',
    justifyContent: sizeMode === 'CenterImage' ? 'center' : 'flex-start',
    background: colors.background,
    border,
    borderRadius: theme.controls.panel.borderRadius,
    ...style,
  };

  return (
    <div className={className} data-control-id={dataControlId} style={containerStyle}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          style={{
            objectFit: (PICTURE_SIZE_MODE_MAP[sizeMode] ?? 'none') as CSSProperties['objectFit'],
            width: sizeMode === 'StretchImage' || sizeMode === 'Zoom' ? '100%' : undefined,
            height: sizeMode === 'StretchImage' || sizeMode === 'Zoom' ? '100%' : undefined,
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        />
      ) : (
        <span style={{ color: '#999', fontSize: '20px', userSelect: 'none' }}>
          {'\uD83D\uDDBC'}
        </span>
      )}
    </div>
  );
}
