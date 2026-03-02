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
      : `1px ${borderStyle.toLowerCase()} #d9d9d9`;

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
            gap: '4px',
            padding: '4px 12px',
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
        borderRadius: 6,
        backgroundColor: backColor || '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '16px',
        color: foreColor,
        fontSize: 'inherit',
        fontFamily: 'inherit',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ fontSize: '1.5em' }}>⬆</span>
      <span style={{ fontSize: '0.9em', textAlign: 'center' }}>{text}</span>
    </div>
  );
}
