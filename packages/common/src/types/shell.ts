import type { ControlDefinition, FontDefinition, FormDefinition } from './form.js';
import type { EventHandlerDefinition, EventArgs } from './events.js';
import type { ThemeId } from './theme.js';

/**
 * Shell 인증 설정.
 * enabled=true이면 Runtime 사용자는 로그인해야 폼에 접근 가능.
 * provider='google': Google OAuth2 로그인
 * provider='password': ID/Password 로그인
 */
export interface AuthSettings {
  enabled: boolean;
  provider: 'google' | 'password';
  googleClientId: string;
  googleClientSecret: string;
  runtimeBaseUrl: string;
  allowedDomains: string[]; // 빈 배열 = 모든 도메인 허용
  /** password 모드: 사용자 계정 목록 (id/password 쌍) */
  users?: AuthUser[];
}

export interface AuthUser {
  username: string;
  /** bcrypt 해시 또는 평문 (서버에서 해시 비교) */
  password: string;
}

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
  windowState?: 'Normal' | 'Maximized';
  theme?: ThemeId;
  auth?: AuthSettings;
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
  itemScriptPath?: number[];
}
