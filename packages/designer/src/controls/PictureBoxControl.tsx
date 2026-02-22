import type { CSSProperties } from 'react';
import type { DesignerControlProps } from './registry';

const SIZE_MODE_MAP: Record<string, CSSProperties['objectFit']> = {
  Normal: 'none',
  StretchImage: 'fill',
  AutoSize: 'none',
  CenterImage: 'none',
  Zoom: 'contain',
};

export function PictureBoxControl({ properties, size }: DesignerControlProps) {
  const image = properties.imageUrl as string | undefined;
  const sizeMode = (properties.sizeMode as string) ?? 'Normal';
  const backColor = (properties.backColor as string) ?? '#E0E0E0';
  const borderStyle = properties.borderStyle as string | undefined;

  let border = '1px solid #BCBCBC';
  if (borderStyle === 'FixedSingle') border = '1px solid #7A7A7A';
  else if (borderStyle === 'Fixed3D') border = '2px inset #7A7A7A';
  else if (borderStyle === 'None') border = 'none';

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: backColor,
      border,
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
            objectFit: SIZE_MODE_MAP[sizeMode] ?? 'none',
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
