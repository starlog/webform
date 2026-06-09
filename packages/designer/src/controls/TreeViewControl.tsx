import { TreeViewView, type TreeNode } from '@webform/common/views';
import type { DesignerControlProps } from './registry';

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

export function TreeViewControl({ properties, size }: DesignerControlProps) {
  const nodes = (properties.nodes as TreeNode[]) ?? [];
  const displayNodes = nodes.length > 0 ? nodes : SAMPLE_NODES;

  return (
    <TreeViewView
      nodes={displayNodes}
      showPlusMinus={(properties.showPlusMinus as boolean) ?? true}
      showLines={(properties.showLines as boolean) ?? false}
      checkBoxes={(properties.checkBoxes as boolean) ?? false}
      backColor={properties.backColor as string | undefined}
      foreColor={properties.foreColor as string | undefined}
      style={{ width: size.width, height: size.height }}
    />
  );
}
