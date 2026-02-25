import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { ControlDefinition, FormProperties, ShellProperties } from '@webform/common';
import { FORM_EVENTS } from '@webform/common';
import { useDesignerStore } from '../../stores/designerStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useHistoryStore, createSnapshot } from '../../stores/historyStore';
import { apiService } from '../../services/apiService';
import { getPropertyMeta, getControlEvents, SHELL_PROPERTIES } from './controlProperties';
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
  const [themeOptions, setThemeOptions] = useState<(string | { label: string; value: string })[]>([]);

  // 테마 목록 동적 로드 (프리셋 + 커스텀 모두 API에서)
  useEffect(() => {
    apiService
      .listThemes()
      .then((res) => {
        const options: (string | { label: string; value: string })[] = [];
        for (const t of res.data) {
          if (t.isPreset && t.presetId) {
            options.push(t.presetId);
          } else {
            options.push({ label: t.name, value: t._id });
          }
        }
        setThemeOptions(options);
      })
      .catch(() => {
        // ignore
      });
  }, []);

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
  const projectShellTheme = useDesignerStore((s) => s.projectShellTheme);

  // 동적 FORM_PROPERTY_METAS 생성
  const FORM_PROPERTY_METAS: PropertyMeta[] = useMemo(
    () => [
      { name: 'width', label: 'Width', category: 'Layout', editorType: 'number', min: 200 },
      { name: 'height', label: 'Height', category: 'Layout', editorType: 'number', min: 150 },
      { name: 'title', label: 'Title', category: 'Appearance', editorType: 'text' },
      { name: 'theme', label: projectShellTheme ? 'Theme (Shell)' : 'Theme', category: 'Appearance', editorType: 'dropdown', options: themeOptions },
      { name: 'themeColorMode', label: 'ThemeColorMode', category: 'Appearance', editorType: 'dropdown', options: ['control', 'theme'] },
      { name: 'backgroundColor', label: 'BackColor', category: 'Appearance', editorType: 'color' },
      { name: 'font', label: 'Font', category: 'Appearance', editorType: 'font' },
      { name: 'formBorderStyle', label: 'FormBorderStyle', category: 'Behavior', editorType: 'dropdown', options: ['None', 'FixedSingle', 'Fixed3D', 'Sizable'] },
      { name: 'startPosition', label: 'StartPosition', category: 'Behavior', editorType: 'dropdown', options: ['CenterScreen', 'Manual', 'CenterParent'] },
      { name: 'maximizeBox', label: 'MaximizeBox', category: 'Behavior', editorType: 'boolean' },
      { name: 'minimizeBox', label: 'MinimizeBox', category: 'Behavior', editorType: 'boolean' },
      { name: 'windowState', label: 'WindowState', category: 'Layout', editorType: 'dropdown', options: ['Normal', 'Maximized'] },
    ],
    [themeOptions, projectShellTheme],
  );

  const selectedControl = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = [...selectedIds][0];
    return controls.find((c) => c.id === id) ?? null;
  }, [selectedIds, controls]);

  // 다중 선택된 컨트롤 목록
  const selectedControls = useMemo(() => {
    if (selectedIds.size < 2) return [];
    return controls.filter((c) => selectedIds.has(c.id));
  }, [selectedIds, controls]);

  const propertyMetas = useMemo(() => {
    if (!selectedControl) return [];
    return getPropertyMeta(selectedControl.type);
  }, [selectedControl]);

  // 다중 선택 시 공통 속성 메타 (교집합)
  const multiPropertyMetas = useMemo(() => {
    if (selectedControls.length < 2) return [];
    const metaArrays = selectedControls.map((c) => getPropertyMeta(c.type));
    const firstNames = new Set(metaArrays[0].map((m) => m.name));
    const commonNames = new Set(
      [...firstNames].filter((name) =>
        metaArrays.every((metas) => metas.some((m) => m.name === name)),
      ),
    );
    return metaArrays[0].filter((m) => commonNames.has(m.name));
  }, [selectedControls]);

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

  // 중첩 속성 값 읽기 헬퍼
  const resolveValue = useCallback((ctrl: ControlDefinition, name: string): unknown => {
    const parts = name.split('.');
    let current: unknown = ctrl;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }, []);

  // 중첩 속성 값 읽기: 'position.x', 'properties.text' 등
  const getValue = useCallback((name: string): unknown => {
    if (!selectedControl) return undefined;
    return resolveValue(selectedControl, name);
  }, [selectedControl, resolveValue]);

  // 다중 선택 시 공통 값 읽기 (모두 같으면 그 값, 다르면 undefined)
  const getMultiValue = useCallback((name: string): unknown => {
    if (selectedControls.length === 0) return undefined;
    const first = resolveValue(selectedControls[0], name);
    const firstJson = JSON.stringify(first);
    for (let i = 1; i < selectedControls.length; i++) {
      const v = resolveValue(selectedControls[i], name);
      if (JSON.stringify(v) !== firstJson) return undefined;
    }
    return first;
  }, [selectedControls, resolveValue]);

  // 컨트롤 하나에 속성 변경 적용하는 헬퍼
  const applyValueToControl = useCallback((ctrl: ControlDefinition, name: string, value: unknown) => {
    const parts = name.split('.');
    if (parts[0] === 'position' && parts.length === 2) {
      const pos = { ...ctrl.position, [parts[1]]: value };
      updateControl(ctrl.id, { position: pos });
    } else if (parts[0] === 'size' && parts.length === 2) {
      const size = { ...ctrl.size, [parts[1]]: value };
      updateControl(ctrl.id, { size });
    } else if (parts[0] === 'properties' && parts.length === 2) {
      const props = { ...ctrl.properties, [parts[1]]: value };
      updateControl(ctrl.id, { properties: props });
    } else if (parts[0] === 'anchor') {
      updateControl(ctrl.id, { anchor: value as ControlDefinition['anchor'] });
    } else if (parts[0] === 'dock') {
      updateControl(ctrl.id, { dock: value as ControlDefinition['dock'] });
    } else {
      updateControl(ctrl.id, { [name]: value } as Partial<ControlDefinition>);
    }
  }, [updateControl]);

  // 속성 변경 핸들러 (단일 선택)
  const handleValueChange = useCallback((name: string, value: unknown) => {
    if (!selectedControl) return;

    pushSnapshot(createSnapshot());

    applyValueToControl(selectedControl, name, value);
  }, [selectedControl, pushSnapshot, applyValueToControl]);

  // 다중 선택 속성 변경 핸들러
  const handleMultiValueChange = useCallback((name: string, value: unknown) => {
    if (selectedControls.length === 0) return;

    pushSnapshot(createSnapshot());

    for (const ctrl of selectedControls) {
      applyValueToControl(ctrl, name, value);
    }
  }, [selectedControls, pushSnapshot, applyValueToControl]);

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

    pushSnapshot(createSnapshot());

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

  // 다중 선택 카테고리별 그룹화
  const multiGroupedProperties = useMemo(() => {
    if (sortMode === 'alphabetical') {
      const sorted = [...multiPropertyMetas].sort((a, b) => a.label.localeCompare(b.label));
      return [{ category: 'All', properties: sorted }];
    }

    const categoryOrder: PropertyCategoryName[] = ['Design', 'Appearance', 'Behavior', 'Data', 'Sample', 'Layout'];
    const groups = new Map<string, PropertyMeta[]>();

    for (const meta of multiPropertyMetas) {
      const list = groups.get(meta.category) ?? [];
      list.push(meta);
      groups.set(meta.category, list);
    }

    return categoryOrder
      .filter((cat) => groups.has(cat))
      .map((cat) => ({ category: cat, properties: groups.get(cat)! }));
  }, [multiPropertyMetas, sortMode]);

  // --- 폼 속성 getValue / handleValueChange ---
  const getFormValue = useCallback((name: string): unknown => {
    if (name === 'theme' && projectShellTheme) {
      return projectShellTheme;
    }
    return (formProperties as unknown as Record<string, unknown>)[name];
  }, [formProperties, projectShellTheme]);

  const handleFormValueChange = useCallback((name: string, value: unknown) => {
    if (name === 'theme' && projectShellTheme) return; // Shell 테마가 우선
    pushSnapshot(createSnapshot());
    setFormProperties({ [name]: value } as Partial<FormProperties>);
  }, [setFormProperties, pushSnapshot, projectShellTheme]);

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
  }, [FORM_PROPERTY_METAS]);

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

  // Shell 속성: theme 옵션을 동적으로 교체 (커스텀 테마 포함)
  const shellPropertyMetas = useMemo(() => {
    return SHELL_PROPERTIES.map((meta) =>
      meta.name === 'theme' ? { ...meta, options: themeOptions } : meta,
    );
  }, [themeOptions]);

  // Shell 속성 그룹화
  const shellGroupedProperties = useMemo(() => {
    const categoryOrder: PropertyCategoryName[] = ['Layout', 'Appearance', 'Behavior'];
    const groups = new Map<string, PropertyMeta[]>();
    for (const meta of shellPropertyMetas) {
      const list = groups.get(meta.category) ?? [];
      list.push(meta);
      groups.set(meta.category, list);
    }
    return categoryOrder
      .filter((cat) => groups.has(cat))
      .map((cat) => ({ category: cat, properties: groups.get(cat)! }));
  }, [shellPropertyMetas]);

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
          role="tablist"
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
              aria-label="정렬 방식 변경"
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
        <div role="tablist" style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #ccc' }}>
          <TabButton label="Properties" icon="☰" active={activeTab === 'properties'} onClick={() => setActiveTab('properties')} />
          <TabButton label="Events" icon="⚡" active={activeTab === 'events'} onClick={() => setActiveTab('events')} />
        </div>

        <div role="tabpanel" style={{ flex: 1, overflow: 'auto' }}>
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

  // 다중 선택 → 공통 속성 표시
  if (selectedIds.size > 1 && selectedControls.length > 1) {
    const typeSet = new Set(selectedControls.map((c) => c.type));
    const typeLabel = typeSet.size === 1 ? String([...typeSet][0]) : 'Mixed';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '4px 6px', borderBottom: '1px solid #ccc', fontSize: 12, fontWeight: 600 }}>
          {selectedControls.length} controls ({typeLabel})
        </div>

        <div role="tablist" style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #ccc' }}>
          <TabButton label="Properties" icon="☰" active={true} onClick={() => {}} />
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => setSortMode(sortMode === 'category' ? 'alphabetical' : 'category')}
            title={sortMode === 'category' ? 'Sort alphabetically' : 'Sort by category'}
            aria-label="정렬 방식 변경"
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
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {multiGroupedProperties.map(({ category, properties }) => (
            <PropertyCategory
              key={category}
              category={category}
              properties={properties}
              getValue={getMultiValue}
              onValueChange={handleMultiValueChange}
            />
          ))}
        </div>
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
      <div role="tablist" style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #ccc' }}>
        <TabButton label="Properties" icon="☰" active={activeTab === 'properties'} onClick={() => setActiveTab('properties')} />
        <TabButton label="Events" icon="⚡" active={activeTab === 'events'} onClick={() => setActiveTab('events')} />
        <div style={{ flex: 1 }} />
        {activeTab === 'properties' && (
          <button
            type="button"
            onClick={() => setSortMode(sortMode === 'category' ? 'alphabetical' : 'category')}
            title={sortMode === 'category' ? 'Sort alphabetically' : 'Sort by category'}
            aria-label="정렬 방식 변경"
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
      <div role="tabpanel" style={{ flex: 1, overflow: 'auto' }}>
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
        aria-label="FormId 복사"
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
      role="tab"
      aria-selected={active}
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
