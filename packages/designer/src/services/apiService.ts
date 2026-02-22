import { useEffect, useRef, useCallback } from 'react';
import { useDesignerStore } from '../stores/designerStore';
import type { ControlDefinition, FormProperties } from '@webform/common';

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
  eventHandlers: unknown[];
  dataBindings: unknown[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
}

interface ProjectDocument {
  _id: string;
  name: string;
  description: string;
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
  eventHandlers?: unknown[];
  dataBindings?: unknown[];
}

interface CreateProjectPayload {
  name: string;
  description?: string;
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

// --- HTTP 클라이언트 ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_BASE = ((import.meta as any).env?.VITE_API_URL as string | undefined) ?? '/api';

let authToken: string | null = null;

async function ensureAuth(): Promise<void> {
  if (authToken) return;
  const res = await fetch('/auth/dev-token', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to obtain dev token');
  const { token } = await res.json();
  authToken = token;
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
    throw new Error(error.error?.message ?? `API Error: ${res.status}`);
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
};

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
  return handlers;
}

// --- Auto-save 훅 ---

const AUTO_SAVE_INTERVAL = 30_000; // 30초

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const currentFormId = useDesignerStore((s) => s.currentFormId);
  const isDirty = useDesignerStore((s) => s.isDirty);
  const controls = useDesignerStore((s) => s.controls);
  const formProperties = useDesignerStore((s) => s.formProperties);
  const markClean = useDesignerStore((s) => s.markClean);

  const save = useCallback(async () => {
    if (!currentFormId || !isDirty) return;

    try {
      await apiService.saveForm(currentFormId, {
        controls,
        properties: formProperties,
        eventHandlers: extractEventHandlers(controls),
      });
      markClean();
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [currentFormId, isDirty, controls, formProperties, markClean]);

  // store에서 직접 읽어 클로저 문제 없이 즉시 저장 (EventEditor 등에서 사용)
  const forceSave = useCallback(async () => {
    const state = useDesignerStore.getState();
    if (!state.currentFormId) return;
    try {
      await apiService.saveForm(state.currentFormId, {
        controls: state.controls,
        properties: state.formProperties,
        eventHandlers: extractEventHandlers(state.controls),
      });
      state.markClean();
    } catch (error) {
      console.error('Save failed:', error);
    }
  }, []);

  // 30초 인터벌 auto-save
  useEffect(() => {
    if (!currentFormId || !isDirty) return;

    timerRef.current = setTimeout(save, AUTO_SAVE_INTERVAL);
    return () => clearTimeout(timerRef.current);
  }, [currentFormId, isDirty, save]);

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
};
