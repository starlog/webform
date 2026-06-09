import { SplitContainerView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function SplitContainerControl({ properties, size, children }: DesignerControlProps) {
  const orientation = ((properties.orientation as string) || 'Vertical') as 'Horizontal' | 'Vertical';
  const splitterDistance = (properties.splitterDistance as number) ?? Math.round(size.width / 2);
  const splitterWidth = (properties.splitterWidth as number) ?? 4;

  const isVertical = orientation === 'Vertical';
  const childArr = Array.isArray(children) ? children : children ? [children] : [];

  const panel1Size = isVertical
    ? Math.min(splitterDistance, size.width - splitterWidth)
    : Math.min(splitterDistance, size.height - splitterWidth);

  return (
    <SplitContainerView
      orientation={orientation}
      splitterDistance={panel1Size}
      splitterWidth={splitterWidth}
      backColor={properties.backColor as string | undefined}
      panel1={childArr[0] ?? <span style={{ color: '#999', fontSize: 10 }}>Panel1</span>}
      panel2={childArr[1] ?? <span style={{ color: '#999', fontSize: 10 }}>Panel2</span>}
      style={{ width: size.width, height: size.height }}
    />
  );
}
