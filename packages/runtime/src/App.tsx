import { useState, useEffect, useCallback, useRef } from 'react';
import type { FormDefinition } from '@webform/common';
import { SDUIRenderer } from './renderer/SDUIRenderer';
import { AppContainer } from './renderer/AppContainer';
import { apiClient } from './communication/apiClient';
import { wsClient } from './communication/wsClient';
import { setupPatchListener } from './communication/patchApplier';
import { useRuntimeStore, type DialogMessage } from './stores/runtimeStore';

export function App() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('projectId');
  const formId = params.get('formId');

  // projectId가 있으면 Shell 모드 (AppContainer)
  if (projectId) {
    return (
      <>
        <AppContainer projectId={projectId} initialFormId={formId ?? undefined} />
        <MessageDialog />
      </>
    );
  }

  // formId만 있으면 기존 방식 (하위 호환)
  return <LegacyFormApp formId={formId} />;
}

// 기존 App 로직을 LegacyFormApp으로 이동
function LegacyFormApp({ formId: initialFormId }: { formId: string | null }) {
  const [formDefinition, setFormDefinition] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentFormIdRef = useRef<string | null>(null);
  const formDefRef = useRef<FormDefinition | null>(null);

  const applyPatches = useRuntimeStore((s) => s.applyPatches);
  const applyShellPatches = useRuntimeStore((s) => s.applyShellPatches);
  const setFormDef = useRuntimeStore((s) => s.setFormDef);
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

  const loadForm = useCallback(
    async (formId: string) => {
      // 이전 폼의 BeforeLeaving 이벤트 실행
      fireBeforeLeaving();

      setLoading(true);
      setError(null);

      // 기존 WebSocket 연결 해제
      wsClient.disconnect();

      try {
        const def = await apiClient.fetchForm(formId);
        setFormDefinition(def);
        setFormDef(def);
        formDefRef.current = def;
        currentFormIdRef.current = formId;

        // URL 업데이트 (히스토리에 추가)
        const url = new URL(window.location.href);
        url.searchParams.set('formId', formId);
        window.history.pushState({}, '', url.toString());

        // WebSocket 재연결
        wsClient.connect(formId);
        setupPatchListener({ applyPatches, applyShellPatches }, wsClient);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [applyPatches, applyShellPatches, setFormDef, fireBeforeLeaving],
  );

  // 초기 폼 로드
  useEffect(() => {
    if (!initialFormId) {
      setError('formId 파라미터가 필요합니다.');
      setLoading(false);
      return;
    }

    loadForm(initialFormId);

    return () => {
      wsClient.disconnect();
    };
  }, [initialFormId, loadForm]);

  // 브라우저 닫기/새로고침 시 BeforeLeaving 이벤트 실행
  useEffect(() => {
    const handleBeforeUnload = () => {
      fireBeforeLeaving();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [fireBeforeLeaving]);

  // navigate 요청 처리 — 다이얼로그가 모두 닫힌 후 실행
  useEffect(() => {
    if (!navigateRequest || hasDialogs) return;
    const { formId } = navigateRequest;
    clearNavigateRequest();

    if (formId && formId !== currentFormIdRef.current) {
      loadForm(formId);
    }
  }, [navigateRequest, hasDialogs, clearNavigateRequest, loadForm]);

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

  return (
    <div style={{ height: '100%' }}>
      <SDUIRenderer formDefinition={formDefinition} />
      <MessageDialog />
    </div>
  );
}

const dialogTypeConfig: Record<DialogMessage['dialogType'], { icon: string; color: string }> = {
  info: { icon: 'ℹ', color: '#0078d4' },
  warning: { icon: '⚠', color: '#d48a00' },
  error: { icon: '✕', color: '#d42020' },
  success: { icon: '✓', color: '#107c10' },
};

function MessageDialog() {
  const dialog = useRuntimeStore((s) => s.dialogQueue[0] ?? null);
  const dismissDialog = useRuntimeStore((s) => s.dismissDialog);

  const handleDismiss = useCallback(() => {
    dismissDialog();
  }, [dismissDialog]);

  useEffect(() => {
    if (!dialog) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        handleDismiss();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [dialog, handleDismiss]);

  if (!dialog) return null;

  const config = dialogTypeConfig[dialog.dialogType] ?? dialogTypeConfig.info;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        fontFamily: 'Segoe UI, sans-serif',
      }}
      onClick={handleDismiss}
    >
      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #d0d0d0',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          minWidth: 320,
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#f0f0f0',
            borderBottom: '1px solid #d0d0d0',
            fontSize: 13,
            fontWeight: 600,
            color: '#333',
          }}
        >
          {dialog.title || 'Message'}
        </div>

        {/* Body */}
        <div
          style={{
            padding: '16px 16px 20px',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <span style={{ fontSize: 22, color: config.color, lineHeight: 1, flexShrink: 0 }}>
            {config.icon}
          </span>
          <span style={{ fontSize: 13, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {dialog.text}
          </span>
        </div>

        {/* Button bar */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#f0f0f0',
            borderTop: '1px solid #d0d0d0',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              padding: '4px 24px',
              fontSize: 13,
              border: '1px solid #adadad',
              backgroundColor: '#e1e1e1',
              cursor: 'pointer',
              fontFamily: 'Segoe UI, sans-serif',
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
