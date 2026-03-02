import type { CSSProperties } from 'react';
import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

interface PreviewRowProps {
  label: string;
  value: string;
  indent: number;
  isObject?: boolean;
}

function PreviewRow({ label, value, indent, isObject }: PreviewRowProps) {
  return (
    <div style={{ ...styles.row, paddingLeft: 8 + indent * 14 }}>
      <span style={styles.key}>{label}</span>
      <span style={styles.colon}>:</span>
      {isObject ? (
        <span style={styles.bracket}>{value}</span>
      ) : (
        <span style={styles.value}>{value}</span>
      )}
    </div>
  );
}

export function JsonEditorControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const backColor = (properties.backColor as string) || theme.controls.textInput.background;
  const font = properties.font as { family?: string; size?: number } | undefined;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        border: theme.controls.textInput.border,
        borderRadius: theme.controls.textInput.borderRadius,
        backgroundColor: backColor,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: font?.family || 'Consolas, monospace',
        fontSize: font?.size ? `${font.size}pt` : 11,
      }}
    >
      <div style={styles.header}>
        <span style={styles.headerIcon}>{'{}'}</span>
        <span style={styles.headerText}>JsonEditor</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', padding: '4px 0' }}>
        <PreviewRow label="name" value='"John"' indent={0} />
        <PreviewRow label="age" value="30" indent={0} />
        <PreviewRow label="active" value="true" indent={0} />
        <PreviewRow label="address" value="{...}" indent={0} isObject />
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    backgroundColor: '#f3f3f3',
    borderBottom: '1px solid #d0d0d0',
    height: 22,
    flexShrink: 0,
  },
  headerIcon: {
    fontSize: 12,
    fontWeight: 700,
    color: '#6a9955',
  },
  headerText: {
    fontSize: 11,
    color: '#555',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    height: 20,
    whiteSpace: 'nowrap',
  },
  key: {
    color: '#0451a5',
    fontWeight: 600,
  },
  colon: {
    color: '#666',
  },
  value: {
    color: '#098658',
  },
  bracket: {
    color: '#999',
    fontStyle: 'italic',
  },
};
