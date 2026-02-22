import type { DesignerControlProps } from './registry';

export function ProgressBarControl({ properties, size }: DesignerControlProps) {
  const value = (properties.value as number) ?? 0;
  const minimum = (properties.minimum as number) ?? 0;
  const maximum = (properties.maximum as number) ?? 100;
  const percent = maximum > minimum
    ? ((value - minimum) / (maximum - minimum)) * 100
    : 0;

  return (
    <div style={{
      width: size.width,
      height: size.height,
      backgroundColor: '#E6E6E6',
      border: '1px solid #BCBCBC',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, percent))}%`,
        height: '100%',
        backgroundColor: '#06B025',
        transition: 'width 0.2s',
      }} />
    </div>
  );
}
