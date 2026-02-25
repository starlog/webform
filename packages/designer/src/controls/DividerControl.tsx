import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function DividerControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const text = (properties.text as string) ?? '';
  const orientation = (properties.orientation as string) ?? 'Horizontal';
  const textAlign = (properties.textAlign as string) ?? 'Center';
  const lineStyle = (properties.lineStyle as string) ?? 'Solid';
  const lineColor =
    (properties.lineColor as string) ||
    (properties.foreColor as string) ||
    theme.form.foreground;

  const borderStyleCss = lineStyle.toLowerCase() as 'solid' | 'dashed' | 'dotted';
  const lineColorWithOpacity = lineColor;

  if (orientation === 'Vertical') {
    return (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            height: '100%',
            borderLeft: `1px ${borderStyleCss} ${lineColorWithOpacity}`,
            opacity: 0.2,
          }}
        />
      </div>
    );
  }

  const lineElement = (flex: string) => (
    <div
      style={{
        flex,
        borderTop: `1px ${borderStyleCss} ${lineColorWithOpacity}`,
        opacity: 0.2,
      }}
    />
  );

  if (!text) {
    return (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
      >
        {lineElement('1')}
      </div>
    );
  }

  const leftFlex = textAlign === 'Left' ? '0 0 5%' : '1';
  const rightFlex = textAlign === 'Right' ? '0 0 5%' : '1';

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxSizing: 'border-box',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        color: (properties.foreColor as string) || theme.form.foreground,
        userSelect: 'none',
      }}
    >
      {lineElement(leftFlex)}
      <span
        style={{
          whiteSpace: 'nowrap',
          opacity: 0.65,
          fontSize: 'inherit',
        }}
      >
        {text}
      </span>
      {lineElement(rightFlex)}
    </div>
  );
}
