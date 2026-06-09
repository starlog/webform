import type { CSSProperties } from 'react';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';
import type { ThemeTokens } from '../../types/theme.js';

export interface TreeNode {
  text?: string;
  label?: string;
  children?: TreeNode[];
  expanded?: boolean;
  checked?: boolean;
  imageIndex?: number;
}

export interface TreeViewViewProps {
  nodes?: TreeNode[];
  selectedNodePath?: string;
  showLines?: boolean;
  showPlusMinus?: boolean;
  checkBoxes?: boolean;
  /** 노드가 없을 때 표시할 문구 (미지정 시 아무것도 표시하지 않음) */
  emptyText?: string;
  backColor?: string;
  foreColor?: string;
  interactive?: boolean;
  disabled?: boolean;
  onNodeSelect?: (path: string) => void;
  onNodeToggle?: (path: string, expanded: boolean) => void;
  onNodeCheck?: (path: string, checked: boolean) => void;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

function TreeNodeItem({
  node,
  path,
  depth,
  selectedNodePath,
  showLines,
  showPlusMinus,
  checkBoxes,
  clickable,
  onSelect,
  onToggle,
  onCheck,
  theme,
}: {
  node: TreeNode;
  path: string;
  depth: number;
  selectedNodePath: string;
  showLines: boolean;
  showPlusMinus: boolean;
  checkBoxes: boolean;
  clickable: boolean;
  onSelect?: (path: string) => void;
  onToggle?: (path: string, expanded: boolean) => void;
  onCheck?: (path: string, checked: boolean) => void;
  theme: ThemeTokens;
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
          cursor: clickable ? 'pointer' : 'default',
          backgroundColor: isSelected ? theme.controls.select.selectedBackground : 'transparent',
          color: isSelected ? theme.controls.select.selectedForeground : 'inherit',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
        onClick={() => {
          if (!clickable) return;
          onSelect?.(path);
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
              if (!clickable) return;
              onToggle?.(path, !isExpanded);
            }}
          >
            {isExpanded ? '▼' : '▶'}
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
        {checkBoxes && (
          <input
            type="checkbox"
            checked={!!node.checked}
            disabled={!clickable}
            style={{ margin: '0 2px 0 0', flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
            onChange={() => {
              if (!clickable) return;
              onCheck?.(path, !node.checked);
            }}
          />
        )}
        <span style={{ marginLeft: 2 }}>{node.text || node.label}</span>
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
              checkBoxes={checkBoxes}
              clickable={clickable}
              onSelect={onSelect}
              onToggle={onToggle}
              onCheck={onCheck}
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeViewView({
  nodes = [],
  selectedNodePath = '',
  showLines = false,
  showPlusMinus = true,
  checkBoxes = false,
  emptyText,
  backColor,
  foreColor,
  interactive = false,
  disabled = false,
  onNodeSelect,
  onNodeToggle,
  onNodeCheck,
  style,
  className,
  'data-control-id': dataControlId,
}: TreeViewViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('TreeView', { backColor, foreColor });
  const clickable = interactive && !disabled;

  const rootStyle: CSSProperties = {
    background: colors.background,
    color: colors.color,
    border: theme.controls.select.border,
    borderRadius: theme.controls.select.borderRadius,
    overflow: 'auto',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: '12px',
    boxSizing: 'border-box',
    padding: '2px',
    opacity: disabled ? 0.6 : 1,
    ...style,
  };

  return (
    <div className={className} data-control-id={dataControlId} style={rootStyle}>
      {nodes.length === 0 ? (
        emptyText ? <div style={{ padding: '4px', color: '#999' }}>{emptyText}</div> : null
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
            checkBoxes={checkBoxes}
            clickable={clickable}
            onSelect={onNodeSelect}
            onToggle={onNodeToggle}
            onCheck={onNodeCheck}
            theme={theme}
          />
        ))
      )}
    </div>
  );
}
