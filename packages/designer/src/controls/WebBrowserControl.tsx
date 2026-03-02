import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

export function WebBrowserControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const url = (properties.url as string) ?? 'about:blank';
  const backColor = (properties.backColor as string) ?? theme.controls.panel.background;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: backColor,
        border: theme.controls.panel.border,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fontSize: '12px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* 주소바 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 6px',
          borderBottom: '1px solid #E0E0E0',
          backgroundColor: '#FAFAFA',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '11px', color: '#888' }}>URL:</span>
        <div
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            border: '1px solid #D0D0D0',
            borderRadius: 2,
            padding: '1px 4px',
            fontSize: '11px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: '#444',
          }}
        >
          {url}
        </div>
      </div>

      {/* 본문 미리보기 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          gap: 8,
        }}
      >
        <span style={{ fontSize: '32px' }}>🌐</span>
        <span>WebBrowser</span>
      </div>
    </div>
  );
}
