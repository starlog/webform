import type { DesignerControlProps } from './registry';

function getInitials(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return text.slice(0, 2).toUpperCase();
}

export function AvatarControl({ properties, size }: DesignerControlProps) {
  const imageUrl = (properties.imageUrl as string) ?? '';
  const text = (properties.text as string) ?? 'U';
  const shape = (properties.shape as string) ?? 'Circle';
  const backColor = (properties.backColor as string) ?? '#1677ff';
  const foreColor = (properties.foreColor as string) ?? '#ffffff';

  const avatarSize = Math.min(size.width, size.height);
  const borderRadius = shape === 'Circle' ? '50%' : '4px';

  if (imageUrl) {
    return (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={imageUrl}
          alt=""
          style={{
            width: avatarSize,
            height: avatarSize,
            objectFit: 'cover',
            borderRadius,
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius,
          backgroundColor: backColor,
          color: foreColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: avatarSize * 0.4,
          fontWeight: 600,
          userSelect: 'none',
        }}
      >
        {getInitials(text)}
      </div>
    </div>
  );
}
