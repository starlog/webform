import type { CSSProperties } from 'react';
import { useState } from 'react';
import { TOOLBOX_CATEGORIES, getControlsByCategory } from '../../controls/registry';
import { ToolboxItem } from './ToolboxItem';
import { useDesignerStore } from '../../stores/designerStore';

const SHELL_ALLOWED_TYPES = new Set(['MenuStrip', 'ToolStrip', 'StatusStrip', 'Panel']);

export function Toolbox() {
  const editMode = useDesignerStore((s) => s.editMode);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  return (
    <div className="toolbox" role="toolbar" aria-label={editMode === 'shell' ? 'Shell 도구 상자' : '도구 상자'} style={toolboxStyle}>
      <div style={headerStyle}>{editMode === 'shell' ? 'Shell 도구 상자' : '도구 상자'}</div>
      {TOOLBOX_CATEGORIES.map((category) => {
        const isCollapsed = collapsedCategories.has(category.id);
        const allControls = getControlsByCategory(category.id);
        const controls =
          editMode === 'shell'
            ? allControls.filter((m) => SHELL_ALLOWED_TYPES.has(m.type))
            : allControls;

        if (controls.length === 0) return null;

        return (
          <div key={category.id}>
            <div
              role="button"
              tabIndex={0}
              aria-expanded={!isCollapsed}
              style={categoryHeaderStyle}
              onClick={() => toggleCategory(category.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleCategory(category.id);
                }
              }}
            >
              <span>{isCollapsed ? '\u25B6' : '\u25BC'}</span>
              <span>{category.name}</span>
            </div>

            {!isCollapsed && (
              <div style={categoryBodyStyle}>
                {controls.map((meta) => (
                  <ToolboxItem key={meta.type} meta={meta} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const toolboxStyle: CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: CSSProperties = {
  padding: '8px',
  fontWeight: 'bold',
  fontSize: '12px',
  borderBottom: '1px solid #ccc',
  backgroundColor: '#e8e8e8',
};

const categoryHeaderStyle: CSSProperties = {
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 'bold',
  backgroundColor: '#ececec',
  borderBottom: '1px solid #ddd',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  userSelect: 'none',
};

const categoryBodyStyle: CSSProperties = {
  padding: '2px 0',
};
