import type { CSSProperties } from 'react';
import type { DesignerControlProps } from './registry';
import { useControlColors } from '../theme/useControlColors';

export function SwitchControl({ properties, size }: DesignerControlProps) {
  const checked = (properties.checked as boolean) ?? false;
  const text = (properties.text as string) ?? '';
  const onText = (properties.onText as string) ?? '';
  const offText = (properties.offText as string) ?? '';
  const onColor = (properties.onColor as string) || '#1677ff';
  const offColor = (properties.offColor as string) || 'rgba(0,0,0,0.25)';
  const colors = useControlColors('Switch', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  const trackBg = checked ? onColor : offColor;

  const trackStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    width: 44,
    height: 22,
    borderRadius: 11,
    backgroundColor: trackBg,
    flexShrink: 0,
    transition: 'background-color 0.2s ease',
  };

  const thumbStyle: CSSProperties = {
    position: 'absolute',
    top: 2,
    left: checked ? 24 : 2,
    width: 18,
    height: 18,
    borderRadius: '50%',
    backgroundColor: '#fff',
    transition: 'left 0.2s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
  };

  const trackTextStyle: CSSProperties = {
    fontSize: '0.65em',
    color: '#fff',
    userSelect: 'none',
    position: 'absolute',
    left: checked ? 6 : undefined,
    right: checked ? undefined : 6,
  };

  const displayText = checked ? onText : offText;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 'inherit',
        fontFamily: 'inherit',
        color: colors.color,
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {text && (
        <span style={{ userSelect: 'none', whiteSpace: 'nowrap' }}>{text}</span>
      )}
      <div style={trackStyle}>
        {displayText && <span style={trackTextStyle}>{displayText}</span>}
        <div style={thumbStyle} />
      </div>
    </div>
  );
}
