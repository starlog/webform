import type { CSSProperties } from 'react';
import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

type GraphType =
  | 'Line' | 'Bar' | 'HorizontalBar' | 'Area'
  | 'StackedBar' | 'StackedArea'
  | 'Pie' | 'Donut'
  | 'Scatter' | 'Radar';

const PREVIEW_COLORS = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2'];

export function GraphViewControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const graphType = (properties.graphType as GraphType) || 'Bar';
  const title = (properties.title as string) || '';
  const backColor = (properties.backColor as string) || theme.controls.panel.background;

  const w = size.width;
  const h = size.height;
  const headerH = title ? 20 : 0;
  const chartH = h - headerH - 4;
  const chartW = w - 4;

  return (
    <div
      style={{
        width: w,
        height: h,
        border: theme.controls.panel.border,
        backgroundColor: backColor,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fontSize: 11,
      }}
    >
      {title && (
        <div style={styles.title}>{title}</div>
      )}
      <div style={{ flex: 1, padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={Math.max(chartW, 20)} height={Math.max(chartH, 20)} viewBox={`0 0 ${Math.max(chartW, 20)} ${Math.max(chartH, 20)}`}>
          {renderPreview(graphType, Math.max(chartW, 20), Math.max(chartH, 20))}
        </svg>
      </div>
    </div>
  );
}

function renderPreview(type: GraphType, w: number, h: number): JSX.Element {
  const pad = 8;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  switch (type) {
    case 'Bar':
    case 'StackedBar':
      return renderBarPreview(pad, innerW, innerH, type === 'StackedBar');
    case 'HorizontalBar':
      return renderHorizontalBarPreview(pad, innerW, innerH);
    case 'Line':
      return renderLinePreview(pad, innerW, innerH);
    case 'Area':
    case 'StackedArea':
      return renderAreaPreview(pad, innerW, innerH);
    case 'Pie':
      return renderPiePreview(w, h, false);
    case 'Donut':
      return renderPiePreview(w, h, true);
    case 'Scatter':
      return renderScatterPreview(pad, innerW, innerH);
    case 'Radar':
      return renderRadarPreview(w, h);
    default:
      return renderBarPreview(pad, innerW, innerH, false);
  }
}

function renderBarPreview(pad: number, iw: number, ih: number, stacked: boolean) {
  const bars = [0.6, 0.8, 0.45, 0.9, 0.7];
  const bars2 = [0.3, 0.4, 0.25, 0.35, 0.3];
  const barW = iw / bars.length * 0.6;
  const gap = iw / bars.length;

  return (
    <g>
      <line x1={pad} y1={pad + ih} x2={pad + iw} y2={pad + ih} stroke="#ccc" strokeWidth={1} />
      <line x1={pad} y1={pad} x2={pad} y2={pad + ih} stroke="#ccc" strokeWidth={1} />
      {bars.map((v, i) => {
        const x = pad + i * gap + (gap - barW) / 2;
        const h1 = stacked ? v * ih * 0.5 : v * ih;
        const h2 = stacked ? bars2[i] * ih * 0.5 : 0;
        return (
          <g key={i}>
            <rect x={x} y={pad + ih - h1 - h2} width={barW} height={h1} fill={PREVIEW_COLORS[0]} opacity={0.8} />
            {stacked && (
              <rect x={x} y={pad + ih - h2} width={barW} height={h2} fill={PREVIEW_COLORS[1]} opacity={0.8} />
            )}
          </g>
        );
      })}
    </g>
  );
}

function renderHorizontalBarPreview(pad: number, iw: number, ih: number) {
  const bars = [0.7, 0.9, 0.5, 0.8, 0.6];
  const barH = ih / bars.length * 0.6;
  const gap = ih / bars.length;

  return (
    <g>
      <line x1={pad} y1={pad} x2={pad} y2={pad + ih} stroke="#ccc" strokeWidth={1} />
      <line x1={pad} y1={pad + ih} x2={pad + iw} y2={pad + ih} stroke="#ccc" strokeWidth={1} />
      {bars.map((v, i) => {
        const y = pad + i * gap + (gap - barH) / 2;
        const bw = v * iw;
        return (
          <rect key={i} x={pad} y={y} width={bw} height={barH} fill={PREVIEW_COLORS[i % PREVIEW_COLORS.length]} opacity={0.8} />
        );
      })}
    </g>
  );
}

function renderLinePreview(pad: number, iw: number, ih: number) {
  const points1 = [0.3, 0.6, 0.4, 0.8, 0.65, 0.9];
  const points2 = [0.5, 0.35, 0.55, 0.45, 0.7, 0.6];

  const toPath = (pts: number[]) =>
    pts.map((v, i) => {
      const x = pad + (i / (pts.length - 1)) * iw;
      const y = pad + ih - v * ih;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');

  return (
    <g>
      <line x1={pad} y1={pad + ih} x2={pad + iw} y2={pad + ih} stroke="#ccc" strokeWidth={1} />
      <line x1={pad} y1={pad} x2={pad} y2={pad + ih} stroke="#ccc" strokeWidth={1} />
      <path d={toPath(points1)} fill="none" stroke={PREVIEW_COLORS[0]} strokeWidth={2} />
      <path d={toPath(points2)} fill="none" stroke={PREVIEW_COLORS[1]} strokeWidth={2} />
    </g>
  );
}

function renderAreaPreview(pad: number, iw: number, ih: number) {
  const points = [0.3, 0.6, 0.4, 0.8, 0.65, 0.9];

  const linePath = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * iw;
    const y = pad + ih - v * ih;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  const areaPath = linePath + ` L${pad + iw},${pad + ih} L${pad},${pad + ih} Z`;

  return (
    <g>
      <line x1={pad} y1={pad + ih} x2={pad + iw} y2={pad + ih} stroke="#ccc" strokeWidth={1} />
      <line x1={pad} y1={pad} x2={pad} y2={pad + ih} stroke="#ccc" strokeWidth={1} />
      <path d={areaPath} fill={PREVIEW_COLORS[0]} opacity={0.25} />
      <path d={linePath} fill="none" stroke={PREVIEW_COLORS[0]} strokeWidth={2} />
    </g>
  );
}

function renderPiePreview(w: number, h: number, donut: boolean) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.35;
  const innerR = donut ? r * 0.55 : 0;
  const values = [35, 25, 20, 20];
  const total = values.reduce((a, b) => a + b, 0);

  let startAngle = -Math.PI / 2;
  const arcs = values.map((v, i) => {
    const angle = (v / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    let d = `M${cx + innerR * Math.cos(startAngle)},${cy + innerR * Math.sin(startAngle)} `;
    d += `L${x1},${y1} `;
    d += `A${r},${r} 0 ${largeArc} 1 ${x2},${y2} `;
    if (donut) {
      const ix2 = cx + innerR * Math.cos(endAngle);
      const iy2 = cy + innerR * Math.sin(endAngle);
      d += `L${ix2},${iy2} `;
      d += `A${innerR},${innerR} 0 ${largeArc} 0 ${cx + innerR * Math.cos(startAngle)},${cy + innerR * Math.sin(startAngle)} Z`;
    } else {
      d += `L${cx},${cy} Z`;
    }

    startAngle = endAngle;
    return <path key={i} d={d} fill={PREVIEW_COLORS[i]} opacity={0.8} />;
  });

  return <g>{arcs}</g>;
}

function renderScatterPreview(pad: number, iw: number, ih: number) {
  const dots = [
    [0.2, 0.3], [0.35, 0.6], [0.5, 0.4], [0.55, 0.75],
    [0.7, 0.55], [0.8, 0.85], [0.3, 0.5], [0.65, 0.3],
    [0.45, 0.65], [0.9, 0.7],
  ];

  return (
    <g>
      <line x1={pad} y1={pad + ih} x2={pad + iw} y2={pad + ih} stroke="#ccc" strokeWidth={1} />
      <line x1={pad} y1={pad} x2={pad} y2={pad + ih} stroke="#ccc" strokeWidth={1} />
      {dots.map(([x, y], i) => (
        <circle key={i} cx={pad + x * iw} cy={pad + ih - y * ih} r={3} fill={PREVIEW_COLORS[0]} opacity={0.7} />
      ))}
    </g>
  );
}

function renderRadarPreview(w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.35;
  const sides = 6;
  const values1 = [0.8, 0.6, 0.9, 0.5, 0.7, 0.85];
  const values2 = [0.6, 0.8, 0.5, 0.7, 0.9, 0.65];

  const gridLines = [0.33, 0.66, 1].map((scale) => {
    const pts = Array.from({ length: sides }, (_, i) => {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      return `${cx + r * scale * Math.cos(angle)},${cy + r * scale * Math.sin(angle)}`;
    });
    return <polygon key={scale} points={pts.join(' ')} fill="none" stroke="#ddd" strokeWidth={0.5} />;
  });

  const toPolygon = (vals: number[]) =>
    vals.map((v, i) => {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      return `${cx + r * v * Math.cos(angle)},${cy + r * v * Math.sin(angle)}`;
    }).join(' ');

  return (
    <g>
      {gridLines}
      <polygon points={toPolygon(values1)} fill={PREVIEW_COLORS[0]} fillOpacity={0.25} stroke={PREVIEW_COLORS[0]} strokeWidth={1.5} />
      <polygon points={toPolygon(values2)} fill={PREVIEW_COLORS[1]} fillOpacity={0.2} stroke={PREVIEW_COLORS[1]} strokeWidth={1.5} />
    </g>
  );
}

const styles: Record<string, CSSProperties> = {
  title: {
    textAlign: 'center',
    fontWeight: 600,
    fontSize: 12,
    padding: '2px 4px',
    flexShrink: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
