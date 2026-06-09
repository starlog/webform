import type { CSSProperties } from 'react';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface WebBrowserViewProps {
  /** 주소바에 표시할 URL (호출 측에서 안전성 검증을 마친 값이어야 함) */
  url?: string;
  /** true이면 iframe을 렌더링, false이면 플레이스홀더 표시 */
  showIframe?: boolean;
  /** iframe 미표시 시 플레이스홀더 문구 */
  placeholderText?: string;
  backColor?: string;
  disabled?: boolean;
  onIframeLoad?: () => void;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function WebBrowserView({
  url = 'about:blank',
  showIframe = false,
  placeholderText = 'WebBrowser',
  backColor,
  disabled = false,
  onIframeLoad,
  style,
  className,
  'data-control-id': dataControlId,
}: WebBrowserViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('WebBrowser', { backColor });

  const rootStyle: CSSProperties = {
    background: colors.background,
    border: theme.controls.textInput.border,
    borderRadius: theme.controls.textInput.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    overflow: 'hidden',
    opacity: disabled ? 0.6 : 1,
    ...style,
  };

  return (
    <div className={className} data-control-id={dataControlId} style={rootStyle}>
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
          {url}
        </div>
      </div>

      {/* 본문: iframe 또는 플레이스홀더 */}
      {showIframe ? (
        <iframe
          src={url}
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={onIframeLoad}
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
          <span style={{ fontSize: '32px' }}>&#127760;</span>
          <span>{placeholderText}</span>
        </div>
      )}
    </div>
  );
}
