import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { FontDefinition } from '@webform/common';
import { computeFontStyle } from '../renderer/layoutUtils';
import { useControlColors } from '../theme/useControlColors';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const DEFAULT_COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

type GraphType =
  | 'Line' | 'Bar' | 'HorizontalBar' | 'Area'
  | 'StackedBar' | 'StackedArea'
  | 'Pie' | 'Donut'
  | 'Scatter' | 'Radar';

const CATEGORY_KEYS = new Set(['x', 'name', 'subject']);

interface GraphViewProps {
  id: string;
  name: string;
  graphType?: GraphType;
  data?: unknown;
  title?: string;
  xAxisTitle?: string;
  yAxisTitle?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  colors?: string;
  font?: FontDefinition;
  foreColor?: string;
  backColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onDataLoaded?: () => void;
  [key: string]: unknown;
}

function parseData(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data;
  if (typeof data === 'string' && data.trim()) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
  }
  return [];
}

function detectCategoryKey(row: Record<string, unknown>): string | null {
  for (const key of CATEGORY_KEYS) {
    if (key in row) return key;
  }
  return null;
}

function detectSeriesKeys(row: Record<string, unknown>, categoryKey: string | null): string[] {
  return Object.keys(row).filter(
    (k) => k !== categoryKey && !CATEGORY_KEYS.has(k) && typeof row[k] === 'number',
  );
}

export function GraphView({
  graphType = 'Bar',
  data,
  title,
  xAxisTitle,
  yAxisTitle,
  showLegend = true,
  showGrid = true,
  colors,
  font,
  foreColor,
  backColor,
  style,
}: GraphViewProps) {
  const controlColors = useControlColors('GraphView', { backColor, foreColor });
  const chartData = useMemo(() => parseData(data), [data]);
  const palette = useMemo(
    () => (colors ? colors.split(',').map((c) => c.trim()).filter(Boolean) : DEFAULT_COLORS),
    [colors],
  );

  const { categoryKey, seriesKeys } = useMemo(() => {
    if (chartData.length === 0) return { categoryKey: null, seriesKeys: [] };
    const first = chartData[0] as Record<string, unknown>;
    const catKey = detectCategoryKey(first);
    return { categoryKey: catKey, seriesKeys: detectSeriesKeys(first, catKey) };
  }, [chartData]);

  const fontStyle = font ? computeFontStyle(font) : {};
  const containerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    background: controlColors.background,
    color: controlColors.color,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    ...fontStyle,
    ...style,
  };

  const titleStyle: CSSProperties = {
    textAlign: 'center',
    fontWeight: 600,
    fontSize: font ? font.size + 2 : 14,
    padding: '4px 0',
    flexShrink: 0,
  };

  const getColor = (i: number) => palette[i % palette.length];

  const isEmpty = chartData.length === 0;

  const renderEmpty = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#999' }}>
      No data
    </div>
  );

  const gridElement = showGrid ? <CartesianGrid strokeDasharray="3 3" /> : null;
  const legendElement = showLegend ? <Legend /> : null;

  const renderCartesian = () => {
    const dataKey = categoryKey || 'x';

    switch (graphType) {
      case 'Line':
        return (
          <LineChart data={chartData}>
            {gridElement}
            <XAxis dataKey={dataKey} label={xAxisTitle ? { value: xAxisTitle, position: 'insideBottom', offset: -5 } : undefined} />
            <YAxis label={yAxisTitle ? { value: yAxisTitle, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip />
            {legendElement}
            {seriesKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={getColor(i)} dot={false} />
            ))}
          </LineChart>
        );

      case 'Bar':
        return (
          <BarChart data={chartData}>
            {gridElement}
            <XAxis dataKey={dataKey} label={xAxisTitle ? { value: xAxisTitle, position: 'insideBottom', offset: -5 } : undefined} />
            <YAxis label={yAxisTitle ? { value: yAxisTitle, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip />
            {legendElement}
            {seriesKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={getColor(i)} />
            ))}
          </BarChart>
        );

      case 'HorizontalBar':
        return (
          <BarChart data={chartData} layout="vertical">
            {gridElement}
            <XAxis type="number" label={xAxisTitle ? { value: xAxisTitle, position: 'insideBottom', offset: -5 } : undefined} />
            <YAxis dataKey={dataKey} type="category" label={yAxisTitle ? { value: yAxisTitle, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip />
            {legendElement}
            {seriesKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={getColor(i)} />
            ))}
          </BarChart>
        );

      case 'Area':
        return (
          <AreaChart data={chartData}>
            {gridElement}
            <XAxis dataKey={dataKey} label={xAxisTitle ? { value: xAxisTitle, position: 'insideBottom', offset: -5 } : undefined} />
            <YAxis label={yAxisTitle ? { value: yAxisTitle, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip />
            {legendElement}
            {seriesKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} stroke={getColor(i)} fill={getColor(i)} fillOpacity={0.3} />
            ))}
          </AreaChart>
        );

      case 'StackedBar':
        return (
          <BarChart data={chartData}>
            {gridElement}
            <XAxis dataKey={dataKey} label={xAxisTitle ? { value: xAxisTitle, position: 'insideBottom', offset: -5 } : undefined} />
            <YAxis label={yAxisTitle ? { value: yAxisTitle, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip />
            {legendElement}
            {seriesKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={getColor(i)} stackId="stack" />
            ))}
          </BarChart>
        );

      case 'StackedArea':
        return (
          <AreaChart data={chartData}>
            {gridElement}
            <XAxis dataKey={dataKey} label={xAxisTitle ? { value: xAxisTitle, position: 'insideBottom', offset: -5 } : undefined} />
            <YAxis label={yAxisTitle ? { value: yAxisTitle, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip />
            {legendElement}
            {seriesKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} stroke={getColor(i)} fill={getColor(i)} stackId="stack" />
            ))}
          </AreaChart>
        );

      case 'Scatter':
        return (
          <ScatterChart>
            {gridElement}
            <XAxis dataKey="x" type="number" name={xAxisTitle || 'x'} label={xAxisTitle ? { value: xAxisTitle, position: 'insideBottom', offset: -5 } : undefined} />
            <YAxis dataKey="y" type="number" name={yAxisTitle || 'y'} label={yAxisTitle ? { value: yAxisTitle, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            {legendElement}
            <Scatter data={chartData} fill={getColor(0)} />
          </ScatterChart>
        );

      default:
        return null;
    }
  };

  const renderPolar = () => {
    const dataKey = categoryKey || 'name';

    if (graphType === 'Pie' || graphType === 'Donut') {
      const innerRadius = graphType === 'Donut' ? '40%' : 0;
      return (
        <PieChart>
          <Pie
            data={chartData}
            dataKey={seriesKeys[0] || 'value'}
            nameKey={dataKey}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius="70%"
            label
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={getColor(i)} />
            ))}
          </Pie>
          <Tooltip />
          {legendElement}
        </PieChart>
      );
    }

    if (graphType === 'Radar') {
      return (
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid />
          <PolarAngleAxis dataKey={dataKey} />
          <PolarRadiusAxis />
          <Tooltip />
          {legendElement}
          {seriesKeys.map((key, i) => (
            <Radar key={key} dataKey={key} stroke={getColor(i)} fill={getColor(i)} fillOpacity={0.3} />
          ))}
        </RadarChart>
      );
    }

    return null;
  };

  const isPolar = graphType === 'Pie' || graphType === 'Donut' || graphType === 'Radar';

  return (
    <div style={containerStyle}>
      {title && <div style={titleStyle}>{title}</div>}
      {isEmpty ? renderEmpty() : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            {isPolar ? renderPolar()! : renderCartesian()!}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
