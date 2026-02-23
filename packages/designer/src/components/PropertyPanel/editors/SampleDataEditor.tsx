import { useState, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';

// --- GraphView samples (keyed by graphType) ---
const GRAPH_SAMPLES: Record<string, unknown[]> = {
  Line: [
    { x: 'Jan', sales: 100, profit: 40 },
    { x: 'Feb', sales: 150, profit: 60 },
    { x: 'Mar', sales: 120, profit: 50 },
    { x: 'Apr', sales: 200, profit: 90 },
  ],
  Bar: [
    { x: 'Jan', sales: 100, profit: 40 },
    { x: 'Feb', sales: 150, profit: 60 },
    { x: 'Mar', sales: 120, profit: 50 },
    { x: 'Apr', sales: 200, profit: 90 },
  ],
  HorizontalBar: [
    { x: 'Korea', value: 85 },
    { x: 'USA', value: 72 },
    { x: 'Japan', value: 68 },
    { x: 'Germany', value: 60 },
  ],
  Area: [
    { x: 'Jan', revenue: 400, cost: 240 },
    { x: 'Feb', revenue: 300, cost: 200 },
    { x: 'Mar', revenue: 500, cost: 280 },
    { x: 'Apr', revenue: 450, cost: 260 },
  ],
  StackedBar: [
    { x: 'Q1', online: 120, offline: 80 },
    { x: 'Q2', online: 150, offline: 90 },
    { x: 'Q3', online: 180, offline: 70 },
    { x: 'Q4', online: 200, offline: 100 },
  ],
  StackedArea: [
    { x: 'Jan', mobile: 50, desktop: 80, tablet: 30 },
    { x: 'Feb', mobile: 60, desktop: 75, tablet: 35 },
    { x: 'Mar', mobile: 70, desktop: 70, tablet: 40 },
    { x: 'Apr', mobile: 80, desktop: 65, tablet: 45 },
  ],
  Pie: [
    { name: 'Chrome', value: 65 },
    { name: 'Safari', value: 18 },
    { name: 'Firefox', value: 10 },
    { name: 'Edge', value: 7 },
  ],
  Donut: [
    { name: 'Completed', value: 75 },
    { name: 'In Progress', value: 15 },
    { name: 'Pending', value: 10 },
  ],
  Scatter: [
    { x: 10, y: 30 },
    { x: 20, y: 50 },
    { x: 35, y: 45 },
    { x: 50, y: 80 },
    { x: 65, y: 60 },
  ],
  Radar: [
    { subject: 'Math', A: 120, B: 110 },
    { subject: 'English', A: 98, B: 130 },
    { subject: 'Science', A: 86, B: 90 },
    { subject: 'History', A: 99, B: 85 },
    { subject: 'Art', A: 85, B: 95 },
  ],
};

// --- DataGridView / SpreadsheetView samples (multiple named blocks) ---
interface SampleBlock {
  label: string;
  data: unknown;
}

const DATAGRIDVIEW_SAMPLES: SampleBlock[] = [
  {
    label: 'columns',
    data: [
      { field: 'id', headerText: 'ID', width: 60 },
      { field: 'name', headerText: 'Name', width: 120 },
      { field: 'email', headerText: 'Email', width: 180 },
    ],
  },
  {
    label: 'dataSource',
    data: [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ],
  },
];

const SPREADSHEETVIEW_SAMPLES: SampleBlock[] = [
  {
    label: 'columns',
    data: [
      { field: 'product', headerText: 'Product', width: 120 },
      { field: 'qty', headerText: 'Qty', width: 60 },
      { field: 'price', headerText: 'Price', width: 80 },
    ],
  },
  {
    label: 'data',
    data: [
      { product: 'Widget A', qty: 10, price: 29.99 },
      { product: 'Widget B', qty: 5, price: 49.99 },
      { product: 'Widget C', qty: 20, price: 9.99 },
    ],
  },
];

const MULTI_BLOCK_SAMPLES: Record<string, SampleBlock[]> = {
  DataGridView: DATAGRIDVIEW_SAMPLES,
  SpreadsheetView: SPREADSHEETVIEW_SAMPLES,
};

interface SampleDataEditorProps {
  value: string;
}

export function SampleDataEditor({ value }: SampleDataEditorProps) {
  const blocks = MULTI_BLOCK_SAMPLES[value];
  if (blocks) {
    return <MultiBlockSample blocks={blocks} />;
  }

  // GraphView: value is graphType
  const graphType = value || 'Bar';
  const sample = GRAPH_SAMPLES[graphType] ?? GRAPH_SAMPLES.Bar;
  const json = JSON.stringify(sample, null, 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#666' }}>{graphType}</span>
        <CopyButton text={json} />
      </div>
      <SamplePre>{json}</SamplePre>
    </div>
  );
}

function MultiBlockSample({ blocks }: { blocks: SampleBlock[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {blocks.map((block) => {
        const json = JSON.stringify(block.data, null, 2);
        return (
          <div key={block.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={labelStyle}>{block.label}</span>
              <CopyButton text={json} />
            </div>
            <SamplePre>{json}</SamplePre>
          </div>
        );
      })}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        padding: '1px 8px',
        border: '1px solid',
        borderColor: copied ? '#4caf50' : '#ccc',
        background: copied ? '#4caf50' : '#f5f5f5',
        color: copied ? '#fff' : '#333',
        fontSize: 11,
        cursor: 'pointer',
        borderRadius: 2,
        transition: 'all 0.2s',
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function SamplePre({ children }: { children: string }) {
  return (
    <pre style={preStyle}>
      {children}
    </pre>
  );
}

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#555',
};

const preStyle: CSSProperties = {
  margin: 0,
  padding: 4,
  backgroundColor: '#f8f8f8',
  border: '1px solid #e0e0e0',
  borderRadius: 2,
  fontSize: 10,
  lineHeight: 1.4,
  fontFamily: 'Consolas, Monaco, monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  maxHeight: 200,
  overflowY: 'auto',
  color: '#333',
};
