import { useState, useCallback } from 'react';
import type { PresetThemeId, CustomThemeDocument } from '@webform/common';
import { PRESET_THEME_IDS, getPresetThemeById } from '@webform/common';
import { useThemeEditorStore } from '../../stores/themeEditorStore';
import { apiService } from '../../services/apiService';

interface ThemeListProps {
  onStatusMessage: (msg: string) => void;
}

export function ThemeList({ onStatusMessage }: ThemeListProps) {
  const themes = useThemeEditorStore((s) => s.themes);
  const currentThemeId = useThemeEditorStore((s) => s.currentThemeId);
  const selectTheme = useThemeEditorStore((s) => s.selectTheme);
  const selectPreset = useThemeEditorStore((s) => s.selectPreset);
  const addTheme = useThemeEditorStore((s) => s.addTheme);
  const removeTheme = useThemeEditorStore((s) => s.removeTheme);
  const isDirty = useThemeEditorStore((s) => s.isDirty);

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const handleSelectPreset = useCallback(
    (id: PresetThemeId) => {
      selectPreset(id);
    },
    [selectPreset],
  );

  const handleSelectCustom = useCallback(
    (theme: CustomThemeDocument) => {
      selectTheme(theme._id, theme.tokens);
    },
    [selectTheme],
  );

  const handleDuplicate = useCallback(
    async (presetId: PresetThemeId) => {
      setDuplicatingId(presetId);
      try {
        const baseTheme = getPresetThemeById(presetId);
        const name = `${baseTheme.name} Copy`;
        const res = await apiService.createTheme({
          name,
          basePreset: presetId,
          tokens: { ...baseTheme, id: '', name },
        });
        const newTheme = res.data;
        addTheme(newTheme);
        selectTheme(newTheme._id, newTheme.tokens);
        onStatusMessage('Theme created');
      } catch {
        onStatusMessage('Failed to create theme');
      } finally {
        setDuplicatingId(null);
      }
    },
    [addTheme, selectTheme, onStatusMessage],
  );

  const handleDuplicateCustom = useCallback(
    async (theme: CustomThemeDocument) => {
      setDuplicatingId(theme._id);
      try {
        const name = `${theme.name} Copy`;
        const res = await apiService.createTheme({
          name,
          basePreset: theme.basePreset,
          tokens: { ...theme.tokens, id: '', name },
        });
        const newTheme = res.data;
        addTheme(newTheme);
        selectTheme(newTheme._id, newTheme.tokens);
        onStatusMessage('Theme duplicated');
      } catch {
        onStatusMessage('Failed to duplicate theme');
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
            Presets
          </div>
          {PRESET_THEME_IDS.map((id) => {
            const theme = getPresetThemeById(id);
            const isSelected = currentThemeId === id;
            return (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#d0e8ff' : 'transparent',
                }}
                onClick={() => handleSelectPreset(id)}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    backgroundColor: theme.accent.primary,
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
                    handleDuplicate(id);
                  }}
                  disabled={duplicatingId === id}
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
            Custom ({themes.length})
          </div>
          {themes.length === 0 && (
            <div style={{ padding: '4px 8px', color: '#999', fontSize: 11 }}>
              No custom themes yet. Duplicate a preset to start.
            </div>
          )}
          {themes.map((theme) => {
            const isSelected =
              currentThemeId === theme._id;
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
                onClick={() => handleSelectCustom(theme)}
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
                    handleDuplicateCustom(theme);
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
