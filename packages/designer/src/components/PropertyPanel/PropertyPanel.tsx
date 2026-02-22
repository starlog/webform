import { useState, useMemo, useCallback } from 'react';
import type { ControlDefinition } from '@webform/common';
import { useDesignerStore } from '../../stores/designerStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useHistoryStore } from '../../stores/historyStore';
import { getPropertyMeta, getControlEvents } from './controlProperties';
import type { PropertyCategory as PropertyCategoryName, PropertyMeta } from './controlProperties';
import { PropertyCategory } from './PropertyCategory';
import { EventsTab } from './EventsTab';

type TabType = 'properties' | 'events';
type SortMode = 'category' | 'alphabetical';

interface PropertyPanelProps {
  onOpenEventEditor?: (controlId: string, eventName: string, handlerName: string) => void;
}

export function PropertyPanel({ onOpenEventEditor }: PropertyPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('properties');
  const [sortMode, setSortMode] = useState<SortMode>('category');

  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const controls = useDesignerStore((s) => s.controls);
  const updateControl = useDesignerStore((s) => s.updateControl);
  const pushSnapshot = useHistoryStore((s) => s.pushSnapshot);

  const selectedControl = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = [...selectedIds][0];
    return controls.find((c) => c.id === id) ?? null;
  }, [selectedIds, controls]);

  const propertyMetas = useMemo(() => {
    if (!selectedControl) return [];
    return getPropertyMeta(selectedControl.type);
  }, [selectedControl]);

  const events = useMemo(() => {
    if (!selectedControl) return [];
    return getControlEvents(selectedControl.type);
  }, [selectedControl]);

  const eventHandlers = useMemo(() => {
    if (!selectedControl) return {};
    const handlers: Record<string, string> = {};
    const props = selectedControl.properties;
    if (props._eventHandlers && typeof props._eventHandlers === 'object') {
      Object.assign(handlers, props._eventHandlers);
    }
    return handlers;
  }, [selectedControl]);

  // 중첩 속성 값 읽기: 'position.x', 'properties.text' 등
  const getValue = useCallback((name: string): unknown => {
    if (!selectedControl) return undefined;
    const parts = name.split('.');
    let current: unknown = selectedControl;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }, [selectedControl]);

  // 속성 변경 핸들러
  const handleValueChange = useCallback((name: string, value: unknown) => {
    if (!selectedControl) return;

    // 히스토리 스냅샷
    const allControls = useDesignerStore.getState().controls;
    pushSnapshot(JSON.stringify(allControls));

    const parts = name.split('.');

    if (parts[0] === 'position' && parts.length === 2) {
      const pos = { ...selectedControl.position, [parts[1]]: value };
      updateControl(selectedControl.id, { position: pos });
    } else if (parts[0] === 'size' && parts.length === 2) {
      const size = { ...selectedControl.size, [parts[1]]: value };
      updateControl(selectedControl.id, { size });
    } else if (parts[0] === 'properties' && parts.length === 2) {
      const props = { ...selectedControl.properties, [parts[1]]: value };
      updateControl(selectedControl.id, { properties: props });
    } else if (parts[0] === 'anchor') {
      updateControl(selectedControl.id, { anchor: value as ControlDefinition['anchor'] });
    } else if (parts[0] === 'dock') {
      updateControl(selectedControl.id, { dock: value as ControlDefinition['dock'] });
    } else {
      // 최상위 속성 (name, enabled, visible, tabIndex)
      updateControl(selectedControl.id, { [name]: value } as Partial<ControlDefinition>);
    }
  }, [selectedControl, updateControl, pushSnapshot]);

  // 이벤트 핸들러 이름 변경
  const handleEventHandlerChange = useCallback((eventName: string, handlerName: string) => {
    if (!selectedControl) return;
    const current = (selectedControl.properties._eventHandlers ?? {}) as Record<string, string>;
    const updated = { ...current };
    if (handlerName) {
      updated[eventName] = handlerName;
    } else {
      delete updated[eventName];
    }
    const props = { ...selectedControl.properties, _eventHandlers: updated };
    updateControl(selectedControl.id, { properties: props });
  }, [selectedControl, updateControl]);

  // 이벤트 핸들러 삭제
  const handleDeleteHandler = useCallback((eventName: string) => {
    if (!selectedControl) return;

    const allControls = useDesignerStore.getState().controls;
    pushSnapshot(JSON.stringify(allControls));

    const currentHandlers = (selectedControl.properties._eventHandlers ?? {}) as Record<string, string>;
    const currentCode = (selectedControl.properties._eventCode ?? {}) as Record<string, string>;
    const handlerName = currentHandlers[eventName];

    const updatedHandlers = { ...currentHandlers };
    delete updatedHandlers[eventName];

    const updatedCode = { ...currentCode };
    if (handlerName) delete updatedCode[handlerName];

    updateControl(selectedControl.id, {
      properties: {
        ...selectedControl.properties,
        _eventHandlers: updatedHandlers,
        _eventCode: updatedCode,
      },
    });
  }, [selectedControl, updateControl, pushSnapshot]);

  // 이벤트 에디터 열기
  const handleOpenEditor = useCallback((eventName: string, handlerName: string) => {
    if (!selectedControl || !onOpenEventEditor) return;
    onOpenEventEditor(selectedControl.id, eventName, handlerName);
  }, [selectedControl, onOpenEventEditor]);

  // 카테고리별 그룹화
  const groupedProperties = useMemo(() => {
    if (sortMode === 'alphabetical') {
      const sorted = [...propertyMetas].sort((a, b) => a.label.localeCompare(b.label));
      return [{ category: 'All', properties: sorted }];
    }

    const categoryOrder: PropertyCategoryName[] = ['Design', 'Appearance', 'Behavior', 'Data', 'Layout'];
    const groups = new Map<string, PropertyMeta[]>();

    for (const meta of propertyMetas) {
      const list = groups.get(meta.category) ?? [];
      list.push(meta);
      groups.set(meta.category, list);
    }

    return categoryOrder
      .filter((cat) => groups.has(cat))
      .map((cat) => ({ category: cat, properties: groups.get(cat)! }));
  }, [propertyMetas, sortMode]);

  // 선택 없는 경우
  if (selectedIds.size === 0) {
    return (
      <div style={{ padding: 8, fontSize: 12, color: '#666' }}>
        No control selected.
      </div>
    );
  }

  // 다중 선택
  if (selectedIds.size > 1) {
    return (
      <div style={{ padding: 8, fontSize: 12, color: '#666' }}>
        {selectedIds.size} controls selected.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 컨트롤 정보 헤더 */}
      <div style={{ padding: '4px 6px', borderBottom: '1px solid #ccc', fontSize: 12, fontWeight: 600 }}>
        {selectedControl?.name} ({selectedControl?.type})
      </div>

      {/* 탭 바 + 정렬 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #ccc' }}>
        <TabButton label="Properties" icon="\u2630" active={activeTab === 'properties'} onClick={() => setActiveTab('properties')} />
        <TabButton label="Events" icon="\u26A1" active={activeTab === 'events'} onClick={() => setActiveTab('events')} />
        <div style={{ flex: 1 }} />
        {activeTab === 'properties' && (
          <button
            type="button"
            onClick={() => setSortMode(sortMode === 'category' ? 'alphabetical' : 'category')}
            title={sortMode === 'category' ? 'Sort alphabetically' : 'Sort by category'}
            style={{
              padding: '2px 4px',
              margin: '0 4px',
              border: '1px solid #ccc',
              background: '#f5f5f5',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {sortMode === 'category' ? 'A-Z' : '\u2630'}
          </button>
        )}
      </div>

      {/* 탭 내용 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'properties' && (
          <div>
            {groupedProperties.map(({ category, properties }) => (
              <PropertyCategory
                key={category}
                category={category}
                properties={properties}
                getValue={getValue}
                onValueChange={handleValueChange}
              />
            ))}
          </div>
        )}
        {activeTab === 'events' && selectedControl && (
          <EventsTab
            controlId={selectedControl.id}
            controlName={selectedControl.name}
            events={events}
            eventHandlers={eventHandlers}
            onHandlerNameChange={handleEventHandlerChange}
            onOpenEditor={handleOpenEditor}
            onDeleteHandler={handleDeleteHandler}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 8px',
        border: 'none',
        borderBottom: active ? '2px solid #0078d4' : '2px solid transparent',
        background: 'transparent',
        fontSize: 12,
        cursor: 'pointer',
        color: active ? '#0078d4' : '#666',
        fontWeight: active ? 600 : 400,
      }}
    >
      {icon} {label}
    </button>
  );
}
