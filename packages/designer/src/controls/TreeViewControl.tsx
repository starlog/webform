import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

interface TreeNode {
  text: string;
  children?: TreeNode[];
  expanded?: boolean;
}

const SAMPLE_NODES: TreeNode[] = [
  {
    text: 'Node 1',
    expanded: true,
    children: [
      { text: 'Child 1-1' },
      { text: 'Child 1-2', children: [{ text: 'Grandchild 1-2-1' }] },
    ],
  },
  { text: 'Node 2', children: [{ text: 'Child 2-1' }] },
  { text: 'Node 3' },
];

function RenderNode({ node, depth }: { node: TreeNode; depth: number }) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = node.expanded !== false && hasChildren;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: depth * 18,
          height: 20,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        <span style={{ width: 16, textAlign: 'center', flexShrink: 0, fontSize: '10px' }}>
          {hasChildren ? (isExpanded ? '\u25BC' : '\u25B6') : ''}
        </span>
        <span style={{ marginLeft: 2 }}>{node.text}</span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child, i) => (
            <RenderNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeViewControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const nodes = (properties.nodes as TreeNode[]) ?? [];
  const displayNodes = nodes.length > 0 ? nodes : SAMPLE_NODES;
  const backColor = (properties.backColor as string) ?? theme.controls.select.background;
  const foreColor = (properties.foreColor as string) ?? theme.controls.select.foreground;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        backgroundColor: backColor,
        color: foreColor,
        border: theme.controls.select.border,
        borderRadius: theme.controls.select.borderRadius,
        overflow: 'auto',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fontSize: '12px',
        boxSizing: 'border-box',
        padding: '2px',
      }}
    >
      {displayNodes.map((node, i) => (
        <RenderNode key={i} node={node} depth={0} />
      ))}
    </div>
  );
}
