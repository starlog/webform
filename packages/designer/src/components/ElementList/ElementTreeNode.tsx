export interface TreeNode {
  id: string;
  name: string;
  icon: string;
  children: TreeNode[];
}

interface ElementTreeNodeProps {
  node: TreeNode;
  depth: number;
  expandedNodes: Set<string>;
  selectedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string, ctrlKey: boolean) => void;
}

export function ElementTreeNode({
  node,
  depth,
  expandedNodes,
  selectedIds,
  onToggleExpand,
  onSelect,
}: ElementTreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedIds.has(node.id);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `2px 8px 2px ${8 + depth * 16}px`,
          cursor: 'pointer',
          backgroundColor: isSelected ? '#cce5ff' : 'transparent',
          userSelect: 'none',
          fontSize: 12,
        }}
        onClick={(e) => onSelect(node.id, e.ctrlKey || e.metaKey)}
      >
        {hasChildren ? (
          <span
            style={{ marginRight: 4, fontSize: 10, width: 10, textAlign: 'center', flexShrink: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
        ) : (
          <span style={{ marginRight: 4, width: 10, flexShrink: 0 }} />
        )}
        <span style={{ marginRight: 4, flexShrink: 0 }}>{node.icon}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
      </div>
      {hasChildren &&
        isExpanded &&
        node.children.map((child) => (
          <ElementTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            expandedNodes={expandedNodes}
            selectedIds={selectedIds}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}
