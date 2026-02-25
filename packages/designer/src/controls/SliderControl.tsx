import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function SliderControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const value = (properties.value as number) ?? 0;
  const minimum = (properties.minimum as number) ?? 0;
  const maximum = (properties.maximum as number) ?? 100;
  const orientation = (properties.orientation as string) ?? 'Horizontal';
  const showValue = (properties.showValue as boolean) ?? true;

  const percent =
    maximum > minimum ? ((value - minimum) / (maximum - minimum)) * 100 : 0;
  const clampedPercent = Math.min(100, Math.max(0, percent));

  const isVertical = orientation === 'Vertical';

  const track = (
    <div
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          height: 4,
          backgroundColor: theme.controls.progressBar.background,
          borderRadius: 2,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${clampedPercent}%`,
            height: '100%',
            backgroundColor: theme.controls.progressBar.fillBackground,
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: `${clampedPercent}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: theme.controls.progressBar.fillBackground,
          border: '2px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          boxSizing: 'border-box',
        }}
      />
      {showValue && (
        <div
          style={{
            position: 'absolute',
            left: `${clampedPercent}%`,
            top: -18,
            transform: 'translateX(-50%)',
            fontSize: 11,
            color: (properties.foreColor as string) || theme.form.foreground,
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: showValue && !isVertical ? '18px 8px 0 8px' : '0 8px',
        ...(isVertical
          ? {
              transform: 'rotate(-90deg)',
              transformOrigin: 'center center',
            }
          : {}),
      }}
    >
      {track}
    </div>
  );
}
