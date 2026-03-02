import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

export function SplitContainerControl({ properties, size, children }: DesignerControlProps) {
  const theme = useTheme();
  const orientation = (properties.orientation as string) || 'Vertical';
  const splitterDistance = (properties.splitterDistance as number) ?? Math.round(size.width / 2);
  const splitterWidth = (properties.splitterWidth as number) ?? 4;
  const backColor = (properties.backColor as string) || theme.controls.panel.background;

  const isVertical = orientation === 'Vertical';
  const childArr = Array.isArray(children) ? children : children ? [children] : [];

  const panel1Size = isVertical
    ? Math.min(splitterDistance, size.width - splitterWidth)
    : Math.min(splitterDistance, size.height - splitterWidth);

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: 'flex',
        flexDirection: isVertical ? 'row' : 'column',
        backgroundColor: backColor,
        border: `1px solid ${theme.controls.panel.border}`,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Panel1 */}
      <div
        style={{
          ...(isVertical ? { width: panel1Size } : { height: panel1Size }),
          flexShrink: 0,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {childArr[0] ?? (
          <span style={{ color: '#999', fontSize: 10 }}>Panel1</span>
        )}
      </div>

      {/* Splitter */}
      <div
        style={{
          ...(isVertical
            ? { width: splitterWidth, cursor: 'col-resize' }
            : { height: splitterWidth, cursor: 'row-resize' }),
          backgroundColor: theme.controls.toolStrip.separator,
          flexShrink: 0,
        }}
      />

      {/* Panel2 */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {childArr[1] ?? (
          <span style={{ color: '#999', fontSize: 10 }}>Panel2</span>
        )}
      </div>
    </div>
  );
}
