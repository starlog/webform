import type { Snapline as SnaplineType } from '../../utils/snapGrid';

interface SnaplineProps {
  snapline: SnaplineType;
}

export function Snapline({ snapline }: SnaplineProps) {
  const style: React.CSSProperties = snapline.type === 'horizontal'
    ? {
        position: 'absolute',
        left: 0,
        right: 0,
        top: snapline.position,
        height: 1,
        backgroundColor: '#FF00FF',
        pointerEvents: 'none',
        zIndex: 1000,
      }
    : {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: snapline.position,
        width: 1,
        backgroundColor: '#FF00FF',
        pointerEvents: 'none',
        zIndex: 1000,
      };

  return <div className="snapline" style={style} />;
}
