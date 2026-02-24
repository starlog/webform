import { useState, useMemo, useCallback, useRef } from 'react';
import type { ControlDefinition, FormProperties, ShellProperties } from '@webform/common';
import { FORM_EVENTS } from '@webform/common';
import { useDesignerStore } from '../../stores/designerStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useHistoryStore } from '../../stores/historyStore';
import { getPropertyMeta, getControlEvents, SHELL_PROPERTIES } from './controlProperties';
import type { PropertyCategory as PropertyCategoryName, PropertyMeta } from './controlProperties';
import { PropertyCategory } from './PropertyCategory';
import { EventsTab } from './EventsTab';

// 폼 속성 메타데이터
const FORM_PROPERTY_METAS: PropertyMeta[] = [
  { name: 'width',           label: 'Width',           category: 'Layout',     editorType: 'number', min: 200 },
  { name: 'height',          label: 'Height',          category: 'Layout',     editorType: 'number', min: 150 },
  { name: 'title',           label: 'Title',           category: 'Appearance', editorType: 'text' },
  { name: 'backgroundColor', label: 'BackColor',       category: 'Appearance', editorType: 'color' },
  { name: 'font',            label: 'Font',            category: 'Appearance', editorType: 'font' },
  { name: 'formBorderStyle', label: 'FormBorderStyle', category: 'Behavior',   editorType: 'dropdown', options: ['None', 'FixedSingle', 'Fixed3D', 'Sizable'] },
  { name: 'startPosition',   label: 'StartPosition',   category: 'Behavior',   editorType: 'dropdown', options: ['CenterScreen', 'Manual', 'CenterParent'] },
  { name: 'maximizeBox',     label: 'MaximizeBox',     category: 'Behavior',   editorType: 'boolean' },
  { name: 'minimizeBox',     label: 'MinimizeBox',     category: 'Behavior',   editorType: 'boolean' },
  { name: 'windowState',     label: 'WindowState',     category: 'Layout',     editorType: 'dropdown', options: ['Normal', 'Maximized'] },
];

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
  const formProperties = useDesignerStore((s) => s.formProperties);
  const setFormProperties = useDesignerStore((s) => s.setFormProperties);
  const pushSnapshot = useHistoryStore((s) => s.pushSnapshot);

  const currentFormId = useDesignerStore((s) => s.currentFormId);

  // Shell 상태
  const editMode = useDesignerStore((s) => s.editMode);
  const shellProperties = useDesignerStore((s) => s.shellProperties);
  const setShellProperties = useDesignerStore((s) => s.setShellProperties);
  const shellControls = useDesignerStore((s) => s.shellControls);
  const updateShellControl = useDesignerStore((s) => s.updateShellControl);

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

    const categoryOrder: PropertyCategoryName[] = ['Design', 'Appearance', 'Behavior', 'Data', 'Sample', 'Layout'];
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

  // --- 폼 속성 getValue / handleValueChange ---
  const getFormValue = useCallback((name: string): unknown => {
    return (formProperties as unknown as Record<string, unknown>)[name];
  }, [formProperties]);

  const handleFormValueChange = useCallback((name: string, value: unknown) => {
    setFormProperties({ [name]: value } as Partial<FormProperties>);
  }, [setFormProperties]);

  const formGroupedProperties = useMemo(() => {
    const categoryOrder: PropertyCategoryName[] = ['Layout', 'Appearance', 'Behavior'];
    const groups = new Map<string, PropertyMeta[]>();
    for (const meta of FORM_PROPERTY_METAS) {
      const list = groups.get(meta.category) ?? [];
      list.push(meta);
      groups.set(meta.category, list);
    }
    return categoryOrder
      .filter((cat) => groups.has(cat))
      .map((cat) => ({ category: cat, properties: groups.get(cat)! }));
  }, []);

  // 폼 이벤트 관련 store
  const formEventHandlers = useDesignerStore((s) => s.formEventHandlers);
  const setFormEventHandler = useDesignerStore((s) => s.setFormEventHandler);
  const deleteFormEventHandler = useDesignerStore((s) => s.deleteFormEventHandler);

  const formEvents = useMemo(() => [...FORM_EVENTS], []);

  const handleFormEventHandlerChange = useCallback((eventName: string, handlerName: string) => {
    setFormEventHandler(eventName, handlerName);
  }, [setFormEventHandler]);

  const handleFormDeleteHandler = useCallback((eventName: string) => {
    deleteFormEventHandler(eventName);
  }, [deleteFormEventHandler]);

  const handleFormOpenEditor = useCallback((eventName: string, handlerName: string) => {
    if (!onOpenEventEditor || !currentFormId) return;
    onOpenEventEditor('__form__', eventName, handlerName);
  }, [onOpenEventEditor, currentFormId]);

  // Shell 컨트롤 선택 해결
  const selectedShellControl = useMemo(() => {
    if (editMode !== 'shell' || selectedIds.size !== 1) return null;
    const id = [...selectedIds][0];
    return shellControls.find((c) => c.id === id) ?? null;
  }, [editMode, selectedIds, shellControls]);

  // Shell 속성 getValue/handleValueChange
  const getShellValue = useCallback(
    (name: string): unknown => {
      return (shellProperties as unknown as Record<string, unknown>)[name];
    },
    [shellProperties],
  );

  const handleShellValueChange = useCallback(
    (name: string, value: unknown) => {
      setShellProperties({ [name]: value } as Partial<ShellProperties>);
    },
    [setShellProperties],
  );

  // Shell 속성 그룹화
  const shellGroupedProperties = useMemo(() => {
    const categoryOrder: PropertyCategoryName[] = ['Layout', 'Appearance', 'Behavior'];
    const groups = new Map<string, PropertyMeta[]>();
    for (const meta of SHELL_PROPERTIES) {
      const list = groups.get(meta.category) ?? [];
      list.push(meta);
      groups.set(meta.category, list);
    }
    return categoryOrder
      .filter((cat) => groups.has(cat))
      .map((cat) => ({ category: cat, properties: groups.get(cat)! }));
  }, []);

  // Shell 컨트롤 속성 getValue/handleValueChange
  const getShellControlValue = useCallback(
    (name: string): unknown => {
      if (!selectedShellControl) return undefined;
      const parts = name.split('.');
      let current: unknown = selectedShellControl;
      for (const part of parts) {
        if (current == null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
      }
      return current;
    },
    [selectedShellControl],
  );

  const handleShellControlValueChange = useCallback(
    (name: string, value: unknown) => {
      if (!selectedShellControl) return;
      const parts = name.split('.');

      if (parts[0] === 'position' && parts.length === 2) {
        const pos = { ...selectedShellControl.position, [parts[1]]: value };
        updateShellControl(selectedShellControl.id, { position: pos });
      } else if (parts[0] === 'size' && parts.length === 2) {
        const size = { ...selectedShellControl.size, [parts[1]]: value };
        updateShellControl(selectedShellControl.id, { size });
      } else if (parts[0] === 'properties' && parts.length === 2) {
        const props = { ...selectedShellControl.properties, [parts[1]]: value };
        updateShellControl(selectedShellControl.id, { properties: props });
      } else if (parts[0] === 'anchor') {
        updateShellControl(selectedShellControl.id, {
          anchor: value as ControlDefinition['anchor'],
        });
      } else if (parts[0] === 'dock') {
        updateShellControl(selectedShellControl.id, {
          dock: value as ControlDefinition['dock'],
        });
      } else {
        updateShellControl(selectedShellControl.id, {
          [name]: value,
        } as Partial<ControlDefinition>);
      }
    },
    [selectedShellControl, updateShellControl],
  );

  const shellControlPropertyMetas = useMemo(() => {
    if (!selectedShellControl) return [];
    return getPropertyMeta(selectedShellControl.type);
  }, [selectedShellControl]);

  const shellControlGroupedProperties = useMemo(() => {
    if (sortMode === 'alphabetical') {
      const sorted = [...shellControlPropertyMetas].sort((a, b) =>
        a.label.localeCompare(b.label),
      );
      return [{ category: 'All', properties: sorted }];
    }
    const categoryOrder: PropertyCategoryName[] = [
      'Design',
      'Appearance',
      'Behavior',
      'Data',
      'Sample',
      'Layout',
    ];
    const groups = new Map<string, PropertyMeta[]>();
    for (const meta of shellControlPropertyMetas) {
      const list = groups.get(meta.category) ?? [];
      list.push(meta);
      groups.set(meta.category, list);
    }
    return categoryOrder
      .filter((cat) => groups.has(cat))
      .map((cat) => ({ category: cat, properties: groups.get(cat)! }));
  }, [shellControlPropertyMetas, sortMode]);

  // === Shell 모드: 컨트롤 미선택 → Shell 속성 ===
  if (editMode === 'shell' && selectedIds.size === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            padding: '4px 6px',
            borderBottom: '1px solid #ccc',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {shellProperties.title} (Shell)
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {shellGroupedProperties.map(({ category, properties }) => (
            <PropertyCategory
              key={category}
              category={category}
              properties={properties}
              getValue={getShellValue}
              onValueChange={handleShellValueChange}
            />
          ))}
        </div>
      </div>
    );
  }

  // === Shell 모드: Shell 컨트롤 선택 → 컨트롤 속성 ===
  if (editMode === 'shell' && selectedShellControl) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            padding: '4px 6px',
            borderBottom: '1px solid #ccc',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {selectedShellControl.name} ({selectedShellControl.type})
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #ccc' }}
        >
          <TabButton
            label="Properties"
            icon="☰"
            active={activeTab === 'properties'}
            onClick={() => setActiveTab('properties')}
          />
          <div style={{ flex: 1 }} />
          {activeTab === 'properties' && (
            <button
              type="button"
              onClick={() =>
                setSortMode(sortMode === 'category' ? 'alphabetical' : 'category')
              }
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
              {sortMode === 'category' ? 'A-Z' : '☰'}
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {activeTab === 'properties' && (
            <div key={selectedShellControl.id}>
              {shellControlGroupedProperties.map(({ category, properties }) => (
                <PropertyCategory
                  key={category}
                  category={category}
                  properties={properties}
                  getValue={getShellControlValue}
                  onValueChange={handleShellControlValueChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 선택 없는 경우 → 폼 속성 표시
  if (selectedIds.size === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '4px 6px', borderBottom: '1px solid #ccc', fontSize: 12, fontWeight: 600 }}>
          {formProperties.title} (Form)
        </div>

        {/* 탭 바 */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #ccc' }}>
          <TabButton label="Properties" icon="☰" active={activeTab === 'properties'} onClick={() => setActiveTab('properties')} />
          <TabButton label="Events" icon="⚡" active={activeTab === 'events'} onClick={() => setActiveTab('events')} />
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {activeTab === 'properties' && (
            <>
              {currentFormId && <FormIdRow formId={currentFormId} />}
              {formGroupedProperties.map(({ category, properties }) => (
                <PropertyCategory
                  key={category}
                  category={category}
                  properties={properties}
                  getValue={getFormValue}
                  onValueChange={handleFormValueChange}
                />
              ))}
            </>
          )}
          {activeTab === 'events' && (
            <EventsTab
              controlId="__form__"
              controlName="Form"
              events={formEvents}
              eventHandlers={formEventHandlers}
              onHandlerNameChange={handleFormEventHandlerChange}
              onOpenEditor={handleFormOpenEditor}
              onDeleteHandler={handleFormDeleteHandler}
            />
          )}
        </div>
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
        <TabButton label="Properties" icon="☰" active={activeTab === 'properties'} onClick={() => setActiveTab('properties')} />
        <TabButton label="Events" icon="⚡" active={activeTab === 'events'} onClick={() => setActiveTab('events')} />
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
            {sortMode === 'category' ? 'A-Z' : '☰'}
          </button>
        )}
      </div>

      {/* 탭 내용 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'properties' && (
          <div key={selectedControl?.id}>
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

function FormIdRow({ formId }: { formId: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(formId).then(() => {
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  }, [formId]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '3px 6px',
        borderBottom: '1px solid #eee',
        fontSize: 12,
      }}
    >
      <span style={{ width: '35%', color: '#555', flexShrink: 0 }}>FormId</span>
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#333',
        }}
        title={formId}
      >
        {formId}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy FormId"
        style={{
          marginLeft: 4,
          padding: '1px 6px',
          border: '1px solid',
          borderColor: copied ? '#4caf50' : '#ccc',
          background: copied ? '#4caf50' : '#f5f5f5',
          color: copied ? '#fff' : '#333',
          fontSize: 11,
          cursor: 'pointer',
          borderRadius: 2,
          transition: 'all 0.2s',
        }}
      >
        {copied ? '✓' : 'Copy'}
      </button>
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
