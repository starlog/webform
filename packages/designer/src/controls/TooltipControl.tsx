import type { DesignerControlProps } from './registry';

export function TooltipControl({ properties, size, children }: DesignerControlProps) {
  const title = (properties.title as string) ?? 'Tooltip text';

  const hasChildren =
    children !== undefined && children !== null && children !== false && children !== '';

  if (!hasChildren) {
    return (
      <div
        style={{
          width: size.width,
          height: size.height,
          border: '1px dashed gray',
          minHeight: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: 'gray',
          boxSizing: 'border-box',
          userSelect: 'none',
          position: 'relative',
        }}
      >
        [Tooltip] {title}
      </div>
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
