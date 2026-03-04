import type { CSSProperties, ReactNode } from 'react';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface UploadViewProps {
  uploadMode?: string;
  text?: string;
  borderStyle?: string;
  interactive?: boolean;
  isDragOver?: boolean;
  selectedFiles?: { name: string }[];
  onClick?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  hiddenInput?: ReactNode;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function UploadView({
  uploadMode = 'DropZone',
  text = 'Click or drag file to upload',
  borderStyle = 'Dashed',
  interactive = false,
  isDragOver = false,
  selectedFiles,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
  hiddenInput,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: UploadViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('Upload', { backColor, foreColor });

  const borderCss =
    borderStyle === 'None'
      ? 'none'
      : `1px ${borderStyle.toLowerCase()} ${isDragOver ? '#1677ff' : '#d9d9d9'}`;

  if (uploadMode === 'Button') {
    const resolvedForeColor = foreColor || theme.form.foreground;
    return (
      <div
        className={className}
        data-control-id={dataControlId}
        style={{ boxSizing: 'border-box', ...style }}
      >
        {hiddenInput}
        <button
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 12px',
            backgroundColor: backColor || theme.controls.button.background,
            border: theme.controls.button.border,
            borderRadius: theme.controls.button.borderRadius,
            color: resolvedForeColor,
            cursor: interactive ? 'pointer' : 'default',
            fontSize: 'inherit',
            fontFamily: 'inherit',
            userSelect: 'none',
          }}
          disabled={!interactive}
          onClick={interactive ? onClick : undefined}
        >
          <span>⬆</span>
          <span>{text}</span>
        </button>
        {selectedFiles && selectedFiles.length > 0 && (
          <div style={{ marginTop: '4px', fontSize: '0.85em', color: colors.color }}>
            {selectedFiles.map((f, i) => (
              <div key={i}>{f.name}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '16px',
        border: borderCss,
        borderRadius: '6px',
        background: isDragOver ? '#e6f4ff' : backColor || '#fafafa',
        color: foreColor || colors.color,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background-color 0.2s, border-color 0.2s',
        pointerEvents: interactive ? 'auto' : 'none',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        userSelect: 'none',
        ...style,
      }}
      onClick={interactive ? onClick : undefined}
      onDragOver={interactive ? onDragOver : undefined}
      onDragLeave={interactive ? onDragLeave : undefined}
      onDrop={interactive ? onDrop : undefined}
    >
      {hiddenInput}
      <span style={{ fontSize: '1.5em' }}>⬆</span>
      <span style={{ fontSize: '0.9em', textAlign: 'center' }}>{text}</span>
      {selectedFiles && selectedFiles.length > 0 && (
        <div style={{ fontSize: '0.8em', textAlign: 'center' }}>
          {selectedFiles.map((f, i) => (
            <div key={i}>{f.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}
