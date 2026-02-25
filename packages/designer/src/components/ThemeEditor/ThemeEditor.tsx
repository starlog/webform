import { useEffect, useState, useCallback } from 'react';
import { isPresetTheme } from '@webform/common';
import { apiService } from '../../services/apiService';
import { useThemeEditorStore } from '../../stores/themeEditorStore';
import { ThemeList } from './ThemeList';
import { TokenEditor } from './TokenEditor';
import { ThemePreview } from './ThemePreview';

export function ThemeEditor() {
  const setThemes = useThemeEditorStore((s) => s.setThemes);
  const setLoading = useThemeEditorStore((s) => s.setLoading);
  const loading = useThemeEditorStore((s) => s.loading);
  const currentThemeId = useThemeEditorStore((s) => s.currentThemeId);
  const currentTheme = useThemeEditorStore((s) => s.currentTheme);
  const isDirty = useThemeEditorStore((s) => s.isDirty);
  const markClean = useThemeEditorStore((s) => s.markClean);
  const updateThemeInList = useThemeEditorStore((s) => s.updateThemeInList);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const showStatus = useCallback((msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  }, []);

  // 초기 테마 목록 로드
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiService
      .listThemes()
      .then((res) => {
        if (!cancelled) setThemes(res.data);
      })
      .catch(() => {
        if (!cancelled) showStatus('Failed to load themes');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setThemes, setLoading, showStatus]);

  const handleSave = useCallback(async () => {
    if (!currentThemeId || !currentTheme || isPresetTheme(currentThemeId)) return;
    try {
      const res = await apiService.updateTheme(currentThemeId, {
        name: currentTheme.name,
        tokens: currentTheme,
      });
      updateThemeInList(res.data);
      markClean();
      showStatus('Saved');
    } catch {
      showStatus('Save failed');
    }
  }, [currentThemeId, currentTheme, markClean, updateThemeInList, showStatus]);

  const isEditable = currentThemeId ? !isPresetTheme(currentThemeId) : false;

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'Segoe UI, sans-serif' }}>
      {/* Left: Theme List */}
      <div
        style={{
          width: 220,
          borderRight: '1px solid #ccc',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 12, color: '#999', fontSize: 12 }}>Loading...</div>
        ) : (
          <ThemeList onStatusMessage={showStatus} />
        )}
      </div>

      {/* Center: Token Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 8px',
            borderBottom: '1px solid #ccc',
            backgroundColor: '#f0f0f0',
            fontSize: 12,
          }}
        >
          <span style={{ fontWeight: 600 }}>Token Editor</span>
          <div style={{ flex: 1 }} />
          {statusMsg && (
            <span style={{ fontSize: 11, color: '#2e7d32', fontWeight: 500 }}>
              {statusMsg}
            </span>
          )}
          {isEditable && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty}
              style={{
                padding: '2px 12px',
                border: '1px solid #bbb',
                borderRadius: 2,
                background: isDirty ? '#0078d4' : '#e0e0e0',
                color: isDirty ? '#fff' : '#999',
                fontSize: 12,
                cursor: isDirty ? 'pointer' : 'default',
              }}
            >
              Save
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <TokenEditor />
        </div>
      </div>

      {/* Right: Preview */}
      <div
        style={{
          width: 320,
          borderLeft: '1px solid #ccc',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <ThemePreview />
      </div>
    </div>
  );
}
