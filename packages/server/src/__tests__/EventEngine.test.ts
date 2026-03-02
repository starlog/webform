import { describe, it, expect } from 'vitest';
import type { EventRequest, FormDefinition } from '@webform/common';
import { EventEngine } from '../services/EventEngine.js';

function makeFormDef(handlers: FormDefinition['eventHandlers']): FormDefinition {
  return {
    id: 'form1',
    name: 'TestForm',
    version: 1,
    properties: {
      title: 'Test',
      width: 800,
      height: 600,
      backgroundColor: '#FFFFFF',
      font: { family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false },
      startPosition: 'CenterScreen',
      formBorderStyle: 'Sizable',
      maximizeBox: true,
      minimizeBox: true,
    },
    controls: [],
    eventHandlers: handlers,
  };
}

function makePayload(overrides?: Partial<EventRequest>): EventRequest {
  return {
    formId: 'form1',
    controlId: 'btnSubmit',
    eventName: 'Click',
    eventArgs: { type: 'Click', timestamp: Date.now() },
    formState: {
      lblStatus: { text: '초기값' },
    },
    ...overrides,
  };
}

describe('EventEngine', () => {
  const engine = new EventEngine();

  it('핸들러를 실행하고 UIPatch를 반환해야 한다', async () => {
    const formDef = makeFormDef([
      {
        controlId: 'btnSubmit',
        eventName: 'Click',
        handlerType: 'server',
        handlerCode: "ctx.controls.lblStatus.text = '클릭됨'",
      },
    ]);

    const result = await engine.executeEvent('form1', makePayload(), formDef);

    expect(result.success).toBe(true);
    expect(result.patches).toEqual([
      {
        type: 'updateProperty',
        target: 'lblStatus',
        payload: { text: '클릭됨' },
      },
    ]);
  });

  it('여러 컨트롤을 동시에 업데이트해야 한다', async () => {
    const formDef = makeFormDef([
      {
        controlId: 'btnSubmit',
        eventName: 'Click',
        handlerType: 'server',
        handlerCode: "ctx.controls.lblStatus.text = '완료'; ctx.controls.txtInput.value = '입력됨'",
      },
    ]);

    const payload = makePayload({
      formState: {
        lblStatus: { text: '초기값' },
        txtInput: { value: '' },
      },
    });

    const result = await engine.executeEvent('form1', payload, formDef);

    expect(result.success).toBe(true);
    expect(result.patches).toHaveLength(2);

    const lblPatch = result.patches.find((p) => p.target === 'lblStatus');
    expect(lblPatch?.payload).toEqual({ text: '완료' });

    const txtPatch = result.patches.find((p) => p.target === 'txtInput');
    expect(txtPatch?.payload).toEqual({ value: '입력됨' });
  });

  it('에러 코드 실행 시 error 필드가 있는 응답을 반환해야 한다', async () => {
    const formDef = makeFormDef([
      {
        controlId: 'btnSubmit',
        eventName: 'Click',
        handlerType: 'server',
        handlerCode: 'throw new Error("런타임 에러")',
      },
    ]);

    const result = await engine.executeEvent('form1', makePayload(), formDef);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.patches).toEqual([]);
  });

  it('핸들러가 없으면 에러를 반환해야 한다', async () => {
    const formDef = makeFormDef([]);

    const result = await engine.executeEvent('form1', makePayload(), formDef);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No server handler found');
  });
});
