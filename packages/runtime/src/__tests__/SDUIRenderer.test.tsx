import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SDUIRenderer } from '../renderer/SDUIRenderer';
import { useRuntimeStore } from '../stores/runtimeStore';
import type { FormDefinition } from '@webform/common';

function createMockFormDef(overrides?: Partial<FormDefinition>): FormDefinition {
  return {
    id: 'form1',
    name: 'TestForm',
    version: 1,
    properties: {
      title: 'Test Form',
      width: 800,
      height: 600,
      backgroundColor: '#AABBCC',
      font: { family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false },
      startPosition: 'CenterScreen',
      formBorderStyle: 'Sizable',
      maximizeBox: true,
      minimizeBox: true,
    },
    controls: [],
    eventHandlers: [],
    dataBindings: [],
    ...overrides,
  };
}

describe('SDUIRenderer', () => {
  beforeEach(() => {
    useRuntimeStore.setState({
      currentFormDef: null,
      controlStates: {},
    });
  });

  it('Button + Label FormDefinition 렌더링 후 컴포넌트 존재를 확인한다', () => {
    const formDef = createMockFormDef({
      controls: [
        {
          id: 'btn1',
          type: 'Button',
          name: 'button1',
          properties: { text: 'Save' },
          position: { x: 10, y: 10 },
          size: { width: 100, height: 30 },
          anchor: { top: true, left: true, bottom: false, right: false },
          dock: 'None',
          tabIndex: 0,
          visible: true,
          enabled: true,
        },
        {
          id: 'lbl1',
          type: 'Label',
          name: 'label1',
          properties: { text: 'Status Label' },
          position: { x: 10, y: 50 },
          size: { width: 200, height: 20 },
          anchor: { top: true, left: true, bottom: false, right: false },
          dock: 'None',
          tabIndex: 1,
          visible: true,
          enabled: true,
        },
      ],
    });

    render(<SDUIRenderer formDefinition={formDef} />);

    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Status Label')).toBeInTheDocument();
  });

  it('중첩 Panel + 자식 컨트롤을 렌더링한다', () => {
    const formDef = createMockFormDef({
      controls: [
        {
          id: 'panel1',
          type: 'Panel',
          name: 'mainPanel',
          properties: {},
          position: { x: 0, y: 0 },
          size: { width: 400, height: 300 },
          anchor: { top: true, left: true, bottom: false, right: false },
          dock: 'None',
          tabIndex: 0,
          visible: true,
          enabled: true,
          children: [
            {
              id: 'innerBtn',
              type: 'Button',
              name: 'innerButton',
              properties: { text: 'Inner Button' },
              position: { x: 5, y: 5 },
              size: { width: 80, height: 25 },
              anchor: { top: true, left: true, bottom: false, right: false },
              dock: 'None',
              tabIndex: 0,
              visible: true,
              enabled: true,
            },
            {
              id: 'innerLbl',
              type: 'Label',
              name: 'innerLabel',
              properties: { text: 'Inner Label' },
              position: { x: 5, y: 35 },
              size: { width: 150, height: 20 },
              anchor: { top: true, left: true, bottom: false, right: false },
              dock: 'None',
              tabIndex: 1,
              visible: true,
              enabled: true,
            },
          ],
        },
      ],
    });

    render(<SDUIRenderer formDefinition={formDef} />);

    // Panel이 렌더링됨
    const panel = document.querySelector('[data-control-id="panel1"]');
    expect(panel).toBeInTheDocument();

    // 자식 컨트롤이 렌더링됨
    expect(screen.getByText('Inner Button')).toBeInTheDocument();
    expect(screen.getByText('Inner Label')).toBeInTheDocument();
  });

  it('FormContainer에 크기와 배경색이 적용된다', () => {
    const formDef = createMockFormDef({
      properties: {
        title: 'Styled Form',
        width: 640,
        height: 480,
        backgroundColor: '#FF0000',
        font: { family: 'Arial', size: 10, bold: false, italic: false, underline: false, strikethrough: false },
        startPosition: 'CenterScreen',
        formBorderStyle: 'Sizable',
        maximizeBox: false,
        minimizeBox: false,
      },
    });

    render(<SDUIRenderer formDefinition={formDef} />);

    // FormContainer (wf-form) 확인
    const formContainer = document.querySelector('.wf-form') as HTMLElement;
    expect(formContainer).toBeInTheDocument();
    expect(formContainer.style.width).toBe('640px');
    expect(formContainer.style.height).toBe('480px');

    // Content 영역의 배경색 확인
    const contentArea = document.querySelector('.wf-content') as HTMLElement;
    expect(contentArea).toBeInTheDocument();
    expect(contentArea.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });
});
