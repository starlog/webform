import { useState, useCallback, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DesignerCanvas } from './components/Canvas';
import { Toolbox } from './components/Toolbox';
import { PropertyPanel } from './components/PropertyPanel';
import { EventEditor } from './components/EventEditor/EventEditor';
import { ProjectExplorer } from './components/ProjectExplorer';
import { ElementList } from './components/ElementList';
import { apiService, useAutoSave } from './services/apiService';
import { useDesignerStore } from './stores/designerStore';

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
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('draft');
  const [explorerRefreshKey, setExplorerRefreshKey] = useState(0);

  const handleOpenEventEditor = useCallback((controlId: string, eventName: string, handlerName: string) => {
    setEventEditor({ controlId, eventName, handlerName });
  }, []);

  const showStatus = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleSave = useCallback(async () => {
    try {
      await save();
      showStatus('Saved');
    } catch {
      showStatus('Save failed');
    }
  }, [save]);

  const handlePublish = useCallback(async () => {
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
  }, [currentFormId, save]);

  const runtimeUrl = currentFormId
    ? `${window.location.origin.replace(':3000', ':3001')}/?formId=${currentFormId}`
    : null;

  // Ctrl+S 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleFormSelect = async (formId: string) => {
    try {
      const { data } = await apiService.loadForm(formId);
      const store = useDesignerStore.getState();
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
          {currentFormId ? `${formTitle}${isDirty ? ' *' : ''}` : 'WebForm Designer'}
        </span>

        {currentFormId && (
          <>
            <span style={{ color: '#aaa' }}>|</span>

            <button type="button" onClick={handleSave} disabled={!isDirty} style={menuBtnStyle}>
              Save
            </button>
            <button type="button" onClick={handlePublish} style={menuBtnStyle}>
              Publish
            </button>

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
            <ProjectExplorer onFormSelect={handleFormSelect} refreshKey={explorerRefreshKey} />
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
          <DesignerCanvas />
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
