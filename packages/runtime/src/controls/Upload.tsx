import { useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { UploadView } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

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
  id, uploadMode = 'DropZone', text = 'Click or drag file to upload',
  accept = '', multiple = false, maxFileSize = 10, maxCount = 1,
  borderStyle = 'Dashed', backColor, foreColor, style,
  enabled = true, onFileSelected,
}: UploadProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; size: number; type: string }[]>([]);

  const maxFileSizeBytes = maxFileSize * 1024 * 1024;

  const handleFiles = (fileList: FileList) => {
    if (!enabled) return;
    const files = Array.from(fileList)
      .filter((f) => f.size <= maxFileSizeBytes)
      .slice(0, maxCount);
    const fileMeta = files.map((f) => ({ name: f.name, size: f.size, type: f.type }));
    setSelectedFiles(fileMeta);

    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      let completed = 0;
      const enriched = fileMeta.map((m) => ({ ...m, dataUrl: '' }));
      files.forEach((file, idx) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            enriched[idx].dataUrl = (e.target?.result as string) ?? '';
            completed++;
            if (completed === imageFiles.length) {
              updateControlState(id, 'selectedFiles', enriched);
              onFileSelected?.();
            }
          };
          reader.readAsDataURL(file);
        } else {
          completed++;
        }
      });
    } else {
      updateControlState(id, 'selectedFiles', fileMeta);
      onFileSelected?.();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (enabled) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

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

  return (
    <UploadView
      uploadMode={uploadMode}
      text={text}
      borderStyle={borderStyle}
      interactive={enabled}
      isDragOver={isDragOver}
      selectedFiles={selectedFiles}
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      hiddenInput={hiddenInput}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-upload"
      data-control-id={id}
      style={style}
    />
  );
}
