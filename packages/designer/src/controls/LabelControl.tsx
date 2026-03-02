import { labelBaseStyle } from '@webform/common';
import type { DesignerControlProps } from './registry';
import { useControlColors } from '../theme/useControlColors';

export function LabelControl({ properties, size }: DesignerControlProps) {
  const text = (properties.text as string) ?? 'Label';
  const textAlign = (properties.textAlign as string) ?? 'TopLeft';
  const colors = useControlColors('Label', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  return (
    <span style={{
      ...labelBaseStyle(colors, textAlign),
      width: size.width,
      height: size.height,
    }}>
      {text}
    </span>
  );
}
