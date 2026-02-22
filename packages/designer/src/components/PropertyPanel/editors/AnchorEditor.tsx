import type { AnchorStyle } from '@webform/common';

interface AnchorEditorProps {
  value: AnchorStyle;
  onChange: (value: AnchorStyle) => void;
}

export function AnchorEditor({ value, onChange }: AnchorEditorProps) {
  const anchor = value ?? { top: true, bottom: false, left: true, right: false };

  const toggle = (side: keyof AnchorStyle) => {
    onChange({ ...anchor, [side]: !anchor[side] });
  };

  const barStyle = (active: boolean): React.CSSProperties => ({
    backgroundColor: active ? '#333' : '#ccc',
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {/* 시각적 다이어그램 */}
      <div
        style={{
          width: 50,
          height: 50,
          position: 'relative',
          border: '1px solid #999',
          backgroundColor: '#f9f9f9',
        }}
      >
        {/* Center box */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 12,
            height: 12,
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#666',
          }}
        />
        {/* Top bar */}
        <div
          onClick={() => toggle('top')}
          style={{
            ...barStyle(anchor.top),
            position: 'absolute',
            top: 4,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 2,
            height: 15,
          }}
        />
        {/* Bottom bar */}
        <div
          onClick={() => toggle('bottom')}
          style={{
            ...barStyle(anchor.bottom),
            position: 'absolute',
            bottom: 4,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 2,
            height: 15,
          }}
        />
        {/* Left bar */}
        <div
          onClick={() => toggle('left')}
          style={{
            ...barStyle(anchor.left),
            position: 'absolute',
            left: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 15,
            height: 2,
          }}
        />
        {/* Right bar */}
        <div
          onClick={() => toggle('right')}
          style={{
            ...barStyle(anchor.right),
            position: 'absolute',
            right: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 15,
            height: 2,
          }}
        />
      </div>

      {/* 체크박스 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 11 }}>
        <label><input type="checkbox" checked={anchor.top} onChange={() => toggle('top')} /> Top</label>
        <label><input type="checkbox" checked={anchor.bottom} onChange={() => toggle('bottom')} /> Bottom</label>
        <label><input type="checkbox" checked={anchor.left} onChange={() => toggle('left')} /> Left</label>
        <label><input type="checkbox" checked={anchor.right} onChange={() => toggle('right')} /> Right</label>
      </div>
    </div>
  );
}
