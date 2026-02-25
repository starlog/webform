import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function UploadControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const uploadMode = (properties.uploadMode as string) ?? 'DropZone';
  const text = (properties.text as string) ?? 'Click or drag file to upload';
  const borderStyle = (properties.borderStyle as string) ?? 'Dashed';
  const backColor = (properties.backColor as string) || undefined;
  const foreColor = (properties.foreColor as string) || theme.form.foreground;

  const borderCss =
    borderStyle === 'None'
      ? 'none'
      : `2px ${borderStyle.toLowerCase()} ${theme.controls.button.border ? '#d9d9d9' : '#d9d9d9'}`;

  if (uploadMode === 'Button') {
    return (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 15px',
            backgroundColor: backColor || theme.controls.button.background,
            border: theme.controls.button.border,
            borderRadius: theme.controls.button.borderRadius,
            color: foreColor,
            fontSize: 'inherit',
            fontFamily: 'inherit',
            userSelect: 'none',
            cursor: 'default',
          }}
        >
          <span>⬆</span>
          <span>{text}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        border: borderCss,
        borderRadius: 8,
        backgroundColor: backColor || '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: foreColor,
        fontSize: 'inherit',
        fontFamily: 'inherit',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ fontSize: 32, opacity: 0.5 }}>⬆</span>
      <span style={{ opacity: 0.65 }}>{text}</span>
    </div>
  );
}
