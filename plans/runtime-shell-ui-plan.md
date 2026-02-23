# Runtime Shell UI 렌더링 및 앱 로딩 - 계획

## 1. 현재 App.tsx 분석

### URL 파라미터 처리
- `?formId=xxx` 파라미터만 지원
- formId 없으면 오류 표시 ("formId 파라미터가 필요합니다.")
- `loadForm(formId)` 호출 → `apiClient.fetchForm()` → `setFormDef()` → WebSocket 연결

### 폼 로딩 플로우
```
URL ?formId=xxx
  → useEffect에서 loadForm(formId)
  → apiClient.fetchForm(formId) → FormDefinition
  → setFormDefinition (local state) + setFormDef (store)
  → wsClient.connect(formId) + setupPatchListener()
  → <SDUIRenderer formDefinition={formDefinition} />
```

### 네비게이트 처리
- `navigateRequest` store 상태 감시
- 다이얼로그 큐가 비었을 때 `loadForm(formId)` 재호출
- `loadForm`이 BeforeLeaving 이벤트 → WS 끊기 → 새 폼 로드 → WS 재연결 전체 사이클 수행

### 핵심 제약
- 현재 `wsClient.connect(formId)` 는 폼별 WebSocket `/ws/runtime/:formId`
- Shell 모드에서는 `wsClient.connectApp(projectId)` 로 프로젝트별 WebSocket `/ws/runtime/app/:projectId` 사용 필요
- Shell 모드에서 폼 전환 시 WS 재연결 불필요 (프로젝트 단위 연결 유지)

---

## 2. AppContainer 컴포넌트 전체 코드 초안

### 파일: `packages/runtime/src/renderer/AppContainer.tsx`

```tsx
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
  initialFormId?: string;   // URL에서 직접 지정한 formId (선택)
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

  // BeforeLeaving 이벤트 (fire-and-forget) — 기존 App.tsx와 동일 패턴
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
    return <div style={{ padding: 20, fontFamily: 'Segoe UI, sans-serif' }}>폼을 찾을 수 없습니다.</div>;
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
```

### 설계 포인트
- `apiClient.fetchApp(projectId)` 한 번 호출로 Shell + startForm 일괄 로드
- Shell이 null이면 기존 SDUIRenderer만 렌더링 (하위 호환)
- WebSocket은 `wsClient.connectApp(projectId)`로 프로젝트 단위 연결 → 폼 전환 시 재연결 불필요
- `loadFormInShell`은 `apiClient.fetchForm(formId)` 만 호출 (WS 유지)
- formHistory 관리: 폼 전환 시 현재 폼ID를 `pushFormHistory`로 저장

---

## 3. ShellRenderer 컴포넌트 전체 코드 초안

### 파일: `packages/runtime/src/renderer/ShellRenderer.tsx`

```tsx
import { useEffect, useMemo, useCallback, type CSSProperties, type ReactNode } from 'react';
import type { ApplicationShellDefinition, ControlDefinition, EventArgs } from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { apiClient } from '../communication/apiClient';
import { runtimeControlRegistry } from '../controls/registry';
import { computeLayoutStyle, computeFontStyle } from './layoutUtils';

interface ShellRendererProps {
  shellDef: ApplicationShellDefinition;
  projectId: string;
  children: ReactNode;   // FormArea에 들어갈 콘텐츠 (SDUIRenderer)
}

const TITLE_BAR_HEIGHT = 30;

/**
 * Shell 컨트롤을 dock 위치별로 분류.
 * Shell에서는 주로 Top(MenuStrip, ToolStrip), Bottom(StatusStrip) 사용.
 */
function classifyShellControls(controls: ControlDefinition[]) {
  const dockTop: ControlDefinition[] = [];
  const dockBottom: ControlDefinition[] = [];
  const rest: ControlDefinition[] = [];

  for (const c of controls) {
    switch (c.dock) {
      case 'Top':
        dockTop.push(c);
        break;
      case 'Bottom':
        dockBottom.push(c);
        break;
      default:
        rest.push(c);
        break;
    }
  }
  return { dockTop, dockBottom, rest };
}

/**
 * Shell 컨트롤 렌더러.
 * Form의 ControlRenderer와 유사하지만 shellControlStates를 사용하고
 * 이벤트는 postShellEvent API를 호출한다.
 */
function ShellControlRenderer({
  definition,
  projectId,
  shellDef,
}: {
  definition: ControlDefinition;
  projectId: string;
  shellDef: ApplicationShellDefinition;
}) {
  const controlState = useRuntimeStore(
    (s) => s.shellControlStates[definition.id] ?? {},
  );
  const applyShellPatches = useRuntimeStore((s) => s.applyShellPatches);

  const Component = runtimeControlRegistry[definition.type];
  if (!Component) return null;

  const layoutStyle = computeLayoutStyle(definition);
  if (controlState.visible === false) return null;

  // Shell 이벤트 핸들러 생성
  const eventHandlers: Record<string, () => void> = {};

  const relevantEvents = shellDef.eventHandlers.filter(
    (e) => e.controlId === definition.id,
  );
  for (const evt of relevantEvents) {
    const propName = `on${evt.eventName}`;
    eventHandlers[propName] = async () => {
      const eventArgs: EventArgs = { type: evt.eventName, timestamp: Date.now() };
      try {
        const response = await apiClient.postShellEvent(projectId, {
          projectId,
          controlId: definition.id,
          eventName: evt.eventName,
          eventArgs,
          shellState: useRuntimeStore.getState().shellControlStates,
          currentFormId: useRuntimeStore.getState().currentFormDef?.id ?? '',
        });
        if (response.success && response.patches) {
          applyShellPatches(response.patches);
        }
      } catch (err) {
        console.error(`Shell event error [${definition.id}.${evt.eventName}]:`, err);
      }
    };
  }

  return (
    <Component
      id={definition.id}
      name={definition.name}
      {...controlState}
      {...eventHandlers}
      style={layoutStyle}
      enabled={controlState.enabled ?? definition.enabled}
    />
  );
}

export function ShellRenderer({ shellDef, projectId, children }: ShellRendererProps) {
  const setShellDef = useRuntimeStore((s) => s.setShellDef);
  const applyShellPatches = useRuntimeStore((s) => s.applyShellPatches);

  // Store에 Shell 정의 설정
  useEffect(() => {
    setShellDef(shellDef);
  }, [shellDef, setShellDef]);

  // Shell.Load 이벤트 실행
  useEffect(() => {
    const loadHandlers = shellDef.eventHandlers.filter(
      (e) => e.controlId === shellDef.id && e.eventName === 'Load',
    );
    if (loadHandlers.length === 0) return;

    for (const handler of loadHandlers) {
      if (handler.handlerType === 'server') {
        apiClient
          .postShellEvent(projectId, {
            projectId,
            controlId: shellDef.id,
            eventName: 'Load',
            eventArgs: { type: 'Load', timestamp: Date.now() },
            shellState: useRuntimeStore.getState().shellControlStates,
            currentFormId: useRuntimeStore.getState().currentFormDef?.id ?? '',
          })
          .then((response) => {
            if (response.success && response.patches) {
              applyShellPatches(response.patches);
            }
          })
          .catch((err) => console.error('Shell.Load handler error:', err));
      }
    }
  }, [shellDef.id, shellDef.eventHandlers, projectId, applyShellPatches]);

  const { dockTop, dockBottom, rest } = useMemo(
    () => classifyShellControls(shellDef.controls),
    [shellDef.controls],
  );

  const { properties } = shellDef;
  const fontStyles = computeFontStyle(properties.font);
  const showTitleBar = properties.showTitleBar;

  const containerStyle: CSSProperties = {
    width: properties.width,
    height: showTitleBar ? properties.height + TITLE_BAR_HEIGHT : properties.height,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    border: '1px solid #333333',
  };

  const contentStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: properties.backgroundColor || '#F0F0F0',
    overflow: 'hidden',
    ...fontStyles,
  };

  const formAreaStyle: CSSProperties = {
    flex: 1,
    position: 'relative',
    overflow: 'auto',
    minHeight: 0,
  };

  const renderShellControl = (ctrl: ControlDefinition) => (
    <ShellControlRenderer
      key={ctrl.id}
      definition={ctrl}
      projectId={projectId}
      shellDef={shellDef}
    />
  );

  return (
    <div className="wf-shell" style={containerStyle}>
      {/* 타이틀바 */}
      {showTitleBar && (
        <div
          style={{
            height: TITLE_BAR_HEIGHT,
            background: 'linear-gradient(to right, #0078D7, #005A9E)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            color: '#FFFFFF',
            fontSize: '12px',
            fontFamily: 'Segoe UI, sans-serif',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {properties.title}
          </span>
          {properties.minimizeBox && (
            <button style={windowBtnStyle} title="Minimize">&#x2500;</button>
          )}
          {properties.maximizeBox && (
            <button style={windowBtnStyle} title="Maximize">&#x25A1;</button>
          )}
          <button style={{ ...windowBtnStyle, fontWeight: 'bold' }} title="Close">&#x2715;</button>
        </div>
      )}

      <div style={contentStyle}>
        {/* Dock Top: MenuStrip, ToolStrip 등 */}
        {dockTop.map(renderShellControl)}

        {/* FormArea: 교체 가능한 폼 영역 */}
        <div className="wf-shell-form-area" style={formAreaStyle}>
          {children}
        </div>

        {/* Dock Bottom: StatusStrip 등 */}
        {dockBottom.map(renderShellControl)}
      </div>
    </div>
  );
}

const windowBtnStyle: CSSProperties = {
  width: 30,
  height: 30,
  border: 'none',
  background: 'transparent',
  color: '#FFFFFF',
  fontSize: '14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};
```

### 설계 포인트
- **레이아웃 구조**: `[TitleBar] → [DockTop(MenuStrip/ToolStrip)] → [FormArea] → [DockBottom(StatusStrip)]`
- **ShellControlRenderer**: Form의 `ControlRenderer`와 구분. `shellControlStates`를 사용하고 이벤트는 `apiClient.postShellEvent()` 호출
- **FormArea**: `children`으로 SDUIRenderer를 받아 렌더링. 폼 전환 시 children만 교체
- **Shell.Load 이벤트**: 마운트 시 서버에 Shell.Load 이벤트 전송
- Shell 컨트롤 상태는 `useRuntimeStore.shellControlStates`에서 읽기

---

## 4. App.tsx 변경 diff 초안

### 변경 요약
- URL 파라미터 분기: `projectId` → AppContainer, `formId` → 기존 방식
- MessageDialog를 App 레벨에서 공통 렌더링 (Shell 모드에서도 사용)

```tsx
// === App.tsx 변경 ===

import { AppContainer } from './renderer/AppContainer';
// 기존 import 유지...

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
  // 기존 App의 모든 state/effect/로직 그대로 이동
  // ...
  return (
    <>
      <SDUIRenderer formDefinition={formDefinition} />
      <MessageDialog />
    </>
  );
}

// MessageDialog는 그대로 유지
```

### 변경 최소화 전략
1. 기존 `App()` 함수의 폼 로딩 로직 전체를 `LegacyFormApp`으로 추출
2. `App()`은 URL 파라미터 분기만 담당하는 라우터 역할
3. `AppContainer`는 완전 신규 코드로 Shell + 앱 로딩 담당
4. `MessageDialog`는 변경 없이 App 레벨에서 공통 렌더링

---

## 5. 폼 전환 시 Shell 유지 로직 설계

### 폼 전환 시나리오

```
[Shell 렌더링 유지]
├── MenuStrip (dock: Top)     ← 유지
├── ToolStrip (dock: Top)     ← 유지
├── FormArea                  ← 폼만 교체
│   ├── 폼A → (navigate) → 폼B
│   └── SDUIRenderer props 변경 → 리렌더링
└── StatusStrip (dock: Bottom) ← 유지
```

### 핵심 메커니즘

1. **Shell navigate 패치 수신**: `applyShellPatches`에서 `navigate` 패치 처리 → `navigateRequest` 설정
2. **AppContainer에서 감지**: `navigateRequest` 상태 변경 감시 → `loadFormInShell(formId)` 호출
3. **loadFormInShell**:
   - `fireBeforeLeaving()` — 이전 폼의 BeforeLeaving 이벤트
   - `pushFormHistory(currentFormId)` — 뒤로가기용 히스토리 저장
   - `apiClient.fetchForm(formId)` — 새 폼 로드
   - `setFormDefinition(newDef)` + `setFormDef(newDef)` — 상태 갱신
   - URL `formId` 파라미터 업데이트
   - **WS 재연결 안 함** — 프로젝트 단위 연결 유지
4. **SDUIRenderer 리렌더링**: `formDefinition` prop 변경 → SDUIRenderer가 새 폼 렌더링

### 뒤로가기 처리
- Shell 패치에서 `navigate({ back: true })` 수신
- `applyShellPatches` → `formHistory.pop()` → `navigateRequest` 설정
- AppContainer에서 동일하게 `loadFormInShell` 호출

### Shell.FormChanged 이벤트
- `loadFormInShell` 완료 후 Shell.FormChanged 이벤트 발생 고려
- 구현: `loadFormInShell`에서 폼 로드 성공 후 `apiClient.postShellEvent(projectId, { eventName: 'FormChanged', ... })` 호출

---

## 6. Shell 컨트롤 이벤트 처리 흐름

### 이벤트 흐름 다이어그램

```
사용자 클릭 (MenuStrip 메뉴 항목)
  → ShellControlRenderer의 이벤트 핸들러 호출
  → apiClient.postShellEvent(projectId, {
      projectId,
      controlId: 'menuStrip1',
      eventName: 'ItemClicked',
      eventArgs: { type: 'ItemClicked', timestamp: ... },
      shellState: store.shellControlStates,
      currentFormId: store.currentFormDef.id,
    })
  → 서버: ShellEventEngine 실행
  → 응답: EventResponse { success, patches }
  → applyShellPatches(patches)
    ├── updateShell → Shell 컨트롤 상태 변경
    ├── updateAppState → 앱 공유 상태 변경
    ├── navigate → navigateRequest 설정 → 폼 전환
    ├── showDialog → 다이얼로그 표시
    └── closeApp → 앱 종료
```

### 이벤트 타입별 처리

| 이벤트 소스 | 이벤트명 | API | 패치 적용 |
|------------|---------|-----|----------|
| Shell 자체 | Load | postShellEvent | applyShellPatches |
| Shell 자체 | FormChanged | postShellEvent | applyShellPatches |
| MenuStrip | ItemClicked | postShellEvent | applyShellPatches |
| ToolStrip | ItemClicked | postShellEvent | applyShellPatches |
| StatusStrip | ItemClicked | postShellEvent | applyShellPatches |
| 폼 컨트롤 | 각종 이벤트 | postEvent (기존) | applyPatches (기존) |

### WebSocket 패치 라우팅
- 서버에서 `scope: 'shell'` → `applyShellPatches` (patchApplier.ts에 이미 구현됨)
- 서버에서 `scope: 'form'` 또는 미지정 → `applyPatches` (기존)

---

## 7. 파일별 변경 목록

| 파일 | 작업 | 설명 |
|------|------|------|
| `renderer/AppContainer.tsx` | **신규** | 앱 컨테이너. Shell+폼 로딩, 폼 전환 관리 |
| `renderer/ShellRenderer.tsx` | **신규** | Shell 레이아웃 렌더링, Shell 컨트롤 이벤트 처리 |
| `App.tsx` | **수정** | URL 파라미터 분기 (projectId → AppContainer, formId → 기존) |
| `renderer/SDUIRenderer.tsx` | **변경 없음** | 기존 코드 그대로 사용 가능 |

### SDUIRenderer 변경 불필요 근거
- SDUIRenderer는 `formDefinition` prop만 받아서 렌더링
- Shell 모드와 독립 모드 모두 동일한 `FormDefinition`을 전달
- 이벤트 핸들링은 `useEventHandlers` 훅에서 `apiClient.postEvent`로 기존대로 동작
- controlStates도 기존 store의 `controlStates`를 그대로 사용

---

## 8. 리스크 및 고려사항

### FormChanged 이벤트 타이밍
- `loadFormInShell`에서 폼 로드 성공 후 `FormChanged` 이벤트를 보내야 하지만, 이는 구현 단계에서 별도 처리 가능
- 첫 구현에서는 `loadFormInShell` 마지막에 fire-and-forget으로 `postShellEvent({ eventName: 'FormChanged' })` 호출

### Shell 컨트롤이 폼 controlStates와 분리
- Shell 컨트롤은 `shellControlStates`에, 폼 컨트롤은 `controlStates`에 저장
- `ShellControlRenderer`는 `s.shellControlStates[id]`를 구독
- Form의 `ControlRenderer`는 기존대로 `s.controlStates[id]` 구독
- ID 충돌 가능성 없음 (분리된 네임스페이스)

### ToolStrip/MenuStrip의 updateControlState 호출
- 현재 MenuStrip, ToolStrip, StatusStrip은 내부에서 `useRuntimeStore(s => s.updateControlState)`를 호출
- Shell 모드에서는 `updateShellControlState`를 사용해야 함
- **해결**: ShellControlRenderer에서 props로 override하거나, Shell 모드 감지를 위한 context 추가 필요
- **구현 방안**: ShellControlRenderer에서 `updateControlState`를 래핑하여 `updateShellControlState`로 위임하는 props 주입. 또는 별도의 React Context로 "현재 shell 모드인지" 전달

### 선택한 접근: useShellMode Context
```tsx
// ShellRenderer 내부에서 ShellModeProvider 제공
// MenuStrip 등에서 useShellMode() 호출 → shell이면 updateShellControlState 사용
// 또는 더 간단하게: ShellControlRenderer에서 override props 전달
```

**간단한 방안 채택**: `ShellControlRenderer`에서 `onItemClicked` 등 이벤트를 직접 핸들링하므로, 컨트롤 내부의 `updateControlState` 호출은 Shell 모드에서도 `controlStates`에 쓰이지만 즉시 `postShellEvent` 결과로 `shellControlStates`에 덮어씌워짐. 다만 이는 일시적 불일치를 만들 수 있으므로, 추후 리팩토링 대상으로 기록.

**최종 결정**: 첫 구현에서는 ShellControlRenderer가 이벤트 핸들러를 직접 제공하고, 컨트롤 내부의 `updateControlState`는 무시 가능한 수준으로 둔다. Shell 컨트롤의 상태 업데이트는 서버에서 `updateShell` 패치로 내려오는 것이 정상 흐름이므로 큰 문제 없음.
