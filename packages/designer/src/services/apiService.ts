import { useEffect, useRef, useCallback } from 'react';
import { useDesignerStore } from '../stores/designerStore';
import { nestControls } from '@webform/common';
import type {
  ControlDefinition,
  FontDefinition,
  FormProperties,
  EventHandlerDefinition,
  DataBindingDefinition,
  ShellProperties,
  CustomThemeDocument,
  ThemeTokens,
} from '@webform/common';

// --- 타입 정의 ---

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface FormSummary {
  _id: string;
  name: string;
  version: number;
  status: 'draft' | 'published';
  updatedAt: string;
}

interface FormDocument extends FormSummary {
  projectId: string;
  properties: FormProperties;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  dataBindings: DataBindingDefinition[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
}

interface ProjectDocument {
  _id: string;
  name: string;
  description: string;
  defaultFont?: FontDefinition;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateFormPayload {
  name: string;
  projectId: string;
}

interface UpdateFormPayload {
  name?: string;
  properties?: Partial<FormProperties>;
  controls?: ControlDefinition[];
  eventHandlers?: EventHandlerDefinition[];
  dataBindings?: DataBindingDefinition[];
  version?: number; // 낙관적 잠금용
}

interface CreateProjectPayload {
  name: string;
  description?: string;
}

interface ShellDocument {
  _id: string;
  projectId: string;
  name: string;
  version: number;
  properties: ShellProperties;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  startFormId?: string;
  published: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface UpdateShellPayload {
  name?: string;
  properties?: Partial<ShellProperties>;
  controls?: ControlDefinition[];
  eventHandlers?: EventHandlerDefinition[];
  startFormId?: string;
}

interface ImportProjectPayload {
  project: { name: string; description?: string };
  forms: Array<{
    name: string;
    properties?: Record<string, unknown>;
    controls?: unknown[];
    eventHandlers?: unknown[];
    dataBindings?: unknown[];
  }>;
}

interface ExportProjectData {
  exportVersion: string;
  exportedAt: string;
  project: { name: string; description: string };
  forms: Array<{
    name: string;
    properties: Record<string, unknown>;
    controls: unknown[];
    eventHandlers: unknown[];
    dataBindings: unknown[];
  }>;
}

interface PublishAllResult {
  forms: { publishedCount: number; skippedCount: number; totalCount: number };
  shell: { published: boolean; skipped: boolean };
}

interface VersionSummary {
  version: number;
  note: string;
  savedAt: string;
}

interface FormVersionSnapshot {
  formId: string;
  version: number;
  note: string;
  snapshot: {
    name: string;
    properties: FormProperties;
    controls: ControlDefinition[];
    eventHandlers: EventHandlerDefinition[];
    dataBindings: DataBindingDefinition[];
  };
  savedAt: string;
}

// --- HTTP 클라이언트 ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_BASE = ((import.meta as any).env?.VITE_API_URL as string | undefined) ?? '/api';

let authToken: string | null = null;

export async function ensureAuth(): Promise<void> {
  if (authToken) return;
  const res = await fetch('/auth/dev-token', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to obtain dev token');
  const { token } = await res.json();
  authToken = token;
}

/** 현재 인증 토큰 반환 (WebSocket 연결 등에서 사용) */
export function getAuthToken(): string | null {
  return authToken;
}

/** 테스트용: 인증 토큰 초기화 */
export function _resetAuthToken(): void {
  authToken = null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  await ensureAuth();

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const details = error.error?.details;
    const message = error.error?.message ?? `API Error: ${res.status}`;
    const err = new Error(details ? `${message}: ${JSON.stringify(details)}` : message);
    (err as Error & { status: number; details?: unknown }).status = res.status;
    (err as Error & { status: number; details?: unknown }).details = details;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- API 서비스 ---

export const apiService = {
  // 폼 목록 조회
  async listForms(projectId?: string): Promise<{ data: FormSummary[]; meta: PaginationMeta }> {
    const params = projectId ? `?projectId=${projectId}` : '';
    return request(`/forms${params}`);
  },

  // 폼 로드
  async loadForm(id: string): Promise<{ data: FormDocument }> {
    return request(`/forms/${id}`);
  },

  // 폼 저장 (PUT)
  async saveForm(id: string, form: UpdateFormPayload): Promise<{ data: FormDocument }> {
    return request(`/forms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(form),
    });
  },

  // 폼 퍼블리시
  async publishForm(id: string): Promise<{ data: FormDocument }> {
    return request(`/forms/${id}/publish`, { method: 'POST' });
  },

  // 폼 생성
  async createForm(input: CreateFormPayload): Promise<{ data: FormDocument }> {
    return request('/forms', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // 폼 삭제
  async deleteForm(id: string): Promise<void> {
    return request(`/forms/${id}`, { method: 'DELETE' });
  },

  // 프로젝트 목록 조회
  async listProjects(): Promise<{ data: ProjectDocument[]; meta: PaginationMeta }> {
    return request('/projects');
  },

  // 프로젝트 상세 조회
  async getProject(id: string): Promise<{ data: { project: ProjectDocument; forms: FormSummary[] } }> {
    return request(`/projects/${id}`);
  },

  // 프로젝트 생성
  async createProject(input: CreateProjectPayload): Promise<{ data: ProjectDocument }> {
    return request('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // 프로젝트 삭제
  async deleteProject(id: string): Promise<void> {
    return request(`/projects/${id}`, { method: 'DELETE' });
  },

  // 프로젝트 내보내기
  async exportProject(id: string): Promise<ExportProjectData> {
    return request(`/projects/${id}/export`);
  },

  // 프로젝트 가져오기
  async importProject(data: ImportProjectPayload): Promise<{ data: ProjectDocument }> {
    return request('/projects/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 프로젝트 업데이트
  async updateProject(
    id: string,
    input: { name?: string; description?: string; defaultFont?: FontDefinition | null },
  ): Promise<{ data: ProjectDocument }> {
    return request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  // 프로젝트 전체 폼 폰트 일괄 적용
  async applyProjectFont(
    projectId: string,
    font: FontDefinition,
  ): Promise<{ success: boolean; modifiedCount: number }> {
    return request(`/projects/${projectId}/font`, {
      method: 'PUT',
      body: JSON.stringify({ font }),
    });
  },

  // Shell 조회 (없으면 { data: null } 반환)
  async getShell(projectId: string): Promise<{ data: ShellDocument | null }> {
    return request(`/projects/${projectId}/shell`);
  },

  // Shell 생성
  async createShell(
    projectId: string,
    data: Partial<UpdateShellPayload>,
  ): Promise<{ data: ShellDocument }> {
    return request(`/projects/${projectId}/shell`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Shell 수정
  async updateShell(
    projectId: string,
    data: UpdateShellPayload,
  ): Promise<{ data: ShellDocument }> {
    return request(`/projects/${projectId}/shell`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Shell 삭제
  async deleteShell(projectId: string): Promise<void> {
    return request(`/projects/${projectId}/shell`, { method: 'DELETE' });
  },

  // Shell 퍼블리시
  async publishShell(projectId: string): Promise<{ data: ShellDocument }> {
    return request(`/projects/${projectId}/shell/publish`, { method: 'POST' });
  },

  // 프로젝트 전체 퍼블리시 (폼 + Shell)
  async publishAll(projectId: string): Promise<{ data: PublishAllResult }> {
    return request(`/projects/${projectId}/publish-all`, { method: 'POST' });
  },

  // --- Theme API ---

  async listThemes(): Promise<{ data: CustomThemeDocument[]; meta: PaginationMeta }> {
    return request('/themes');
  },

  async getTheme(id: string): Promise<{ data: CustomThemeDocument }> {
    return request(`/themes/${id}`);
  },

  async createTheme(input: {
    name: string;
    basePreset?: string;
    tokens: ThemeTokens;
  }): Promise<{ data: CustomThemeDocument }> {
    return request('/themes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /** themeId가 ObjectId이면 _id로, 아니면 presetId로 테마를 조회한다 */
  async getThemeByIdOrPresetId(themeId: string): Promise<{ data: CustomThemeDocument }> {
    const isObjectId = /^[a-f\d]{24}$/i.test(themeId);
    if (isObjectId) {
      return request(`/runtime/themes/${themeId}`);
    }
    return request(`/runtime/themes/preset/${themeId}`);
  },

  async updateTheme(
    id: string,
    input: { name?: string; tokens?: ThemeTokens },
  ): Promise<{ data: CustomThemeDocument }> {
    return request(`/themes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async deleteTheme(id: string): Promise<void> {
    return request(`/themes/${id}`, { method: 'DELETE' });
  },

  // --- Version API ---

  // 버전 목록 조회
  async getVersions(formId: string): Promise<{ data: VersionSummary[] }> {
    return request(`/forms/${formId}/versions`);
  },

  // 특정 버전 snapshot 로드
  async loadVersion(formId: string, version: number): Promise<{ data: FormVersionSnapshot }> {
    return request(`/forms/${formId}/versions/${version}`);
  },
};

// --- 저장 전 컨트롤 데이터 보정 (size/position 유효성) ---

const MIN_SIZE = 1;

function sanitizeControls(controls: ControlDefinition[]): ControlDefinition[] {
  return controls.map((ctrl) => ({
    ...ctrl,
    size: {
      width: Math.max(ctrl.size.width, MIN_SIZE),
      height: Math.max(ctrl.size.height, MIN_SIZE),
    },
    children: ctrl.children ? sanitizeControls(ctrl.children) : undefined,
  }));
}

// --- 컨트롤에서 eventHandlers 배열 추출 ---

function extractEventHandlers(controls: ControlDefinition[]): Array<{
  controlId: string;
  eventName: string;
  handlerType: 'server';
  handlerCode: string;
}> {
  const handlers: Array<{
    controlId: string;
    eventName: string;
    handlerType: 'server';
    handlerCode: string;
  }> = [];

  function walk(ctrls: ControlDefinition[]) {
    for (const control of ctrls) {
      const eventMap = control.properties._eventHandlers as Record<string, string> | undefined;
      const codeMap = control.properties._eventCode as Record<string, string> | undefined;
      if (eventMap && codeMap) {
        for (const [eventName, handlerName] of Object.entries(eventMap)) {
          const code = codeMap[handlerName];
          if (code) {
            handlers.push({
              controlId: control.id,
              eventName,
              handlerType: 'server',
              handlerCode: code,
            });
          }
        }
      }
      if (control.children) walk(control.children);
    }
  }

  walk(controls);

  // 폼 레벨 이벤트 핸들러 추가
  const state = useDesignerStore.getState();
  const formId = state.currentFormId;
  if (formId) {
    const { formEventHandlers, formEventCode } = state;
    for (const [eventName, handlerName] of Object.entries(formEventHandlers)) {
      const code = formEventCode[handlerName];
      if (code) {
        handlers.push({
          controlId: formId,
          eventName,
          handlerType: 'server',
          handlerCode: code,
        });
      }
    }
  }

  return handlers;
}

// --- Auto-save 훅 ---

const AUTO_SAVE_INTERVAL = 30_000; // 30초

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const savingRef = useRef(false);
  const currentFormId = useDesignerStore((s) => s.currentFormId);
  const isDirty = useDesignerStore((s) => s.isDirty);
  const controls = useDesignerStore((s) => s.controls);
  const formProperties = useDesignerStore((s) => s.formProperties);
  const markClean = useDesignerStore((s) => s.markClean);
  const editMode = useDesignerStore((s) => s.editMode);

  const save = useCallback(async () => {
    if (!isDirty || savingRef.current) return;
    savingRef.current = true;
    try {
      if (editMode === 'shell') {
        const state = useDesignerStore.getState();
        if (!state.currentProjectId) return;
        const shellDef = state.getShellDefinition();
        await apiService.updateShell(state.currentProjectId, {
          name: shellDef.name,
          properties: shellDef.properties,
          controls: shellDef.controls,
          eventHandlers: shellDef.eventHandlers,
        });
        markClean();
        return;
      }

      if (!currentFormId) return;
      const state = useDesignerStore.getState();
      const nestedControls = sanitizeControls(nestControls(controls));
      const payload = {
        controls: nestedControls,
        properties: formProperties,
        eventHandlers: extractEventHandlers(controls),
        version: state.formVersion ?? undefined,
      };
      try {
        const result = await apiService.saveForm(currentFormId, payload);
        state.updateFormVersion(result.data.version);
        markClean();
      } catch (error) {
        // 버전 충돌 시 최신 version을 가져와 한 번 재시도
        if ((error as Error & { status?: number }).status === 409) {
          const { data: latest } = await apiService.loadForm(currentFormId);
          payload.version = latest.version;
          const result = await apiService.saveForm(currentFormId, payload);
          state.updateFormVersion(result.data.version);
          markClean();
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    } finally {
      savingRef.current = false;
    }
  }, [currentFormId, isDirty, controls, formProperties, markClean, editMode]);

  // store에서 직접 읽어 클로저 문제 없이 즉시 저장 (EventEditor 등에서 사용)
  const forceSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const state = useDesignerStore.getState();

      if (state.editMode === 'shell') {
        if (!state.currentProjectId) return;
        const shellDef = state.getShellDefinition();
        await apiService.updateShell(state.currentProjectId, {
          name: shellDef.name,
          properties: shellDef.properties,
          controls: shellDef.controls,
          eventHandlers: shellDef.eventHandlers,
        });
        state.markClean();
        return;
      }

      if (!state.currentFormId) return;
      const nestedControls = sanitizeControls(nestControls(state.controls));
      const payload = {
        controls: nestedControls,
        properties: state.formProperties,
        eventHandlers: extractEventHandlers(state.controls),
        version: state.formVersion ?? undefined,
      };
      try {
        const result = await apiService.saveForm(state.currentFormId, payload);
        state.updateFormVersion(result.data.version);
        state.markClean();
      } catch (error) {
        // 버전 충돌 시 최신 version을 가져와 한 번 재시도
        if ((error as Error & { status?: number }).status === 409) {
          const { data: latest } = await apiService.loadForm(state.currentFormId);
          payload.version = latest.version;
          const result = await apiService.saveForm(state.currentFormId, payload);
          state.updateFormVersion(result.data.version);
          state.markClean();
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    } finally {
      savingRef.current = false;
    }
  }, []);

  // 30초 인터벌 auto-save
  useEffect(() => {
    const hasTarget =
      editMode === 'shell'
        ? useDesignerStore.getState().currentProjectId != null
        : currentFormId != null;
    if (!hasTarget || !isDirty) return;

    timerRef.current = setTimeout(save, AUTO_SAVE_INTERVAL);
    return () => clearTimeout(timerRef.current);
  }, [currentFormId, isDirty, save, editMode]);

  return { save, forceSave };
}

// 타입 재export
export type {
  PaginationMeta,
  FormSummary,
  FormDocument,
  ProjectDocument,
  CreateFormPayload,
  UpdateFormPayload,
  CreateProjectPayload,
  ImportProjectPayload,
  ExportProjectData,
  ShellDocument,
  UpdateShellPayload,
  PublishAllResult,
  VersionSummary,
  FormVersionSnapshot,
};
