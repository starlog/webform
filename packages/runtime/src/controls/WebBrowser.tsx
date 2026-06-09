import { useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { WebBrowserView } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

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
  const trimmed = url.trim();
  if (trimmed === '' || trimmed === 'about:blank') return true;
  // http/https만 허용 (javascript:, data:, vbscript: 등 스크립트 실행 가능 스킴 차단)
  try {
    const parsed = new URL(trimmed, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
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

  const handleLoad = useCallback(() => {
    updateControlState(id, 'documentLoaded', true);
    onNavigated?.();
    onDocumentCompleted?.();
  }, [id, updateControlState, onNavigated, onDocumentCompleted]);

  const safeUrl = isSafeUrl(url) ? url : 'about:blank';
  const showIframe = allowNavigation && safeUrl !== 'about:blank';

  return (
    <WebBrowserView
      url={safeUrl}
      showIframe={showIframe}
      placeholderText={!allowNavigation ? 'Navigation disabled' : 'about:blank'}
      backColor={backColor}
      disabled={!enabled}
      onIframeLoad={handleLoad}
      className="wf-webbrowser"
      data-control-id={id}
      style={style}
    />
  );
}
