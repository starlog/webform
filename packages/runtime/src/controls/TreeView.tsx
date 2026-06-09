import { useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { TreeViewView, type TreeNode } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

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

function updateNodeAtPath(
  nodes: TreeNode[],
  pathParts: number[],
  update: Partial<Pick<TreeNode, 'expanded' | 'checked'>>,
): TreeNode[] {
  if (pathParts.length === 0) return nodes;
  return nodes.map((node, i) => {
    if (i !== pathParts[0]) return node;
    if (pathParts.length === 1) {
      return { ...node, ...update };
    }
    return {
      ...node,
      children: node.children
        ? updateNodeAtPath(node.children, pathParts.slice(1), update)
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
  checkBoxes = false,
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
      const updatedNodes = updateNodeAtPath(nodes, pathParts, { expanded });
      updateControlState(id, 'nodes', updatedNodes);
      if (expanded) {
        onAfterExpand?.();
      } else {
        onAfterCollapse?.();
      }
    },
    [id, nodes, updateControlState, onAfterExpand, onAfterCollapse],
  );

  const handleCheck = useCallback(
    (path: string, checked: boolean) => {
      const pathParts = path.split('.').map(Number);
      const updatedNodes = updateNodeAtPath(nodes, pathParts, { checked });
      updateControlState(id, 'nodes', updatedNodes);
    },
    [id, nodes, updateControlState],
  );

  return (
    <TreeViewView
      nodes={nodes}
      selectedNodePath={selectedNodePath}
      showLines={showLines}
      showPlusMinus={showPlusMinus}
      checkBoxes={checkBoxes}
      emptyText="(노드 없음)"
      backColor={backColor}
      foreColor={foreColor}
      interactive={enabled}
      disabled={!enabled}
      onNodeSelect={handleSelect}
      onNodeToggle={handleToggle}
      onNodeCheck={handleCheck}
      className="wf-treeview"
      data-control-id={id}
      style={style}
    />
  );
}
