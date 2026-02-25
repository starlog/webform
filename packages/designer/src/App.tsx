import { useState, useCallback, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DesignerCanvas } from './components/Canvas';
import { ShellCanvas } from './components/Canvas/ShellCanvas';
import { Toolbox } from './components/Toolbox';
import { PropertyPanel } from './components/PropertyPanel';
import { EventEditor } from './components/EventEditor/EventEditor';
import { ProjectExplorer } from './components/ProjectExplorer';
import { ElementList } from './components/ElementList';
import { ThemeEditor } from './components/ThemeEditor/ThemeEditor';
import { apiService, useAutoSave } from './services/apiService';
import { useDesignerStore } from './stores/designerStore';
import { useHistoryStore, createSnapshot, restoreSnapshot } from './stores/historyStore';

interface EventEditorState {
  controlId: string;
  eventName: string;
  handlerName: string;
}

export function App() {
  const [eventEditor, setEventEditor] = useState<EventEditorState | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const { save, forceSave } = useAutoSave();
  const isDirty = useDesignerStore((s) => s.isDirty);
  const formTitle = useDesignerStore((s) => s.formProperties.title);
  const currentFormId = useDesignerStore((s) => s.currentFormId);
  const currentProjectId = useDesignerStore((s) => s.currentProjectId);
  const editMode = useDesignerStore((s) => s.editMode);
  const shellTitle = useDesignerStore((s) => s.shellProperties.title);
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('draft');
  const [explorerRefreshKey, setExplorerRefreshKey] = useState(0);
  const [pendingFormId, setPendingFormId] = useState<string | null>(null);

  const handleOpenEventEditor = useCallback((controlId: string, eventName: string, handlerName: string) => {
    setEventEditor({ controlId, eventName, handlerName });
  }, []);

  const showStatus = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleSave = useCallback(async () => {
    try {
      if (editMode === 'shell') {
        const state = useDesignerStore.getState();
        if (!state.currentProjectId) return;
        const shellDef = state.getShellDefinition();
        await apiService.updateShell(state.currentProjectId, {
          name: shellDef.name,
          properties: shellDef.properties,
          controls: shellDef.controls,
          eventHandlers: shellDef.eventHandlers,
        });
        state.markClean();
        showStatus('Saved');
        return;
      }
      await save();
      showStatus('Saved');
    } catch {
      showStatus('Save failed');
    }
  }, [save, editMode]);

  const handlePublish = useCallback(async () => {
    if (editMode === 'shell') {
      const state = useDesignerStore.getState();
      if (!state.currentProjectId) return;
      try {
        const shellDef = state.getShellDefinition();
        await apiService.updateShell(state.currentProjectId, {
          name: shellDef.name,
          properties: shellDef.properties,
          controls: shellDef.controls,
          eventHandlers: shellDef.eventHandlers,
        });
        state.markClean();
        await apiService.publishShell(state.currentProjectId);
        showStatus('Published');
      } catch {
        showStatus('Publish failed');
      }
      return;
    }

    if (!currentFormId) return;
    try {
      await save();
      const { data } = await apiService.publishForm(currentFormId);
      setFormStatus(data.status);
      setExplorerRefreshKey((k) => k + 1);
      showStatus('Published');
    } catch {
      showStatus('Publish failed');
    }
  }, [currentFormId, save, editMode]);

  const runtimeUrl = currentFormId
    ? `${window.location.origin.replace(':3000', ':3001')}/?formId=${currentFormId}`
    : null;

  const appRuntimeUrl = currentProjectId && currentFormId
    ? `${window.location.origin.replace(':3000', ':3001')}/?projectId=${currentProjectId}&formId=${currentFormId}`
    : null;

  // Ctrl+S / Ctrl+Z / Ctrl+Y 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;

      if (e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      // Ctrl+Z/Y: 텍스트 입력 중에는 브라우저 기본 동작 유지
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 'z') {
        e.preventDefault();
        const current = createSnapshot();
        const snapshot = useHistoryStore.getState().undo(current);
        if (snapshot) restoreSnapshot(snapshot);
      } else if (e.key === 'y') {
        e.preventDefault();
        const current = createSnapshot();
        const snapshot = useHistoryStore.getState().redo(current);
        if (snapshot) restoreSnapshot(snapshot);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handlePublishAll = useCallback((projectId: string) => {
    if (currentProjectId === projectId && currentFormId) {
      setFormStatus('published');
    }
    setExplorerRefreshKey((k) => k + 1);
  }, [currentProjectId, currentFormId]);

  const loadForm = async (formId: string) => {
    try {
      const { data } = await apiService.loadForm(formId);
      const store = useDesignerStore.getState();
      store.setEditMode('form');
      store.loadForm(formId, data.controls, data.properties, data.eventHandlers);

      // 프로젝트 정보 설정 (기본 폰트 포함)
      if (data.projectId) {
        store.setCurrentProject(data.projectId);
        try {
          const { data: projectDetail } = await apiService.getProject(data.projectId);
          store.setProjectDefaultFont(projectDetail.project.defaultFont ?? null);
        } catch {
          store.setProjectDefaultFont(null);
        }
      }

      setFormStatus(data.status);
    } catch (error) {
      console.error('Failed to load form:', error);
    }
  };

  const handleFormSelect = async (formId: string) => {
    if (isDirty) {
      setPendingFormId(formId);
      return;
    }
    await loadForm(formId);
  };

  const handleSaveAndSwitch = async () => {
    const formId = pendingFormId;
    setPendingFormId(null);
    if (!formId) return;
    try { await handleSave(); } catch { /* ignore */ }
    await loadForm(formId);
  };

  const handleDiscardAndSwitch = async () => {
    const formId = pendingFormId;
    setPendingFormId(null);
    if (!formId) return;
    await loadForm(formId);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      {/* 메뉴바 */}
      <div
        className="menubar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 32,
          padding: '0 12px',
          backgroundColor: '#f0f0f0',
          borderBottom: '1px solid #ccc',
          fontSize: 12,
          fontFamily: 'Segoe UI, sans-serif',
        }}
      >
        <span style={{ fontWeight: 600 }}>
          {editMode === 'theme'
            ? 'Theme Editor'
            : editMode === 'shell'
              ? `${shellTitle} (Shell)${isDirty ? ' *' : ''}`
              : currentFormId
                ? `${formTitle}${isDirty ? ' *' : ''}`
                : 'WebForm Designer'}
        </span>

        <span style={{ color: '#aaa' }}>|</span>
        <button
          type="button"
          onClick={() => {
            const store = useDesignerStore.getState();
            store.setEditMode(editMode === 'theme' ? 'form' : 'theme');
          }}
          style={{
            ...menuBtnStyle,
            backgroundColor: editMode === 'theme' ? '#0078d4' : '#fff',
            color: editMode === 'theme' ? '#fff' : undefined,
            borderColor: editMode === 'theme' ? '#0078d4' : '#bbb',
          }}
        >
          {editMode === 'theme' ? 'WebForms' : 'Themes'}
        </button>

        {(currentFormId || editMode === 'shell') && editMode !== 'theme' && (
          <>
            <span style={{ color: '#aaa' }}>|</span>

            <button type="button" onClick={handleSave} disabled={!isDirty} style={menuBtnStyle}>
              Save
            </button>
            <button type="button" onClick={handlePublish} style={menuBtnStyle}>
              Publish
            </button>

            {editMode === 'form' && currentFormId && (
              <>
                <span style={{ color: '#aaa' }}>|</span>

                <span style={{
                  fontSize: 11,
                  color: formStatus === 'published' ? '#2e7d32' : '#888',
                  fontWeight: 500,
                }}>
                  {formStatus === 'published' ? 'Published' : 'Draft'}
                </span>

                {formStatus === 'published' && runtimeUrl && (
                  <>
                    <span style={{ color: '#aaa' }}>|</span>
                    <a
                      href={runtimeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: '#0078d4', textDecoration: 'none' }}
                      title={runtimeUrl}
                    >
                      Open Runtime
                    </a>
                    {appRuntimeUrl && (
                      <a
                        href={appRuntimeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: '#0078d4', textDecoration: 'none' }}
                        title={appRuntimeUrl}
                      >
                        Open With Application
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(runtimeUrl); showStatus('URL copied'); }}
                      style={{ ...menuBtnStyle, fontSize: 11, padding: '1px 4px' }}
                      title="Copy runtime URL"
                    >
                      Copy URL
                    </button>
                  </>
                )}
              </>
            )}

            {saveStatus && (
              <>
                <span style={{ color: '#aaa' }}>|</span>
                <span style={{ fontSize: 11, color: '#2e7d32', fontWeight: 500 }}>{saveStatus}</span>
              </>
            )}
          </>
        )}
      </div>

      <div
        className="designer-layout"
        style={{
          display: 'flex',
          height: 'calc(100vh - 32px)',
          fontFamily: 'Segoe UI, sans-serif',
        }}
      >
        {editMode === 'theme' ? (
          /* Theme Editor 전체 화면 */
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ThemeEditor />
          </div>
        ) : (
          <>
            {/* 좌측 패널: ProjectExplorer + Toolbox */}
            <div
              className="left-panel"
              style={{
                width: 220,
                borderRight: '1px solid #ccc',
                backgroundColor: '#f5f5f5',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div style={{ flex: '0 0 auto', maxHeight: '30%', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderBottom: '1px solid #ccc' }}>
                <ProjectExplorer onFormSelect={handleFormSelect} onPublishAll={handlePublishAll} refreshKey={explorerRefreshKey} />
              </div>
              <div style={{ flex: '0 0 auto', maxHeight: '35%', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderBottom: '1px solid #ccc' }}>
                <ElementList />
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <Toolbox />
              </div>
            </div>

            {/* 캔버스 영역 */}
            <div
              className="canvas-area"
              style={{
                flex: 1,
                overflow: 'auto',
                padding: 16,
                backgroundColor: '#E0E0E0',
              }}
            >
              {editMode === 'shell' ? <ShellCanvas /> : <DesignerCanvas />}
            </div>

            {/* 속성 패널 */}
            <div
              className="properties-panel"
              style={{
                width: 308,
                borderLeft: '1px solid #ccc',
                backgroundColor: '#f5f5f5',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <PropertyPanel onOpenEventEditor={handleOpenEventEditor} />
            </div>
          </>
        )}
      </div>

      {/* 이벤트 에디터 모달 */}
      {eventEditor && (
        <EventEditor
          controlId={eventEditor.controlId}
          eventName={eventEditor.eventName}
          handlerName={eventEditor.handlerName}
          onClose={() => setEventEditor(null)}
          onSaveToServer={forceSave}
        />
      )}

      {/* 저장 확인 다이얼로그 */}
      {pendingFormId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 6,
              padding: '24px 32px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              minWidth: 320,
              fontFamily: 'Segoe UI, sans-serif',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
              현재 폼을 저장하시겠습니까?
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={handleDiscardAndSwitch}
                style={{ ...menuBtnStyle, minWidth: 72 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAndSwitch}
                style={{ ...menuBtnStyle, minWidth: 72, backgroundColor: '#0078d4', color: '#fff', borderColor: '#0078d4' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </DndProvider>
  );
}

const menuBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  border: '1px solid #bbb',
  borderRadius: 2,
  backgroundColor: '#fff',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'Segoe UI, sans-serif',
};
