import { RichTextBoxView, richTextContentBaseStyle } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function RichTextBoxControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? '';
  const readOnly = (properties.readOnly as boolean) ?? false;

  return (
    <RichTextBoxView
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      readOnly={readOnly}
      style={{
        width: size.width,
        height: size.height,
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fontSize: '12px',
      }}
    >
      <div
        style={{
          ...richTextContentBaseStyle,
          overflow: 'auto',
          opacity: readOnly ? 0.7 : 1,
        }}
      >
        {text || ' '}
      </div>
    </RichTextBoxView>
  );
}
