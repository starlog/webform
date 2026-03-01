import type { CSSProperties } from 'react';
import { useState, useMemo } from 'react';
import { TOOLBOX_CATEGORIES, getControlsByCategory } from '../../controls/registry';
import { ToolboxItem } from './ToolboxItem';
import { useDesignerStore } from '../../stores/designerStore';

const SHELL_ALLOWED_TYPES = new Set(['MenuStrip', 'ToolStrip', 'StatusStrip', 'Panel']);

export function Toolbox() {
  const editMode = useDesignerStore((s) => s.editMode);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);

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

  const query = searchQuery.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    return TOOLBOX_CATEGORIES.map((category) => {
      const allControls = getControlsByCategory(category.id);
      let controls =
        editMode === 'shell'
          ? allControls.filter((m) => SHELL_ALLOWED_TYPES.has(m.type))
          : allControls;

      if (query) {
        controls = controls.filter(
          (m) =>
            m.displayName.toLowerCase().includes(query) ||
            m.type.toLowerCase().includes(query),
        );
      }

      return { category, controls };
    }).filter(({ controls }) => controls.length > 0);
  }, [editMode, query]);

  return (
    <div className="toolbox" role="toolbar" aria-label={editMode === 'shell' ? 'Shell 도구 상자' : '도구 상자'} style={toolboxStyle}>
      <div
        style={headerStyle}
        onClick={() => setCollapsed((v) => !v)}
      >
        <span style={{ fontSize: 10 }}>{collapsed ? '\u25B6' : '\u25BC'}</span>
        <span>{editMode === 'shell' ? 'Shell 도구 상자' : '도구 상자'}</span>
      </div>

      {collapsed ? null : <>
      {/* 검색 */}
      <div style={searchContainerStyle}>
        <div style={searchInputWrapperStyle}>
          <span style={searchIconStyle}>&#x1F50D;</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="컨트롤 검색..."
            style={searchInputStyle}
          />
          {searchQuery && (
            <span
              role="button"
              tabIndex={0}
              style={clearBtnStyle}
              onClick={() => setSearchQuery('')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSearchQuery('');
                }
              }}
            >
              ✕
            </span>
          )}
        </div>
      </div>

      {/* 카테고리 목록 */}
      <div style={categoryListStyle}>
        {filteredCategories.map(({ category, controls }) => {
          const isCollapsed = !query && collapsedCategories.has(category.id);

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
                <span style={countBadgeStyle}>{controls.length}</span>
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

        {filteredCategories.length === 0 && query && (
          <div style={noResultStyle}>
            일치하는 컨트롤이 없습니다.
          </div>
        )}
      </div>
      </>}
    </div>
  );
}

const toolboxStyle: CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: CSSProperties = {
  padding: '4px 8px',
  fontWeight: 'bold',
  fontSize: '11px',
  borderBottom: '1px solid #ccc',
  backgroundColor: '#e8e8e8',
  cursor: 'pointer',
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const searchContainerStyle: CSSProperties = {
  padding: '4px 6px',
  borderBottom: '1px solid #ddd',
  backgroundColor: '#f5f5f5',
};

const searchInputWrapperStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  backgroundColor: '#fff',
  border: '1px solid #ccc',
  borderRadius: '3px',
  padding: '0 4px',
};

const searchIconStyle: CSSProperties = {
  fontSize: '11px',
  color: '#999',
  flexShrink: 0,
};

const searchInputStyle: CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  fontSize: '11px',
  padding: '4px 4px',
  backgroundColor: 'transparent',
  minWidth: 0,
};

const clearBtnStyle: CSSProperties = {
  cursor: 'pointer',
  color: '#999',
  fontSize: '10px',
  padding: '0 2px',
  flexShrink: 0,
  lineHeight: 1,
};

const categoryListStyle: CSSProperties = {
  flex: 1,
  overflow: 'auto',
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

const countBadgeStyle: CSSProperties = {
  marginLeft: 'auto',
  fontSize: '10px',
  color: '#999',
  fontWeight: 'normal',
};

const categoryBodyStyle: CSSProperties = {
  padding: '2px 0',
};

const noResultStyle: CSSProperties = {
  padding: '16px 8px',
  textAlign: 'center',
  color: '#999',
  fontSize: '11px',
  fontStyle: 'italic',
};
