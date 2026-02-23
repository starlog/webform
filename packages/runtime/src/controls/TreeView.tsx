import { useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

interface TreeNode {
  text: string;
  children?: TreeNode[];
  expanded?: boolean;
  imageIndex?: number;
}

interface TreeViewProps {
  id: string;
  name: string;
  nodes?: TreeNode[];
  selectedNodePath?: string;
  showLines?: boolean;
  showPlusMinus?: boolean;
  checkBoxes?: boolean;
  style?: CSSProperties;
  enabled?: boolean;
  backColor?: string;
  foreColor?: string;
  onAfterSelect?: () => void;
  onAfterExpand?: () => void;
  onAfterCollapse?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

const baseStyle: CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1px inset #D0D0D0',
  overflow: 'auto',
  fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
  fontSize: '12px',
  boxSizing: 'border-box',
  padding: '2px',
};

function TreeNodeItem({
  node,
  path,
  depth,
  selectedNodePath,
  showLines,
  showPlusMinus,
  enabled,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  path: string;
  depth: number;
  selectedNodePath: string;
  showLines: boolean;
  showPlusMinus: boolean;
  enabled: boolean;
  onToggle: (path: string, expanded: boolean) => void;
  onSelect: (path: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = node.expanded !== false && hasChildren;
  const isSelected = path === selectedNodePath;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: depth * 18,
          height: 20,
          cursor: enabled ? 'pointer' : 'default',
          backgroundColor: isSelected ? '#0078D7' : 'transparent',
          color: isSelected ? '#FFFFFF' : 'inherit',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
        onClick={() => {
          if (!enabled) return;
          onSelect(path);
        }}
      >
        {showPlusMinus && hasChildren && (
          <span
            style={{
              width: 16,
              textAlign: 'center',
              flexShrink: 0,
              fontSize: '10px',
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!enabled) return;
              onToggle(path, !isExpanded);
            }}
          >
            {isExpanded ? '\u25BC' : '\u25B6'}
          </span>
        )}
        {showPlusMinus && !hasChildren && (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}
        {showLines && (
          <span
            style={{
              width: 12,
              height: 1,
              borderBottom: '1px dotted #999',
              flexShrink: 0,
            }}
          />
        )}
        <span style={{ marginLeft: 2 }}>{node.text}</span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child, i) => (
            <TreeNodeItem
              key={i}
              node={child}
              path={`${path}.${i}`}
              depth={depth + 1}
              selectedNodePath={selectedNodePath}
              showLines={showLines}
              showPlusMinus={showPlusMinus}
              enabled={enabled}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function updateNodeAtPath(nodes: TreeNode[], pathParts: number[], expanded: boolean): TreeNode[] {
  if (pathParts.length === 0) return nodes;
  return nodes.map((node, i) => {
    if (i !== pathParts[0]) return node;
    if (pathParts.length === 1) {
      return { ...node, expanded };
    }
    return {
      ...node,
      children: node.children
        ? updateNodeAtPath(node.children, pathParts.slice(1), expanded)
        : node.children,
    };
  });
}

export function TreeView({
  id,
  nodes = [],
  selectedNodePath = '',
  showLines = false,
  showPlusMinus = true,
  style,
  enabled = true,
  backColor,
  foreColor,
  onAfterSelect,
  onAfterExpand,
  onAfterCollapse,
}: TreeViewProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const handleSelect = useCallback(
    (path: string) => {
      updateControlState(id, 'selectedNodePath', path);
      onAfterSelect?.();
    },
    [id, updateControlState, onAfterSelect],
  );

  const handleToggle = useCallback(
    (path: string, expanded: boolean) => {
      const pathParts = path.split('.').map(Number);
      const updatedNodes = updateNodeAtPath(nodes, pathParts, expanded);
      updateControlState(id, 'nodes', updatedNodes);
      if (expanded) {
        onAfterExpand?.();
      } else {
        onAfterCollapse?.();
      }
    },
    [id, nodes, updateControlState, onAfterExpand, onAfterCollapse],
  );

  const mergedStyle: CSSProperties = {
    ...baseStyle,
    ...(backColor ? { backgroundColor: backColor } : {}),
    ...(foreColor ? { color: foreColor } : {}),
    ...style,
    opacity: enabled ? 1 : 0.6,
  };

  return (
    <div className="wf-treeview" data-control-id={id} style={mergedStyle}>
      {nodes.length === 0 ? (
        <div style={{ padding: '4px', color: '#999' }}>(노드 없음)</div>
      ) : (
        nodes.map((node, i) => (
          <TreeNodeItem
            key={i}
            node={node}
            path={String(i)}
            depth={0}
            selectedNodePath={selectedNodePath}
            showLines={showLines}
            showPlusMinus={showPlusMinus}
            enabled={enabled}
            onToggle={handleToggle}
            onSelect={handleSelect}
          />
        ))
      )}
    </div>
  );
}
