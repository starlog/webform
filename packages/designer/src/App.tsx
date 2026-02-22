import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DesignerCanvas } from './components/Canvas';
import { Toolbox } from './components/Toolbox';

export function App() {
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

        {/* 속성 패널 — 후속 태스크(properties-panel)에서 구현 */}
        <div
          className="properties-panel"
          style={{
            width: 250,
            borderLeft: '1px solid #ccc',
            backgroundColor: '#f5f5f5',
            padding: 8,
            overflow: 'auto',
          }}
        >
          Properties
        </div>
      </div>
    </DndProvider>
  );
}
