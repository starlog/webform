import { useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

interface WebBrowserProps {
  id: string;
  name: string;
  url?: string;
  allowNavigation?: boolean;
  style?: CSSProperties;
  enabled?: boolean;
  backColor?: string;
  onNavigated?: () => void;
  onDocumentCompleted?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:')) return false;
  return true;
}

export function WebBrowser({
  id,
  url = 'about:blank',
  allowNavigation = true,
  style,
  enabled = true,
  backColor,
  onNavigated,
  onDocumentCompleted,
}: WebBrowserProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const theme = useTheme();
  const colors = useControlColors('WebBrowser', { backColor });

  const handleLoad = useCallback(() => {
    updateControlState(id, 'documentLoaded', true);
    onNavigated?.();
    onDocumentCompleted?.();
  }, [id, updateControlState, onNavigated, onDocumentCompleted]);

  const safeUrl = isSafeUrl(url) ? url : 'about:blank';

  const mergedStyle: CSSProperties = {
    background: colors.background,
    border: theme.controls.textInput.border,
    borderRadius: theme.controls.textInput.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    overflow: 'hidden',
    opacity: enabled ? 1 : 0.6,
    ...style,
  };

  return (
    <div className="wf-webbrowser" data-control-id={id} style={mergedStyle}>
      {/* 주소바 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 6px',
          borderBottom: theme.controls.textInput.border,
          backgroundColor: theme.controls.panel.background,
          flexShrink: 0,
          fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
          fontSize: '12px',
        }}
      >
        <span style={{ fontSize: '11px', color: '#888' }}>URL:</span>
        <div
          style={{
            flex: 1,
            backgroundColor: theme.controls.textInput.background,
            border: theme.controls.textInput.border,
            borderRadius: theme.controls.textInput.borderRadius,
            padding: '1px 4px',
            fontSize: '11px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: theme.controls.textInput.foreground,
          }}
        >
          {safeUrl}
        </div>
      </div>

      {/* iframe */}
      {allowNavigation && safeUrl !== 'about:blank' ? (
        <iframe
          src={safeUrl}
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={handleLoad}
          style={{
            flex: 1,
            border: 'none',
            width: '100%',
            minHeight: 0,
          }}
          title="WebBrowser"
        />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            gap: 8,
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
            fontSize: '12px',
          }}
        >
          <span style={{ fontSize: '32px' }}>🌐</span>
          <span>{!allowNavigation ? 'Navigation disabled' : 'about:blank'}</span>
        </div>
      )}
    </div>
  );
}
