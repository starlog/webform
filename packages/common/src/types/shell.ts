import type { ControlDefinition, FontDefinition, FormDefinition } from './form';
import type { EventHandlerDefinition, EventArgs } from './events';

/**
 * Application Shell 속성.
 * FormProperties와 유사하지만 startPosition이 없고 showTitleBar가 추가됨.
 */
export interface ShellProperties {
  title: string;
  width: number;
  height: number;
  backgroundColor: string;
  font: FontDefinition;
  showTitleBar: boolean;
  formBorderStyle: 'None' | 'FixedSingle' | 'Fixed3D' | 'Sizable';
  maximizeBox: boolean;
  minimizeBox: boolean;
}

/**
 * Application Shell 정의.
 * 프로젝트 당 하나의 Shell이 존재하며, MenuStrip/ToolStrip/StatusStrip 등
 * 앱 수준 UI 컨트롤을 포함한다.
 */
export interface ApplicationShellDefinition {
  id: string;
  projectId: string;
  name: string;
  version: number;
  properties: ShellProperties;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  startFormId?: string;
}

/**
 * Shell 전용 이벤트 목록.
 * - Load: Shell 최초 로드
 * - FormChanged: 활성 폼 변경 후
 * - BeforeFormChange: 폼 변경 전 (취소 가능)
 */
export const SHELL_EVENTS = ['Load', 'FormChanged', 'BeforeFormChange'] as const;
export type ShellEventType = (typeof SHELL_EVENTS)[number];

/**
 * Shell 이벤트 요청.
 * EventRequest와 유사하지만 formId 대신 projectId를 사용하고
 * shellState, currentFormId 필드가 있다.
 */
/**
 * GET /api/runtime/app/:projectId 응답 타입.
 * Shell이 없는 프로젝트의 경우 shell이 null이 된다.
 */
export interface AppLoadResponse {
  shell: ApplicationShellDefinition | null;
  startForm: FormDefinition;
}

export interface ShellEventRequest {
  projectId: string;
  controlId: string;
  eventName: string;
  eventArgs: EventArgs;
  shellState: Record<string, Record<string, unknown>>;
  currentFormId: string;
}
