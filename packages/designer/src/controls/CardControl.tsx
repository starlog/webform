import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

export function CardControl({ properties, size, children }: DesignerControlProps) {
  const theme = useTheme();

  const title = (properties.title as string) ?? 'Card Title';
  const subtitle = (properties.subtitle as string) ?? '';
  const showHeader = (properties.showHeader as boolean) ?? true;
  const showBorder = (properties.showBorder as boolean) ?? true;
  const hoverable = (properties.hoverable as boolean) ?? false;
  const cardSize = (properties.size as string) ?? 'Default';
  const borderRadius = (properties.borderRadius as number) ?? 8;
  const backColor = properties.backColor as string | undefined;
  const foreColor = properties.foreColor as string | undefined;

  const isSmall = cardSize === 'Small';
  const headerPadding = isSmall ? '8px 12px' : '12px 16px';
  const bodyPadding = isSmall ? 12 : 16;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        borderRadius,
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        border: showBorder ? `1px solid ${theme.controls.panel.border}` : 'none',
        backgroundColor: backColor ?? theme.form.backgroundColor,
        color: foreColor ?? theme.form.foreground,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
        cursor: hoverable ? 'pointer' : undefined,
        position: 'relative',
      }}
    >
      {showHeader && (
        <div
          style={{
            padding: headerPadding,
            borderBottom: `1px solid ${theme.controls.panel.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600 }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
      )}
      <div
        style={{
          flex: 1,
          padding: bodyPadding,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
