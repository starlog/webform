import type { CSSProperties } from 'react';
import { PICTURE_SIZE_MODE_MAP } from '@webform/common';
import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function PictureBoxControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const image = properties.imageUrl as string | undefined;
  const sizeMode = (properties.sizeMode as string) ?? 'Normal';
  const backColor = (properties.backColor as string) || theme.controls.panel.background;
  const borderStyle = properties.borderStyle as string | undefined;

  let border = 'none';
  if (borderStyle === 'FixedSingle') border = theme.controls.panel.border;
  else if (borderStyle === 'Fixed3D') border = theme.controls.panel.border;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: backColor,
      border,
      borderRadius: theme.controls.panel.borderRadius,
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: sizeMode === 'CenterImage' ? 'center' : 'flex-start',
      justifyContent: sizeMode === 'CenterImage' ? 'center' : 'flex-start',
      overflow: 'hidden',
    }}>
      {image ? (
        <img
          src={image}
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
