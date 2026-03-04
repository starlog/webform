import { TooltipView } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

export function TooltipControl({ properties, size, children }: DesignerControlProps) {
  const title = (properties.title as string) ?? 'Tooltip text';

  const hasChildren =
    children !== undefined && children !== null && children !== false && children !== '';

  if (!hasChildren) {
    return (
      <TooltipView
        title={title}
        style={{ width: size.width, height: size.height }}
      />
    );
  }

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {children}
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          fontSize: 10,
          lineHeight: 1,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        💬
      </span>
    </div>
  );
}
