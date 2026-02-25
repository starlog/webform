import { useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useControlColors } from '../theme/useControlColors';

interface UploadProps {
  id: string;
  name: string;
  uploadMode?: 'Button' | 'DropZone';
  text?: string;
  accept?: string;
  multiple?: boolean;
  maxFileSize?: number;
  maxCount?: number;
  borderStyle?: 'None' | 'Solid' | 'Dashed';
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onFileSelected?: () => void;
  onUploadCompleted?: () => void;
  onUploadFailed?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Upload({
  id,
  uploadMode = 'DropZone',
  text = 'Click or drag file to upload',
  accept = '',
  multiple = false,
  maxFileSize = 10,
  maxCount = 1,
  borderStyle = 'Dashed',
  backColor,
  foreColor,
  style,
  enabled = true,
  onFileSelected,
}: UploadProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const colors = useControlColors('Upload', { backColor, foreColor });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; size: number; type: string }[]>(
    [],
  );

  const maxFileSizeBytes = maxFileSize * 1024 * 1024;

  const handleFiles = (fileList: FileList) => {
    if (!enabled) return;
    const files = Array.from(fileList)
      .filter((f) => f.size <= maxFileSizeBytes)
      .slice(0, maxCount);
    const fileMeta = files.map((f) => ({ name: f.name, size: f.size, type: f.type }));
    setSelectedFiles(fileMeta);
    updateControlState(id, 'selectedFiles', fileMeta);
    onFileSelected?.();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (enabled) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const borderMap: Record<string, string> = {
    None: 'none',
    Solid: 'solid',
    Dashed: 'dashed',
  };

  const borderCss = borderStyle === 'None' ? 'none' : `1px ${borderMap[borderStyle]} ${isDragOver ? '#1677ff' : '#d9d9d9'}`;

  const hiddenInput = (
    <input
      ref={fileInputRef}
      type="file"
      style={{ display: 'none' }}
      accept={accept || undefined}
      multiple={multiple}
      onChange={handleFileChange}
    />
  );

  if (uploadMode === 'Button') {
    return (
      <div
        className="wf-upload"
        data-control-id={id}
        style={{ boxSizing: 'border-box', ...style }}
      >
        {hiddenInput}
        <button
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 12px',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            background: colors.background,
            color: colors.color,
            cursor: enabled ? 'pointer' : 'not-allowed',
            fontSize: 'inherit',
            fontFamily: 'inherit',
          }}
          disabled={!enabled}
          onClick={() => fileInputRef.current?.click()}
        >
          ⬆ {text}
        </button>
        {selectedFiles.length > 0 && (
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
      className="wf-upload"
      data-control-id={id}
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
        background: isDragOver ? '#e6f4ff' : colors.background,
        color: colors.color,
        cursor: enabled ? 'pointer' : 'not-allowed',
        transition: 'background-color 0.2s, border-color 0.2s',
        pointerEvents: enabled ? 'auto' : 'none',
        ...style,
      }}
      onClick={() => enabled && fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {hiddenInput}
      <span style={{ fontSize: '1.5em' }}>⬆</span>
      <span style={{ fontSize: '0.9em', textAlign: 'center' }}>{text}</span>
      {selectedFiles.length > 0 && (
        <div style={{ fontSize: '0.8em', textAlign: 'center' }}>
          {selectedFiles.map((f, i) => (
            <div key={i}>{f.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}
