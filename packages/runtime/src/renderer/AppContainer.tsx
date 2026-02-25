import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import type { FormDefinition, ApplicationShellDefinition } from '@webform/common';
import { SDUIRenderer } from './SDUIRenderer';
import { ShellRenderer } from './ShellRenderer';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';
import { apiClient } from '../communication/apiClient';
import { wsClient } from '../communication/wsClient';
import { setupPatchListener } from '../communication/patchApplier';
import { useRuntimeStore } from '../stores/runtimeStore';
import { ensureAuthToken } from '../communication/authToken';

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
        // WebSocket 인증 토큰 확보
        await ensureAuthToken();

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

  // Shell 크기를 폼 크기 + 셸 크롬에 맞춰 자동 조정
  const adjustedShellDef = useMemo(() => {
    if (!shellDef || !formDefinition) return shellDef;

    const formProps = formDefinition.properties;
    // Maximized 폼은 shell을 채우므로 조정 불필요
    if (formProps.windowState === 'Maximized') return shellDef;

    const shellProps = shellDef.properties;

    // 폼 필요 크기 (폼 타이틀바 포함)
    const formTitleBarHeight = formProps.formBorderStyle !== 'None' ? 30 : 0;
    const formNeededWidth = formProps.width;
    const formNeededHeight = formProps.height + formTitleBarHeight;

    // 독 컨트롤 높이 합산
    let dockTopHeight = 0;
    let dockBottomHeight = 0;
    for (const ctrl of shellDef.controls) {
      if (ctrl.dock === 'Top') dockTopHeight += ctrl.size.height;
      else if (ctrl.dock === 'Bottom') dockBottomHeight += ctrl.size.height;
    }

    // Shell content 영역 >= dockTop + 폼 영역 + dockBottom
    const minContentHeight = dockTopHeight + formNeededHeight + dockBottomHeight;
    const newWidth = Math.max(shellProps.width, formNeededWidth);
    const newHeight = Math.max(shellProps.height, minContentHeight);

    if (newWidth === shellProps.width && newHeight === shellProps.height) {
      return shellDef;
    }

    return {
      ...shellDef,
      properties: { ...shellProps, width: newWidth, height: newHeight },
    };
  }, [shellDef, formDefinition]);

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

  // Shell이 있으면 ShellRenderer로 감싸기 (Shell 테마를 폼에 전파)
  if (adjustedShellDef) {
    return (
      <ThemeProvider themeId={adjustedShellDef.properties.theme}>
        <ShellPageBackground>
          <ShellRenderer shellDef={adjustedShellDef} projectId={projectId}>
            <SDUIRenderer
              formDefinition={formDefinition}
              enableDrag
              themeIdOverride={adjustedShellDef.properties.theme}
            />
          </ShellRenderer>
        </ShellPageBackground>
      </ThemeProvider>
    );
  }

  // Shell 없으면 기존과 동일
  return <SDUIRenderer formDefinition={formDefinition} />;
}

/** 셸 윈도우 외부 페이지 배경을 테마 색상으로 채우는 래퍼 */
function ShellPageBackground({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.form.backgroundColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  );
}
