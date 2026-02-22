import type { DesignerControlProps } from './registry';

export function PictureBoxControl({ properties, size }: DesignerControlProps) {
  const image = properties.image as string | undefined;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: '#E0E0E0',
      border: '1px solid #BCBCBC',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {image ? (
        <img
          src={image}
          alt=""
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      ) : (
        <span style={{ color: '#999', fontSize: '20px', userSelect: 'none' }}>
          {'\uD83D\uDDBC'}
        </span>
      )}
    </div>
  );
}
