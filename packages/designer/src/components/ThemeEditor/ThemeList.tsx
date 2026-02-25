import { useState, useCallback, useMemo } from 'react';
import type { CustomThemeDocument } from '@webform/common';
import { useThemeEditorStore } from '../../stores/themeEditorStore';
import { apiService } from '../../services/apiService';

interface ThemeListProps {
  onStatusMessage: (msg: string) => void;
}

export function ThemeList({ onStatusMessage }: ThemeListProps) {
  const themes = useThemeEditorStore((s) => s.themes);
  const currentThemeId = useThemeEditorStore((s) => s.currentThemeId);
  const selectTheme = useThemeEditorStore((s) => s.selectTheme);
  const addTheme = useThemeEditorStore((s) => s.addTheme);
  const removeTheme = useThemeEditorStore((s) => s.removeTheme);
  const isDirty = useThemeEditorStore((s) => s.isDirty);

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 프리셋 테마와 커스텀 테마 분리 (API에서 isPreset 필드로 구분)
  const presetThemes = useMemo(() => {
    const presets = themes.filter((t) => t.isPreset);
    const sorted = [...presets].sort((a, b) => a.name.localeCompare(b.name));
    if (!searchQuery) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter((t) => t.name.toLowerCase().includes(q));
  }, [themes, searchQuery]);

  const customThemes = useMemo(() => {
    const custom = themes.filter((t) => !t.isPreset);
    if (!searchQuery) return custom;
    const q = searchQuery.toLowerCase();
    return custom.filter((t) => t.name.toLowerCase().includes(q));
  }, [themes, searchQuery]);

  const handleSelectTheme = useCallback(
    (theme: CustomThemeDocument) => {
      selectTheme(theme._id, theme.tokens, theme.isPreset);
    },
    [selectTheme],
  );

  const handleDuplicate = useCallback(
    async (theme: CustomThemeDocument) => {
      setDuplicatingId(theme._id);
      try {
        const name = `${theme.name} Copy`;
        const res = await apiService.createTheme({
          name,
          basePreset: theme.presetId,
          tokens: { ...theme.tokens, id: '', name },
        });
        const newTheme = res.data;
        addTheme(newTheme);
        selectTheme(newTheme._id, newTheme.tokens, false);
        onStatusMessage('Theme created');
      } catch {
        onStatusMessage('Failed to create theme');
      } finally {
        setDuplicatingId(null);
      }
    },
    [addTheme, selectTheme, onStatusMessage],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this theme?')) return;
      try {
        await apiService.deleteTheme(id);
        removeTheme(id);
        onStatusMessage('Theme deleted');
      } catch {
        onStatusMessage('Failed to delete theme');
      }
    },
    [removeTheme, onStatusMessage],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '6px 8px',
          fontWeight: 600,
          fontSize: 12,
          borderBottom: '1px solid #ccc',
          backgroundColor: '#e8e8e8',
        }}
      >
        Themes
      </div>

      <div style={{ padding: '4px 6px', borderBottom: '1px solid #ddd' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search themes..."
          style={{
            width: '100%',
            padding: '3px 6px',
            fontSize: 11,
            border: '1px solid #ccc',
            borderRadius: 3,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', fontSize: 12 }}>
        {/* Preset Themes */}
        <div style={{ padding: '4px 0' }}>
          <div
            style={{
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: '#666',
              textTransform: 'uppercase',
            }}
          >
            Presets ({presetThemes.length})
          </div>
          {presetThemes.map((theme) => {
            const isSelected = currentThemeId === theme._id;
            return (
              <div
                key={theme._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#d0e8ff' : 'transparent',
                }}
                onClick={() => handleSelectTheme(theme)}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    backgroundColor: theme.tokens?.accent?.primary ?? '#ccc',
                    marginRight: 6,
                    flexShrink: 0,
                    border: '1px solid rgba(0,0,0,0.15)',
                  }}
                />
                <span style={{ flex: 1 }}>
                  {theme.name}{' '}
                  <span style={{ color: '#999', fontSize: 10 }}>(P)</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicate(theme);
                  }}
                  disabled={duplicatingId === theme._id}
                  style={{
                    padding: '1px 4px',
                    border: '1px solid #ccc',
                    borderRadius: 2,
                    background: '#f5f5f5',
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                  title="Duplicate this preset as a custom theme"
                >
                  Duplicate
                </button>
              </div>
            );
          })}
        </div>

        {/* Custom Themes */}
        <div style={{ padding: '4px 0', borderTop: '1px solid #ddd' }}>
          <div
            style={{
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: '#666',
              textTransform: 'uppercase',
            }}
          >
            Custom ({customThemes.length})
          </div>
          {customThemes.length === 0 && (
            <div style={{ padding: '4px 8px', color: '#999', fontSize: 11 }}>
              {searchQuery ? 'No matching custom themes.' : 'No custom themes yet. Duplicate a preset to start.'}
            </div>
          )}
          {customThemes.map((theme) => {
            const isSelected = currentThemeId === theme._id;
            return (
              <div
                key={theme._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#d0e8ff' : 'transparent',
                }}
                onClick={() => handleSelectTheme(theme)}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    backgroundColor: theme.tokens?.accent?.primary ?? '#ccc',
                    marginRight: 6,
                    flexShrink: 0,
                    border: '1px solid rgba(0,0,0,0.15)',
                  }}
                />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {theme.name}
                  {isSelected && isDirty && <span style={{ color: '#e65100' }}> *</span>}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicate(theme);
                  }}
                  disabled={duplicatingId === theme._id}
                  style={{
                    padding: '1px 4px',
                    border: '1px solid #ccc',
                    borderRadius: 2,
                    background: '#f5f5f5',
                    fontSize: 10,
                    cursor: 'pointer',
                    marginRight: 2,
                  }}
                  title="Duplicate"
                >
                  Dup
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(theme._id);
                  }}
                  style={{
                    padding: '1px 4px',
                    border: '1px solid #ccc',
                    borderRadius: 2,
                    background: '#f5f5f5',
                    fontSize: 10,
                    cursor: 'pointer',
                    color: '#c62828',
                  }}
                  title="Delete"
                >
                  Del
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
