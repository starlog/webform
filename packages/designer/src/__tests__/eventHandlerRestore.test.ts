import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '../stores/designerStore';
import type { ControlDefinition, FormProperties } from '@webform/common';

// --- 헬퍼 ---

const DEFAULT_FORM_PROPS: FormProperties = {
  title: 'TestForm',
  width: 800,
  height: 600,
  backgroundColor: '#F0F0F0',
  font: {
    family: 'Segoe UI',
    size: 9,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  },
  startPosition: 'CenterScreen',
  formBorderStyle: 'Sizable',
  maximizeBox: true,
  minimizeBox: true,
};

function makeControl(overrides: Partial<ControlDefinition> = {}): ControlDefinition {
  return {
    id: overrides.id ?? 'ctrl-1',
    type: 'Button',
    name: overrides.name ?? 'button1',
    properties: { text: 'Button', ...overrides.properties },
    position: { x: 0, y: 0 },
    size: { width: 75, height: 23 },
    anchor: { top: true, bottom: false, left: true, right: false },
    dock: 'None',
    tabIndex: 0,
    visible: true,
    enabled: true,
    ...overrides,
    // properties를 overrides 이후 다시 세팅 (spread 순서 보장)
  };
}

// --- 초기화 ---

beforeEach(() => {
  useDesignerStore.setState({
    controls: [],
    isDirty: false,
    currentFormId: null,
    formEventHandlers: {},
    formEventCode: {},
  });
});

// --- 테스트 ---

describe('이벤트 핸들러 복원 (loadForm)', () => {
  it('loadForm with eventHandlers: 이벤트 핸들러가 컨트롤에 복원됨', () => {
    const formId = 'form-1';
    const controls: ControlDefinition[] = [
      makeControl({ id: 'btn1', name: 'btnSubmit' }),
      makeControl({ id: 'btn2', name: 'btnCancel', type: 'Button' }),
    ];
    const eventHandlers = [
      {
        controlId: 'btn1',
        eventName: 'Click',
        handlerCode: 'ctx.showMessage("Submitted!")',
      },
      {
        controlId: 'btn2',
        eventName: 'Click',
        handlerCode: 'ctx.controls.btnCancel.enabled = false;',
      },
    ];

    useDesignerStore.getState().loadForm(formId, controls, DEFAULT_FORM_PROPS, eventHandlers);

    const state = useDesignerStore.getState();
    const btn1 = state.controls.find((c) => c.id === 'btn1')!;
    const btn2 = state.controls.find((c) => c.id === 'btn2')!;

    // btn1: _eventHandlers, _eventCode 확인
    expect(btn1.properties._eventHandlers).toEqual({ Click: 'btnSubmit_Click' });
    expect(btn1.properties._eventCode).toEqual({
      btnSubmit_Click: 'ctx.showMessage("Submitted!")',
    });

    // btn2: _eventHandlers, _eventCode 확인
    expect(btn2.properties._eventHandlers).toEqual({ Click: 'btnCancel_Click' });
    expect(btn2.properties._eventCode).toEqual({
      btnCancel_Click: 'ctx.controls.btnCancel.enabled = false;',
    });
  });

  it('loadForm with eventHandlers: 폼 레벨 이벤트가 복원됨', () => {
    const formId = 'form-1';
    const controls: ControlDefinition[] = [makeControl({ id: 'btn1', name: 'btnOK' })];
    const eventHandlers = [
      {
        controlId: formId,
        eventName: 'Load',
        handlerCode: 'ctx.controls.btnOK.text = "Ready";',
      },
      {
        controlId: formId,
        eventName: 'Closing',
        handlerCode: 'ctx.showMessage("Goodbye");',
      },
    ];

    useDesignerStore.getState().loadForm(formId, controls, DEFAULT_FORM_PROPS, eventHandlers);

    const state = useDesignerStore.getState();

    // 폼 레벨 이벤트 핸들러
    expect(state.formEventHandlers).toEqual({
      Load: 'Form_Load',
      Closing: 'Form_Closing',
    });
    expect(state.formEventCode).toEqual({
      Form_Load: 'ctx.controls.btnOK.text = "Ready";',
      Form_Closing: 'ctx.showMessage("Goodbye");',
    });

    // 컨트롤에는 이벤트 핸들러가 없어야 함
    const btn1 = state.controls.find((c) => c.id === 'btn1')!;
    expect(btn1.properties._eventHandlers).toBeUndefined();
  });

  it('loadForm without eventHandlers: 기존 formEventHandlers 유지 (Undo/Redo 시나리오)', () => {
    const formId = 'form-1';
    const btn = makeControl({ id: 'btn1', name: 'btnAction' });
    const eventHandlers = [
      {
        controlId: formId,
        eventName: 'Load',
        handlerCode: 'console.log("loaded");',
      },
      {
        controlId: 'btn1',
        eventName: 'Click',
        handlerCode: 'alert("click");',
      },
    ];

    // 1. 먼저 eventHandlers가 있는 loadForm() 호출
    useDesignerStore.getState().loadForm(formId, [btn], DEFAULT_FORM_PROPS, eventHandlers);

    const stateAfterFirst = useDesignerStore.getState();
    expect(stateAfterFirst.formEventHandlers).toEqual({ Load: 'Form_Load' });
    expect(stateAfterFirst.formEventCode).toEqual({
      Form_Load: 'console.log("loaded");',
    });

    // 컨트롤에 _eventHandlers가 포함된 스냅샷을 준비 (Undo/Redo가 보존하는 형태)
    const controlsSnapshot = stateAfterFirst.controls.map((c) => ({ ...c }));

    // 2. eventHandlers 없이 loadForm() 호출 (Undo/Redo 시나리오)
    useDesignerStore.getState().loadForm(formId, controlsSnapshot, DEFAULT_FORM_PROPS);

    const stateAfterSecond = useDesignerStore.getState();

    // formEventHandlers/formEventCode 보존
    expect(stateAfterSecond.formEventHandlers).toEqual({ Load: 'Form_Load' });
    expect(stateAfterSecond.formEventCode).toEqual({
      Form_Load: 'console.log("loaded");',
    });

    // 컨트롤의 _eventHandlers는 스냅샷에 포함되어 보존됨
    const btn1 = stateAfterSecond.controls.find((c) => c.id === 'btn1')!;
    expect(btn1.properties._eventHandlers).toEqual({ Click: 'btnAction_Click' });
    expect(btn1.properties._eventCode).toEqual({
      btnAction_Click: 'alert("click");',
    });
  });

  it('loadForm: 중첩 컨트롤(TabControl > Panel > Button)의 이벤트 핸들러 복원', () => {
    const formId = 'form-layout';

    // generate-sample.sh의 '2. 컨테이너/레이아웃 데모'와 동일한 중첩 구조
    const nestedControls: ControlDefinition[] = [
      {
        id: 'tabMain',
        type: 'TabControl',
        name: 'tabMain',
        properties: {
          tabs: [
            { title: '개인정보', name: 'tabPersonal' },
            { title: '회사정보', name: 'tabCompany' },
          ],
          selectedIndex: 0,
        },
        position: { x: 10, y: 10 },
        size: { width: 560, height: 450 },
        anchor: { top: true, bottom: false, left: true, right: false },
        dock: 'None',
        tabIndex: 0,
        visible: true,
        enabled: true,
        children: [
          {
            id: 'pnlPersonal',
            type: 'Panel',
            name: 'pnlPersonal',
            properties: { borderStyle: 'None', _tabIndex: 0 },
            position: { x: 5, y: 30 },
            size: { width: 545, height: 410 },
            anchor: { top: true, bottom: false, left: true, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
            children: [
              {
                id: 'btnSaveProfile',
                type: 'Button',
                name: 'btnSaveProfile',
                properties: {
                  text: '프로필 저장',
                  backgroundColor: '#6A1B9A',
                  foreColor: '#FFFFFF',
                },
                position: { x: 20, y: 310 },
                size: { width: 130, height: 32 },
                anchor: { top: true, bottom: false, left: true, right: false },
                dock: 'None',
                tabIndex: 8,
                visible: true,
                enabled: true,
              },
              {
                id: 'lblProfileStatus',
                type: 'Label',
                name: 'lblProfileStatus',
                properties: { text: '' },
                position: { x: 160, y: 318 },
                size: { width: 350, height: 20 },
                anchor: { top: true, bottom: false, left: true, right: false },
                dock: 'None',
                tabIndex: 9,
                visible: true,
                enabled: true,
              },
            ],
          },
        ],
      },
    ];

    const eventHandlers = [
      {
        controlId: 'btnSaveProfile',
        eventName: 'Click',
        handlerCode:
          'var name = ctx.controls.txtProfileName.text;\nctx.showMessage("저장 완료: " + name);',
      },
    ];

    useDesignerStore
      .getState()
      .loadForm(formId, nestedControls, DEFAULT_FORM_PROPS, eventHandlers);

    const state = useDesignerStore.getState();

    // flattenControls로 평탄화 되었으므로 모든 컨트롤이 최상위에 있어야 함
    expect(state.controls.length).toBe(4); // tabMain, pnlPersonal, btnSaveProfile, lblProfileStatus

    const btnSaveProfile = state.controls.find((c) => c.id === 'btnSaveProfile')!;
    expect(btnSaveProfile).toBeDefined();

    // 이벤트 핸들러 복원 확인
    expect(btnSaveProfile.properties._eventHandlers).toEqual({
      Click: 'btnSaveProfile_Click',
    });
    expect(btnSaveProfile.properties._eventCode).toEqual({
      btnSaveProfile_Click:
        'var name = ctx.controls.txtProfileName.text;\nctx.showMessage("저장 완료: " + name);',
    });

    // 다른 컨트롤에는 이벤트 핸들러가 없어야 함
    const tabMain = state.controls.find((c) => c.id === 'tabMain')!;
    expect(tabMain.properties._eventHandlers).toBeUndefined();

    const lblProfileStatus = state.controls.find((c) => c.id === 'lblProfileStatus')!;
    expect(lblProfileStatus.properties._eventHandlers).toBeUndefined();
  });

  it('save/load cycle: 이벤트 핸들러가 저장 후 재로드 시 유지됨', () => {
    const formId = 'form-cycle';
    const controls: ControlDefinition[] = [
      makeControl({ id: 'btn1', name: 'btnSave' }),
      makeControl({ id: 'btn2', name: 'btnLoad' }),
    ];
    const originalEventHandlers = [
      {
        controlId: formId,
        eventName: 'Load',
        handlerCode: 'ctx.controls.btnSave.enabled = true;',
      },
      {
        controlId: 'btn1',
        eventName: 'Click',
        handlerCode: 'ctx.showMessage("Saved!");',
      },
      {
        controlId: 'btn2',
        eventName: 'Click',
        handlerCode: 'ctx.showMessage("Loaded!");',
      },
    ];

    // 1. loadForm으로 이벤트 핸들러 복원
    useDesignerStore
      .getState()
      .loadForm(formId, controls, DEFAULT_FORM_PROPS, originalEventHandlers);

    // 2. extractEventHandlers 시뮬레이션 (apiService의 extractEventHandlers를 직접 호출하기 어려우므로
    //    store 상태에서 직접 추출)
    const state = useDesignerStore.getState();
    const extracted: Array<{
      controlId: string;
      eventName: string;
      handlerCode: string;
    }> = [];

    // 컨트롤 레벨 이벤트 추출
    for (const ctrl of state.controls) {
      const eventMap = ctrl.properties._eventHandlers as Record<string, string> | undefined;
      const codeMap = ctrl.properties._eventCode as Record<string, string> | undefined;
      if (eventMap && codeMap) {
        for (const [eventName, handlerName] of Object.entries(eventMap)) {
          const code = codeMap[handlerName];
          if (code) {
            extracted.push({ controlId: ctrl.id, eventName, handlerCode: code });
          }
        }
      }
    }

    // 폼 레벨 이벤트 추출
    for (const [eventName, handlerName] of Object.entries(state.formEventHandlers)) {
      const code = state.formEventCode[handlerName];
      if (code) {
        extracted.push({ controlId: formId, eventName, handlerCode: code });
      }
    }

    // 추출된 핸들러가 원본과 동일한 데이터를 포함하는지 확인
    expect(extracted).toHaveLength(3);
    expect(extracted).toContainEqual({
      controlId: formId,
      eventName: 'Load',
      handlerCode: 'ctx.controls.btnSave.enabled = true;',
    });
    expect(extracted).toContainEqual({
      controlId: 'btn1',
      eventName: 'Click',
      handlerCode: 'ctx.showMessage("Saved!");',
    });
    expect(extracted).toContainEqual({
      controlId: 'btn2',
      eventName: 'Click',
      handlerCode: 'ctx.showMessage("Loaded!");',
    });

    // 3. 추출된 배열로 다시 loadForm() 호출
    useDesignerStore.setState({
      controls: [],
      formEventHandlers: {},
      formEventCode: {},
    });
    useDesignerStore
      .getState()
      .loadForm(formId, controls, DEFAULT_FORM_PROPS, extracted);

    // 4. 이벤트 핸들러가 동일하게 복원되는지 확인
    const reloaded = useDesignerStore.getState();

    // 폼 레벨
    expect(reloaded.formEventHandlers).toEqual({ Load: 'Form_Load' });
    expect(reloaded.formEventCode).toEqual({
      Form_Load: 'ctx.controls.btnSave.enabled = true;',
    });

    // 컨트롤 레벨
    const btn1 = reloaded.controls.find((c) => c.id === 'btn1')!;
    expect(btn1.properties._eventHandlers).toEqual({ Click: 'btnSave_Click' });
    expect(btn1.properties._eventCode).toEqual({
      btnSave_Click: 'ctx.showMessage("Saved!");',
    });

    const btn2 = reloaded.controls.find((c) => c.id === 'btn2')!;
    expect(btn2.properties._eventHandlers).toEqual({ Click: 'btnLoad_Click' });
    expect(btn2.properties._eventCode).toEqual({
      btnLoad_Click: 'ctx.showMessage("Loaded!");',
    });
  });
});
