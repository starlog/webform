import { useState, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DesignerCanvas } from './components/Canvas';
import { Toolbox } from './components/Toolbox';
import { PropertyPanel } from './components/PropertyPanel';
import { EventEditor } from './components/EventEditor/EventEditor';

interface EventEditorState {
  controlId: string;
  eventName: string;
  handlerName: string;
}

export function App() {
  const [eventEditor, setEventEditor] = useState<EventEditorState | null>(null);

  const handleOpenEventEditor = useCallback((controlId: string, eventName: string, handlerName: string) => {
    setEventEditor({ controlId, eventName, handlerName });
  }, []);

  return (
    <DndProvider backend={HTML5Backend}>
      <div
        className="designer-layout"
        style={{
          display: 'flex',
          height: '100vh',
          fontFamily: 'Segoe UI, sans-serif',
        }}
      >
        {/* 도구상자 */}
        <div
          className="toolbox-panel"
          style={{
            width: 200,
            borderRight: '1px solid #ccc',
            backgroundColor: '#f5f5f5',
            overflow: 'auto',
          }}
        >
          <Toolbox />
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
