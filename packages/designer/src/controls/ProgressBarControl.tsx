import { ProgressBarView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function ProgressBarControl({ properties, size }: DesignerControlProps) {
  return (
    <ProgressBarView
      value={(properties.value as number) ?? 0}
      minimum={(properties.minimum as number) ?? 0}
      maximum={(properties.maximum as number) ?? 100}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
