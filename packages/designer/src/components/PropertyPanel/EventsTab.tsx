import { useState, useEffect } from 'react';

/**
 * 이벤트 설명 — 이벤트가 언제 발생하는지 설명합니다.
 * 핸들러 스크립트는 handlerType에 따라 서버(SandboxRunner) 또는 클라이언트(브라우저)에서 실행됩니다.
 */
const EVENT_DESCRIPTIONS: Record<string, string> = {
  // Common Events (모든 컨트롤)
  Click: '사용자가 컨트롤을 클릭했을 때 발생합니다',
  DoubleClick: '사용자가 컨트롤을 더블클릭했을 때 발생합니다',
  MouseEnter: '마우스 포인터가 컨트롤 영역에 진입했을 때 발생합니다',
  MouseLeave: '마우스 포인터가 컨트롤 영역을 벗어났을 때 발생합니다',
  MouseDown: '컨트롤 위에서 마우스 버튼을 눌렀을 때 발생합니다',
  MouseUp: '컨트롤 위에서 마우스 버튼을 놓았을 때 발생합니다',
  MouseMove: '컨트롤 위에서 마우스를 움직일 때 발생합니다',
  KeyDown: '컨트롤에 포커스가 있을 때 키를 눌렀을 때 발생합니다',
  KeyUp: '컨트롤에 포커스가 있을 때 키를 놓았을 때 발생합니다',
  KeyPress: '컨트롤에 포커스가 있을 때 문자 키를 입력했을 때 발생합니다',
  Enter: '컨트롤이 포커스를 받았을 때 발생합니다',
  Leave: '컨트롤이 포커스를 잃었을 때 발생합니다',
  Validating: '컨트롤 값의 유효성 검사가 필요할 때 발생합니다',
  Validated: '컨트롤 값의 유효성 검사가 완료된 후 발생합니다',
  VisibleChanged: '컨트롤의 표시/숨김 상태가 변경되었을 때 발생합니다',
  EnabledChanged: '컨트롤의 활성화/비활성화 상태가 변경되었을 때 발생합니다',

  // Control-specific Events
  TextChanged: '텍스트 내용이 변경되었을 때 발생합니다',
  SelectedIndexChanged: '선택된 항목의 인덱스가 변경되었을 때 발생합니다',
  DropDown: '드롭다운 목록이 열렸을 때 발생합니다',
  DropDownClosed: '드롭다운 목록이 닫혔을 때 발생합니다',
  CheckedChanged: '체크 상태가 변경되었을 때 발생합니다',
  CellClick: '그리드 셀을 클릭했을 때 발생합니다',
  CellValueChanged: '그리드 셀 값이 변경되었을 때 발생합니다',
  RowEnter: '그리드에서 새로운 행으로 이동했을 때 발생합니다',
  SelectionChanged: '선택 영역이 변경되었을 때 발생합니다',
  ValueChanged: '값이 변경되었을 때 발생합니다',
  AfterSelect: '트리뷰에서 노드를 선택한 후 발생합니다',
  AfterExpand: '트리뷰에서 노드를 확장한 후 발생합니다',
  AfterCollapse: '트리뷰에서 노드를 축소한 후 발생합니다',
  ItemActivate: '리스트뷰 항목을 활성화(더블클릭)했을 때 발생합니다',
  CellChanged: '스프레드시트 셀 값이 변경되었을 때 발생합니다',
  RowAdded: '스프레드시트에 행이 추가되었을 때 발생합니다',
  RowDeleted: '스프레드시트에서 행이 삭제되었을 때 발생합니다',
  DataLoaded: '데이터 로드가 완료되었을 때 발생합니다',
  ItemClicked: '메뉴/도구모음 항목을 클릭했을 때 발생합니다',
  Navigated: '웹브라우저가 새 URL로 이동했을 때 발생합니다',
  DocumentCompleted: '웹브라우저의 문서 로딩이 완료되었을 때 발생합니다',
  SeriesClicked: '차트의 데이터 시리즈를 클릭했을 때 발생합니다',
  SplitterMoved: '분할 컨테이너의 구분선 위치가 변경되었을 때 발생합니다',
  PositionChanged: '바인딩 네비게이터의 현재 위치가 변경되었을 때 발생합니다',
  Connected: '데이터 소스 연결이 완료되었을 때 발생합니다',
  Error: '오류가 발생했을 때 발생합니다',
  QueryCompleted: '쿼리 실행이 완료되었을 때 발생합니다',
  RequestCompleted: 'API 요청이 완료되었을 때 발생합니다',
  DocumentInserted: 'MongoDB에 문서가 삽입되었을 때 발생합니다',
  DocumentUpdated: 'MongoDB 문서가 업데이트되었을 때 발생합니다',
  DocumentDeleted: 'MongoDB 문서가 삭제되었을 때 발생합니다',
  FileSelected: '파일이 선택되었을 때 발생합니다',
  UploadCompleted: '파일 업로드가 완료되었을 때 발생합니다',
  UploadFailed: '파일 업로드가 실패했을 때 발생합니다',
  Closed: '알림이 닫혔을 때 발생합니다',
  TagAdded: '태그가 추가되었을 때 발생합니다',
  TagRemoved: '태그가 제거되었을 때 발생합니다',
  TagClicked: '태그를 클릭했을 때 발생합니다',
  ActiveKeyChanged: '아코디언의 활성 패널이 변경되었을 때 발생합니다',

  // Form Events
  Load: '폼이 처음 로드될 때 발생합니다. 초기 데이터 로딩에 사용합니다',
  Shown: '폼이 화면에 표시된 직후 발생합니다',
  FormClosing: '폼이 닫히기 직전에 발생합니다. 닫기를 취소할 수 있습니다',
  FormClosed: '폼이 완전히 닫힌 후 발생합니다',
  Resize: '폼 크기가 변경되었을 때 발생합니다',
  OnLoading: '폼이 로딩 중일 때 발생합니다',
  BeforeLeaving: '다른 폼으로 이동하기 직전에 발생합니다. 정리 작업에 사용합니다',

  // Shell Events
  FormChanged: 'Shell에서 활성 폼이 변경된 후 발생합니다',
  BeforeFormChange: 'Shell에서 폼이 변경되기 직전에 발생합니다. 변경을 취소할 수 있습니다',
};

function getEventDescription(eventName: string): string {
  return EVENT_DESCRIPTIONS[eventName] ?? `${eventName} 이벤트가 발생했을 때 실행됩니다`;
}

interface EventsTabProps {
  controlId: string;
  controlName: string;
  events: string[];
  eventHandlers: Record<string, string>;
  onHandlerNameChange: (eventName: string, handlerName: string) => void;
  onOpenEditor: (eventName: string, handlerName: string) => void;
  onDeleteHandler: (eventName: string) => void;
}

export function EventsTab({
  controlId,
  controlName,
  events,
  eventHandlers,
  onHandlerNameChange,
  onOpenEditor,
  onDeleteHandler,
}: EventsTabProps) {
  return (
    <div>
      {events.map((eventName) => (
        <EventRow
          key={`${controlId}-${eventName}`}
          eventName={eventName}
          controlName={controlName}
          handlerName={eventHandlers[eventName] ?? ''}
          onHandlerNameChange={(name) => onHandlerNameChange(eventName, name)}
          onOpenEditor={(name) => onOpenEditor(eventName, name)}
          onDelete={() => onDeleteHandler(eventName)}
        />
      ))}
      {events.length === 0 && (
        <div style={{ padding: 8, color: '#999', fontSize: 12, textAlign: 'center' }}>
          No events available
        </div>
      )}
      <div
        style={{
          padding: '6px 8px',
          fontSize: 11,
          color: '#888',
          borderTop: '1px solid #e0e0e0',
          lineHeight: 1.5,
        }}
      >
        모든 이벤트 스크립트는 서버의 V8 격리(Isolated) 환경에서 실행됩니다.
      </div>
    </div>
  );
}

interface EventRowProps {
  eventName: string;
  controlName: string;
  handlerName: string;
  onHandlerNameChange: (name: string) => void;
  onOpenEditor: (name: string) => void;
  onDelete: () => void;
}

function EventRow({ eventName, controlName, handlerName, onHandlerNameChange, onOpenEditor, onDelete }: EventRowProps) {
  const [local, setLocal] = useState(handlerName);

  useEffect(() => {
    setLocal(handlerName);
  }, [handlerName]);

  const defaultHandlerName = `${controlName}_${eventName}`;

  const commit = () => {
    if (local !== handlerName) {
      onHandlerNameChange(local);
    }
  };

  const handleDoubleClick = () => {
    const name = local || defaultHandlerName;
    if (!local) {
      setLocal(name);
      onHandlerNameChange(name);
    }
    onOpenEditor(name);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid #f0f0f0',
        fontSize: 12,
      }}
      onDoubleClick={handleDoubleClick}
    >
      <div
        style={{
          width: 90,
          minWidth: 90,
          padding: '3px 4px',
          color: '#333',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={getEventDescription(eventName)}
      >
        {eventName}
      </div>
      <div style={{ flex: 1, padding: '2px 4px 2px 0' }}>
        <input
          type="text"
          value={local}
          placeholder={defaultHandlerName}
          title={getEventDescription(eventName)}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit();
              if (local || !handlerName) {
                const name = local || defaultHandlerName;
                if (!local) {
                  setLocal(name);
                  onHandlerNameChange(name);
                }
                onOpenEditor(name);
              }
            }
          }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '1px 2px',
            border: '1px solid #ccc',
            fontSize: 12,
            fontFamily: 'Segoe UI, sans-serif',
          }}
        />
      </div>
      {handlerName && (
        <button
          type="button"
          title="이벤트 핸들러 삭제"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            setLocal('');
          }}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: '#999',
            fontSize: 14,
            padding: '0 4px',
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#d32f2f'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#999'; }}
        >
          ×
        </button>
      )}
    </div>
  );
}
