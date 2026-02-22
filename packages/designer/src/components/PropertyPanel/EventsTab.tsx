import { useState, useEffect } from 'react';

interface EventsTabProps {
  controlId: string;
  controlName: string;
  events: string[];
  eventHandlers: Record<string, string>;
  onHandlerNameChange: (eventName: string, handlerName: string) => void;
  onOpenEditor: (eventName: string, handlerName: string) => void;
}

export function EventsTab({
  controlId,
  controlName,
  events,
  eventHandlers,
  onHandlerNameChange,
  onOpenEditor,
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
        />
      ))}
      {events.length === 0 && (
        <div style={{ padding: 8, color: '#999', fontSize: 12, textAlign: 'center' }}>
          No events available
        </div>
      )}
    </div>
  );
}

interface EventRowProps {
  eventName: string;
  controlName: string;
  handlerName: string;
  onHandlerNameChange: (name: string) => void;
  onOpenEditor: (name: string) => void;
}

function EventRow({ eventName, controlName, handlerName, onHandlerNameChange, onOpenEditor }: EventRowProps) {
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
        title={eventName}
      >
        {eventName}
      </div>
      <div style={{ flex: 1, padding: '2px 4px 2px 0' }}>
        <input
          type="text"
          value={local}
          placeholder={defaultHandlerName}
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
    </div>
  );
}
