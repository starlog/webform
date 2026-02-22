import type { CSSProperties } from 'react';
import { useState } from 'react';
import { TOOLBOX_CATEGORIES, getControlsByCategory } from '../../controls/registry';
import { ToolboxItem } from './ToolboxItem';

export function Toolbox() {
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
    <div className="toolbox" style={toolboxStyle}>
      <div style={headerStyle}>{'\uB3C4\uAD6C \uC0C1\uC790'}</div>
      {TOOLBOX_CATEGORIES.map((category) => {
        const isCollapsed = collapsedCategories.has(category.id);
        const controls = getControlsByCategory(category.id);

        return (
          <div key={category.id}>
            <div
              style={categoryHeaderStyle}
              onClick={() => toggleCategory(category.id)}
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
