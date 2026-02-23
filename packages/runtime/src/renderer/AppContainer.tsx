import { useState, useEffect, useCallback, useRef } from 'react';
import type { FormDefinition, ApplicationShellDefinition } from '@webform/common';
import { SDUIRenderer } from './SDUIRenderer';
import { ShellRenderer } from './ShellRenderer';
import { apiClient } from '../communication/apiClient';
import { wsClient } from '../communication/wsClient';
import { setupPatchListener } from '../communication/patchApplier';
import { useRuntimeStore } from '../stores/runtimeStore';

interface AppContainerProps {
  projectId: string;
  initialFormId?: string;
}

export function AppContainer({ projectId, initialFormId }: AppContainerProps) {
  const [shellDef, setShellDefLocal] = useState<ApplicationShellDefinition | null>(null);
  const [formDefinition, setFormDefinition] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentFormIdRef = useRef<string | null>(null);
  const formDefRef = useRef<FormDefinition | null>(null);

  const applyPatches = useRuntimeStore((s) => s.applyPatches);
  const applyShellPatches = useRuntimeStore((s) => s.applyShellPatches);
  const setFormDef = useRuntimeStore((s) => s.setFormDef);
  const setShellDef = useRuntimeStore((s) => s.setShellDef);
  const pushFormHistory = useRuntimeStore((s) => s.pushFormHistory);
  const navigateRequest = useRuntimeStore((s) => s.navigateRequest);
  const clearNavigateRequest = useRuntimeStore((s) => s.clearNavigateRequest);
  const hasDialogs = useRuntimeStore((s) => s.dialogQueue.length > 0);

  // BeforeLeaving 이벤트 발생 (fire-and-forget)
  const fireBeforeLeaving = useCallback(() => {
    const def = formDefRef.current;
    if (!def) return;
    const handlers = def.eventHandlers.filter(
      (e) => e.controlId === def.id && e.eventName === 'BeforeLeaving',
    );
    if (handlers.length === 0) return;
    const formState = useRuntimeStore.getState().controlStates;
    for (const handler of handlers) {
      if (handler.handlerType === 'server') {
        apiClient
          .postEvent(def.id, {
            formId: def.id,
            controlId: def.id,
            eventName: 'BeforeLeaving',
            eventArgs: { type: 'BeforeLeaving', timestamp: Date.now() },
            formState,
          })
          .catch((err) => console.error('Form.BeforeLeaving handler error:', err));
      }
    }
  }, []);

  // Shell 모드에서 폼만 교체 (WS 재연결 없음)
  const loadFormInShell = useCallback(
    async (formId: string) => {
      fireBeforeLeaving();

      // 현재 폼을 히스토리에 추가 (뒤로가기용)
      if (currentFormIdRef.current) {
        pushFormHistory(currentFormIdRef.current);
      }

      try {
        const def = await apiClient.fetchForm(formId);
        setFormDefinition(def);
        setFormDef(def);
        formDefRef.current = def;
        currentFormIdRef.current = formId;

        // URL 업데이트 (formId 파라미터만 갱신, projectId 유지)
        const url = new URL(window.location.href);
        url.searchParams.set('formId', formId);
        window.history.pushState({}, '', url.toString());
      } catch (err) {
        console.error('Failed to load form in shell:', err);
      }
    },
    [setFormDef, pushFormHistory, fireBeforeLeaving],
  );

  // 초기 앱 로드 (Shell + startForm 일괄)
  useEffect(() => {
    let cancelled = false;

    async function loadApp() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.fetchApp(projectId, initialFormId);

        if (cancelled) return;

        // Shell 설정
        if (response.shell) {
          setShellDefLocal(response.shell);
          setShellDef(response.shell);
        }

        // 시작 폼 설정
        setFormDefinition(response.startForm);
        setFormDef(response.startForm);
        formDefRef.current = response.startForm;
        currentFormIdRef.current = response.startForm.id;

        // WebSocket: 프로젝트 단위 연결 (Shell 패치 + 폼 패치 모두 수신)
        wsClient.connectApp(projectId);
        setupPatchListener({ applyPatches, applyShellPatches }, wsClient);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadApp();

    return () => {
      cancelled = true;
      wsClient.disconnect();
    };
  }, [projectId, initialFormId, applyPatches, applyShellPatches, setFormDef, setShellDef]);

  // beforeunload 시 BeforeLeaving 이벤트
  useEffect(() => {
    const handleBeforeUnload = () => fireBeforeLeaving();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [fireBeforeLeaving]);

  // navigate 요청 처리 (Shell 모드: FormArea만 교체)
  useEffect(() => {
    if (!navigateRequest || hasDialogs) return;
    const { formId } = navigateRequest;
    clearNavigateRequest();

    if (formId && formId !== currentFormIdRef.current) {
      loadFormInShell(formId);
    }
  }, [navigateRequest, hasDialogs, clearNavigateRequest, loadFormInShell]);

  if (loading) {
    return <div style={{ padding: 20, fontFamily: 'Segoe UI, sans-serif' }}>로딩 중...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 20, fontFamily: 'Segoe UI, sans-serif', color: 'red' }}>
        오류: {error}
      </div>
    );
  }

  if (!formDefinition) {
    return (
      <div style={{ padding: 20, fontFamily: 'Segoe UI, sans-serif' }}>폼을 찾을 수 없습니다.</div>
    );
  }

  // Shell이 있으면 ShellRenderer로 감싸기
  if (shellDef) {
    return (
      <ShellRenderer shellDef={shellDef} projectId={projectId}>
        <SDUIRenderer formDefinition={formDefinition} />
      </ShellRenderer>
    );
  }

  // Shell 없으면 기존과 동일
  return <SDUIRenderer formDefinition={formDefinition} />;
}
