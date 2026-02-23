import type { DesignerControlProps } from './registry';

export function RichTextBoxControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? '';
  const backColor = (properties.backColor as string) ?? '#FFFFFF';
  const foreColor = (properties.foreColor as string) ?? undefined;
  const readOnly = (properties.readOnly as boolean) ?? false;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: backColor,
        color: foreColor,
        border: '1px inset #D0D0D0',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fontSize: '12px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* 서식 도구바 미리보기 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '2px 4px',
          borderBottom: '1px solid #E0E0E0',
          backgroundColor: '#FAFAFA',
          flexShrink: 0,
        }}
      >
        <button
          disabled
          style={{
            border: '1px solid #D0D0D0',
            backgroundColor: '#F0F0F0',
            fontWeight: 'bold',
            width: 22,
            height: 20,
            fontSize: '11px',
            cursor: 'default',
          }}
        >
          B
        </button>
        <button
          disabled
          style={{
            border: '1px solid #D0D0D0',
            backgroundColor: '#F0F0F0',
            fontStyle: 'italic',
            width: 22,
            height: 20,
            fontSize: '11px',
            cursor: 'default',
          }}
        >
          I
        </button>
        <button
          disabled
          style={{
            border: '1px solid #D0D0D0',
            backgroundColor: '#F0F0F0',
            textDecoration: 'underline',
            width: 22,
            height: 20,
            fontSize: '11px',
            cursor: 'default',
          }}
        >
          U
        </button>
      </div>

      {/* 텍스트 영역 */}
      <div
        style={{
          flex: 1,
          padding: 4,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          opacity: readOnly ? 0.7 : 1,
        }}
      >
        {text || '\u00A0'}
      </div>
    </div>
  );
}
