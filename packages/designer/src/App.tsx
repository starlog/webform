import { useState, useCallback, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DesignerCanvas } from './components/Canvas';
import { Toolbox } from './components/Toolbox';
import { PropertyPanel } from './components/PropertyPanel';
import { EventEditor } from './components/EventEditor/EventEditor';
import { ProjectExplorer } from './components/ProjectExplorer';
import { apiService, useAutoSave } from './services/apiService';
import { useDesignerStore } from './stores/designerStore';

interface EventEditorState {
  controlId: string;
  eventName: string;
  handlerName: string;
}

export function App() {
  const [eventEditor, setEventEditor] = useState<EventEditorState | null>(null);
  const { save } = useAutoSave();
  const isDirty = useDesignerStore((s) => s.isDirty);
  const formTitle = useDesignerStore((s) => s.formProperties.title);
  const currentFormId = useDesignerStore((s) => s.currentFormId);

  const handleOpenEventEditor = useCallback((controlId: string, eventName: string, handlerName: string) => {
    setEventEditor({ controlId, eventName, handlerName });
  }, []);

  // Ctrl+S 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  const handleFormSelect = async (formId: string) => {
    try {
      const { data } = await apiService.loadForm(formId);
      useDesignerStore.getState().loadForm(
        formId,
        data.controls,
        data.properties,
      );
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
          height: 28,
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
      </div>

      <div
        className="designer-layout"
        style={{
          display: 'flex',
          height: 'calc(100vh - 28px)',
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
          <div style={{ flex: '0 0 auto', maxHeight: '40%', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderBottom: '1px solid #ccc' }}>
            <ProjectExplorer onFormSelect={handleFormSelect} />
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
            width: 280,
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
        />
      )}
    </DndProvider>
  );
}
