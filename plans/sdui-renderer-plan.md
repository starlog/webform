# SDUI 런타임 렌더러 구현 계획

## 1. 개요

`@webform/runtime` 패키지의 핵심인 SDUI 런타임 렌더러를 구현한다. 서버에서 수신한 `FormDefinition` JSON을 React 컴포넌트 트리로 변환하여 WinForm 스타일의 폼을 브라우저에서 실행한다.

PRD.md 섹션 4.2.1(SDUI 렌더러), 4.2.2(서버-클라이언트 이벤트 통신), 4.2.3(WinForm 룩앤필)을 기반으로 설계한다.

### 1.1 의존성

- `@webform/common` (workspace): FormDefinition, ControlDefinition, UIPatch, EventHandlerDefinition 등 공통 타입
- `react@^18.3.0`, `react-dom@^18.3.0`
- `zustand@^5.0.0` (상태 관리)
- 추가 의존성: `immer` (Zustand 미들웨어, 불변 상태 업데이트)

### 1.2 기존 runtime 패키지 상태

현재 `packages/runtime/`에는 모노레포 초기 셋업 파일만 존재:
- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- `src/main.tsx` (빈 React 앱)
- `vitest.config.ts`, `src/test-setup.ts`

---

## 2. 파일 구조

```
packages/runtime/src/
├── stores/
│   └── runtimeStore.ts              # Zustand 폼 상태 관리
├── renderer/
│   ├── SDUIRenderer.tsx             # 메인 렌더러 (FormDefinition → React 트리)
│   ├── ControlRenderer.tsx          # 재귀 컨트롤 렌더링
│   ├── FormContainer.tsx            # 폼 컨테이너 + WinForm 제목 표시줄
│   └── layoutUtils.ts              # 레이아웃 계산 (position, anchor, dock)
├── controls/
│   ├── Button.tsx                   # 버튼
│   ├── TextBox.tsx                  # 텍스트 입력
│   ├── Label.tsx                    # 레이블
│   ├── CheckBox.tsx                 # 체크박스
│   ├── ComboBox.tsx                 # 콤보박스 (드롭다운)
│   ├── Panel.tsx                    # 패널 (컨테이너)
│   ├── GroupBox.tsx                 # 그룹박스 (제목 있는 컨테이너)
│   ├── TabControl.tsx               # 탭 컨트롤
│   └── registry.ts                  # runtimeControlRegistry
├── hooks/
│   ├── useEventHandlers.ts          # client/server 이벤트 핸들러 훅
│   └── useDataBinding.ts            # 데이터 바인딩 훅 (초기 stub)
├── communication/
│   ├── apiClient.ts                 # REST API 클라이언트
│   ├── wsClient.ts                  # WebSocket 클라이언트
│   └── patchApplier.ts             # UIPatch → runtimeStore 적용
├── App.tsx                          # 메인 앱 (formId로 폼 로드)
└── main.tsx                         # React 18 진입점 (기존 파일 수정)
```

---

## 3. 폼 상태 관리 — `runtimeStore.ts`

### 3.1 스토어 인터페이스

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { FormDefinition, ControlDefinition, UIPatch } from '@webform/common';

interface RuntimeState {
  // 상태
  currentFormDef: FormDefinition | null;
  controlStates: Record<string, Record<string, unknown>>;
  // controlId → { text: 'hello', checked: true, ... }

  // 액션
  setFormDef: (def: FormDefinition) => void;
  updateControlState: (controlId: string, property: string, value: unknown) => void;
  getControlState: (controlId: string) => Record<string, unknown>;
  applyPatch: (patch: UIPatch) => void;
  applyPatches: (patches: UIPatch[]) => void;
}
```

### 3.2 주요 동작

| 액션 | 설명 |
|------|------|
| `setFormDef(def)` | FormDefinition 로드 + 각 컨트롤의 초기 `properties`를 `controlStates`로 복사 |
| `updateControlState(id, prop, val)` | 특정 컨트롤의 특정 속성 업데이트 (사용자 입력 등) |
| `getControlState(id)` | 컨트롤의 현재 상태 반환 (ControlRenderer에서 사용) |
| `applyPatch(patch)` | 단일 UIPatch 적용 |
| `applyPatches(patches)` | UIPatch 배열을 순서대로 적용 |

### 3.3 setFormDef 초기화 로직

```typescript
setFormDef: (def) => set((state) => {
  state.currentFormDef = def;
  state.controlStates = {};

  // 모든 컨트롤의 properties를 controlStates로 초기화
  const initControls = (controls: ControlDefinition[]) => {
    for (const ctrl of controls) {
      state.controlStates[ctrl.id] = {
        ...ctrl.properties,
        visible: ctrl.visible,
        enabled: ctrl.enabled,
      };
      if (ctrl.children) {
        initControls(ctrl.children);
      }
    }
  };
  initControls(def.controls);
});
```

### 3.4 applyPatch 로직

```typescript
applyPatch: (patch) => set((state) => {
  switch (patch.type) {
    case 'updateProperty': {
      // target = controlId, payload = { text: '새값', foreColor: 'red' }
      const controlState = state.controlStates[patch.target];
      if (controlState) {
        Object.assign(controlState, patch.payload);
      }
      break;
    }
    case 'addControl': {
      // payload에 ControlDefinition 포함
      // currentFormDef.controls에 추가 + controlStates 초기화
      const newControl = patch.payload as unknown as ControlDefinition;
      if (state.currentFormDef) {
        // target이 부모 controlId면 해당 children에, 아니면 최상위에 추가
        // (구현 시 재귀 탐색 필요)
        state.currentFormDef.controls.push(newControl);
        state.controlStates[newControl.id] = {
          ...newControl.properties,
          visible: newControl.visible,
          enabled: newControl.enabled,
        };
      }
      break;
    }
    case 'removeControl': {
      // target = controlId
      delete state.controlStates[patch.target];
      // currentFormDef.controls에서도 재귀 제거
      if (state.currentFormDef) {
        const removeFromList = (controls: ControlDefinition[]): ControlDefinition[] =>
          controls.filter(c => {
            if (c.id === patch.target) return false;
            if (c.children) c.children = removeFromList(c.children);
            return true;
          });
        state.currentFormDef.controls = removeFromList(state.currentFormDef.controls);
      }
      break;
    }
    case 'showDialog':
    case 'navigate':
      // Phase 2에서 구현 (현재는 console.warn)
      console.warn(`Patch type '${patch.type}' not yet implemented`, patch.payload);
      break;
  }
});
```

---

## 4. 레이아웃 유틸리티 — `layoutUtils.ts`

### 4.1 computeLayoutStyle

`ControlDefinition`의 `position`, `size`, `dock` 정보를 CSS로 변환한다.

```typescript
function computeLayoutStyle(def: ControlDefinition): React.CSSProperties
```

**Dock 우선 로직**: `dock !== 'None'`이면 Dock 스타일 우선 적용, 아니면 절대 좌표 사용.

| dock 값 | CSS 결과 |
|---------|---------|
| `'None'` | `{ position: 'absolute', left: x, top: y, width: w, height: h }` |
| `'Top'` | `{ position: 'absolute', top: 0, left: 0, right: 0, height: h }` |
| `'Bottom'` | `{ position: 'absolute', bottom: 0, left: 0, right: 0, height: h }` |
| `'Left'` | `{ position: 'absolute', top: 0, left: 0, bottom: 0, width: w }` |
| `'Right'` | `{ position: 'absolute', top: 0, right: 0, bottom: 0, width: w }` |
| `'Fill'` | `{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }` |

### 4.2 computeAnchorStyle

리사이즈 시 컨트롤이 부모 경계에 고정되는 방식을 계산한다.

```typescript
function computeAnchorStyle(
  def: ControlDefinition,
  parentSize: { width: number; height: number }
): React.CSSProperties
```

**Anchor 조합별 동작**:

| anchor | 동작 |
|--------|------|
| `{ top: true, left: true }` (기본값) | 고정 위치 — left/top px |
| `{ top: true, left: true, right: true }` | 가로 늘어남 — left px, right = parentW - (x + w) |
| `{ top: true, left: true, bottom: true }` | 세로 늘어남 — top px, bottom = parentH - (y + h) |
| `{ all: true }` | 양방향 늘어남 |
| `{ bottom: true, right: true }` | 우하단 고정 — right/bottom px |

**계산 공식**:
- `anchor.left` → `left: x px`
- `anchor.right` → `right: (parentWidth - x - width) px`
- `anchor.top` → `top: y px`
- `anchor.bottom` → `bottom: (parentHeight - y - height) px`
- `anchor.left && anchor.right` → `left + right` (width 자동)
- `anchor.top && anchor.bottom` → `top + bottom` (height 자동)

### 4.3 computeFontStyle

`FontDefinition`을 CSS로 변환한다.

```typescript
function computeFontStyle(font: FontDefinition): React.CSSProperties {
  return {
    fontFamily: font.family,
    fontSize: `${font.size}pt`,
    fontWeight: font.bold ? 'bold' : 'normal',
    fontStyle: font.italic ? 'italic' : 'normal',
    textDecoration: [
      font.underline ? 'underline' : '',
      font.strikethrough ? 'line-through' : '',
    ].filter(Boolean).join(' ') || 'none',
  };
}
```

---

## 5. 핵심 컴포넌트

### 5.1 FormContainer

폼의 외관을 구성한다. WinForm의 창(window) 모양을 CSS로 에뮬레이션한다.

```typescript
interface FormContainerProps {
  properties: FormProperties;
  children: React.ReactNode;
}
```

**구조**:
```
┌────────────────────────────────────────┐
│ ■ 사용자 편집        ─ □ ✕            │  ← 제목 표시줄 (height: 30px)
├────────────────────────────────────────┤
│                                        │
│  (controls area - position: relative)  │  ← 콘텐츠 영역
│                                        │
│  [Label]  [TextBox              ]      │
│  [Button]                              │
│                                        │
└────────────────────────────────────────┘
```

**주요 속성 매핑**:

| FormProperties | CSS/동작 |
|---------------|---------|
| `width`, `height` | 전체 컨테이너 크기 |
| `backgroundColor` | 콘텐츠 영역 배경색 |
| `font` | `computeFontStyle` → 콘텐츠 영역 기본 폰트 |
| `title` | 제목 표시줄 텍스트 |
| `formBorderStyle` | 테두리 스타일 (`None`: 없음, `FixedSingle`: 1px solid, `Fixed3D`: inset border, `Sizable`: resize 가능) |
| `minimizeBox` / `maximizeBox` | 해당 버튼 표시 여부 |

**제목 표시줄 스타일링**:
- 배경: 선형 그라데이션 (Windows 클래식 블루 `#0078D7`)
- 텍스트: 흰색, 좌측 패딩
- 버튼: `─` (최소화), `□` (최대화), `✕` (닫기) — 현재 시각적만 구현, 동작은 Phase 2

### 5.2 SDUIRenderer

최상위 렌더러 컴포넌트. `FormDefinition`을 받아 `FormContainer` + `ControlRenderer` 트리를 구성한다.

```typescript
interface SDUIRendererProps {
  formDefinition: FormDefinition;
}
```

**렌더링 흐름**:
1. `formDefinition`을 `runtimeStore.setFormDef()`으로 초기화
2. `FormContainer`로 폼 외관 구성
3. `formDefinition.controls`를 순회하며 `ControlRenderer` 생성
4. `useEffect`로 `Form.Load` 이벤트 핸들러 실행

```tsx
function SDUIRenderer({ formDefinition }: SDUIRendererProps) {
  const setFormDef = useRuntimeStore(s => s.setFormDef);

  useEffect(() => {
    setFormDef(formDefinition);
  }, [formDefinition.id]);

  return (
    <FormContainer properties={formDefinition.properties}>
      {formDefinition.controls.map(control => (
        <ControlRenderer
          key={control.id}
          definition={control}
          bindings={formDefinition.dataBindings}
          events={formDefinition.eventHandlers}
        />
      ))}
    </FormContainer>
  );
}
```

### 5.3 ControlRenderer

개별 컨트롤을 재귀적으로 렌더링한다.

```typescript
interface ControlRendererProps {
  definition: ControlDefinition;
  bindings: DataBindingDefinition[];
  events: EventHandlerDefinition[];
}
```

**렌더링 흐름**:
1. `runtimeControlRegistry`에서 `definition.type`에 대응하는 React 컴포넌트 조회
2. `useDataBinding(definition.id, bindings)`로 바인딩 값 계산
3. `useEventHandlers(definition.id, events)`로 이벤트 핸들러 맵 생성
4. `runtimeStore.getControlState(definition.id)`로 현재 상태 조회
5. `computeLayoutStyle(definition)`으로 CSS 계산
6. 컴포넌트 렌더링 + `children` 재귀 처리

```tsx
function ControlRenderer({ definition, bindings, events }: ControlRendererProps) {
  const Component = runtimeControlRegistry[definition.type];
  if (!Component) {
    console.warn(`Unknown control type: ${definition.type}`);
    return null;
  }

  const controlState = useRuntimeStore(s => s.controlStates[definition.id] ?? {});
  const boundProps = useDataBinding(definition.id, bindings);
  const eventHandlers = useEventHandlers(definition.id, events);
  const layoutStyle = computeLayoutStyle(definition);

  // visible이 false면 렌더링하지 않음
  if (controlState.visible === false) return null;

  return (
    <Component
      id={definition.id}
      name={definition.name}
      {...controlState}         // runtimeStore의 동적 상태
      {...boundProps}           // 데이터 바인딩 값 (오버라이드)
      {...eventHandlers}        // 이벤트 핸들러 맵 { onClick, onTextChanged, ... }
      style={layoutStyle}
      enabled={controlState.enabled ?? definition.enabled}
    >
      {definition.children?.map(child => (
        <ControlRenderer
          key={child.id}
          definition={child}
          bindings={bindings}
          events={events}
        />
      ))}
    </Component>
  );
}
```

---

## 6. 런타임 컨트롤 구현체

### 6.1 공통 Props 인터페이스

```typescript
interface RuntimeControlProps {
  id: string;
  name: string;
  style?: React.CSSProperties;
  enabled?: boolean;
  children?: React.ReactNode;     // 컨테이너 컨트롤용
  [key: string]: unknown;         // 동적 속성
}
```

### 6.2 컨트롤별 구현

#### Button.tsx
- `text` → 버튼 레이블
- `onClick` → 클릭 이벤트 (eventHandlers에서 주입)
- WinForm 스타일: 회색 배경, 3D 테두리 (`outset border`)

#### TextBox.tsx
- `text` → 입력값 (`value`)
- `multiline` → `<textarea>` / `<input type="text">` 분기
- `readOnly` → 읽기 전용
- 입력 시 `runtimeStore.updateControlState(id, 'text', newValue)` 호출
- `onTextChanged` 이벤트 발생 (eventHandlers에서 주입)

#### Label.tsx
- `text` → 텍스트 표시
- `foreColor` → CSS color
- `textAlign` → CSS text-align

#### CheckBox.tsx
- `checked` → 체크 상태
- `text` → 레이블 텍스트
- 클릭 시 `updateControlState(id, 'checked', !checked)` + `onCheckedChanged` 발생

#### ComboBox.tsx
- `items` → 선택 목록 (`string[]`)
- `selectedIndex` → 현재 선택 인덱스
- 변경 시 `updateControlState(id, 'selectedIndex', newIndex)` + `onSelectedIndexChanged` 발생

#### Panel.tsx (컨테이너)
- `position: relative`인 div
- `borderStyle` → CSS border
- `children`을 내부에 렌더링

#### GroupBox.tsx (컨테이너)
- HTML `<fieldset>` + `<legend>` 활용
- `text` → legend 텍스트
- `children`을 내부에 렌더링

#### TabControl.tsx (컨테이너)
- `tabPages` → `{ title: string, children: ControlDefinition[] }[]`
- 탭 헤더 + 선택된 탭 페이지만 렌더링
- `selectedIndex` 상태 관리
- `onSelectedIndexChanged` 이벤트 발생

### 6.3 컨트롤 레지스트리 — `registry.ts`

```typescript
import type { ControlType } from '@webform/common';
import type { ComponentType } from 'react';

import { Button } from './Button';
import { TextBox } from './TextBox';
import { Label } from './Label';
import { CheckBox } from './CheckBox';
import { ComboBox } from './ComboBox';
import { Panel } from './Panel';
import { GroupBox } from './GroupBox';
import { TabControl } from './TabControl';

export const runtimeControlRegistry: Partial<Record<ControlType, ComponentType<any>>> = {
  Button,
  TextBox,
  Label,
  CheckBox,
  ComboBox,
  Panel,
  GroupBox,
  TabControl,
};
```

**참고**: 25종 컨트롤 중 Phase 3 첫 구현에서는 핵심 8종만 구현. 미등록 컨트롤은 `ControlRenderer`에서 `console.warn` + `null` 반환.

---

## 7. 훅 설계

### 7.1 useEventHandlers

```typescript
function useEventHandlers(
  controlId: string,
  events: EventHandlerDefinition[]
): Record<string, (args?: Partial<EventArgs>) => void>
```

**동작**:
1. `events`에서 `controlId`와 일치하는 핸들러 필터링
2. 각 핸들러를 `handlerType`에 따라 분기:

#### Client 이벤트 (로컬 실행)
```typescript
// handlerType === 'client'
const handler = (args?: Partial<EventArgs>) => {
  const ctx = createFormContext(controlId, runtimeStore);
  const fn = new Function('sender', 'e', 'ctx', handlerCode);
  fn(controlProxy, { type: eventName, timestamp: Date.now(), ...args }, ctx);
};
```

- `new Function` 생성자로 코드 실행
- `FormContext` 객체를 `ctx` 매개변수로 전달
- `sender`는 해당 컨트롤의 프록시 객체
- **보안 고려**: 클라이언트 코드는 사용자가 작성한 코드이므로, 서버 코드보다 신뢰도가 높음. 단, XSS 방지를 위해 DOM 직접 접근은 제한

#### Server 이벤트 (서버 전송)
```typescript
// handlerType === 'server'
const handler = async (args?: Partial<EventArgs>) => {
  const eventRequest: EventRequest = {
    formId: runtimeStore.currentFormDef!.id,
    controlId,
    eventName,
    eventArgs: { type: eventName, timestamp: Date.now(), ...args },
    formState: runtimeStore.controlStates,  // 전체 폼 상태 스냅샷
  };

  const response = await apiClient.postEvent(
    runtimeStore.currentFormDef!.id,
    eventRequest
  );

  if (response.success && response.patches) {
    runtimeStore.applyPatches(response.patches);
  }
};
```

#### 이벤트명 → React prop 매핑

| WinForm 이벤트 | React prop |
|----------------|-----------|
| `Click` | `onClick` |
| `DoubleClick` | `onDoubleClick` |
| `TextChanged` | `onTextChanged` |
| `CheckedChanged` | `onCheckedChanged` |
| `SelectedIndexChanged` | `onSelectedIndexChanged` |
| `ValueChanged` | `onValueChanged` |
| `KeyDown` | `onKeyDown` |
| `KeyUp` | `onKeyUp` |
| `MouseEnter` | `onMouseEnter` |
| `MouseLeave` | `onMouseLeave` |
| `Enter` (Focus) | `onFocus` |
| `Leave` (Blur) | `onBlur` |

변환 규칙: `eventName` → `'on' + eventName` (예: `'Click'` → `'onClick'`)

### 7.2 useDataBinding (초기 stub)

```typescript
function useDataBinding(
  controlId: string,
  bindings: DataBindingDefinition[]
): Record<string, unknown>
```

**Phase 3 초기 구현**: 바인딩 정의만 인식하되, 실제 데이터 로드는 하지 않는 stub.

```typescript
function useDataBinding(controlId: string, bindings: DataBindingDefinition[]) {
  // controlId에 해당하는 바인딩 필터링
  const relevantBindings = bindings.filter(b => b.controlId === controlId);

  // 현재는 빈 객체 반환 (데이터소스 서비스 구현 후 활성화)
  // TODO: DataSource 서비스 연동 시 실제 데이터 바인딩 구현
  return {};
}
```

---

## 8. 서버 통신

### 8.1 apiClient.ts

```typescript
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async fetchForm(formId: string): Promise<FormDefinition> {
    const res = await fetch(`${this.baseUrl}/runtime/forms/${formId}`);
    if (!res.ok) throw new Error(`Failed to fetch form: ${res.status}`);
    return res.json();
  }

  async postEvent(formId: string, payload: EventRequest): Promise<EventResponse> {
    const res = await fetch(`${this.baseUrl}/runtime/forms/${formId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Event request failed: ${res.status}`);
    return res.json();
  }
}

// 싱글턴 export
export const apiClient = new ApiClient();
```

### 8.2 wsClient.ts

```typescript
type WsEventCallback = (message: RuntimeWsMessage) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private listeners: WsEventCallback[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(formId: string): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/runtime/${formId}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data) as RuntimeWsMessage;
      this.listeners.forEach(cb => cb(message));
    };

    this.ws.onclose = () => {
      // 자동 재연결 (5초 후)
      this.reconnectTimer = setTimeout(() => this.connect(formId), 5000);
    };
  }

  onMessage(callback: WsEventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new WsClient();
```

### 8.3 patchApplier.ts

WebSocket으로 수신된 `RuntimeWsMessage`를 `runtimeStore`에 적용한다.

```typescript
import type { RuntimeWsMessage } from '@webform/common';

function setupPatchListener(runtimeStore: RuntimeStore, wsClient: WsClient): () => void {
  return wsClient.onMessage((message) => {
    switch (message.type) {
      case 'uiPatch':
        runtimeStore.applyPatches(message.payload);
        break;
      case 'dataRefresh':
        // TODO: 데이터소스 서비스 연동 시 구현
        console.log('dataRefresh received:', message.payload);
        break;
      case 'error':
        console.error('Server error:', message.payload);
        break;
      case 'eventResult':
        // REST로 이미 처리되지만, WS 방식에서도 대비
        if (message.payload.patches) {
          runtimeStore.applyPatches(message.payload.patches);
        }
        break;
    }
  });
}
```

---

## 9. App.tsx 및 진입점

### 9.1 App.tsx

```typescript
function App() {
  const [formDefinition, setFormDefinition] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const formId = params.get('formId');

    if (!formId) {
      setError('formId 파라미터가 필요합니다.');
      setLoading(false);
      return;
    }

    apiClient.fetchForm(formId)
      .then(setFormDefinition)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">로딩 중...</div>;
  if (error) return <div className="error">오류: {error}</div>;
  if (!formDefinition) return <div>폼을 찾을 수 없습니다.</div>;

  return <SDUIRenderer formDefinition={formDefinition} />;
}
```

### 9.2 main.tsx (기존 파일 수정)

```typescript
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

---

## 10. 서버-클라이언트 이벤트 흐름 상세

```
┌─────────────────────────────────────────────────────┐
│ 1. 사용자 액션 (버튼 클릭, 텍스트 입력 등)          │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │ handlerType?   │
         └───┬────────┬───┘
             │        │
      client │        │ server
             │        │
             ▼        ▼
  ┌──────────────┐ ┌──────────────────────────────────┐
  │ 2a. 로컬 실행│ │ 2b. EventRequest 생성            │
  │  new Function│ │  formState 스냅샷 포함           │
  │  ctx 주입    │ │                                  │
  └──────────────┘ └──────────────┬───────────────────┘
                                  │
                                  ▼
                   ┌──────────────────────────────────┐
                   │ 3. POST /api/runtime/forms/:id/  │
                   │    events                        │
                   └──────────────┬───────────────────┘
                                  │
                                  ▼
                   ┌──────────────────────────────────┐
                   │ 4. 서버: EventEngine 실행        │
                   │    (isolated-vm 샌드박스)         │
                   │    → UIPatch[] 생성              │
                   └──────────────┬───────────────────┘
                                  │
                                  ▼
                   ┌──────────────────────────────────┐
                   │ 5. EventResponse 반환            │
                   │    { success, patches }           │
                   └──────────────┬───────────────────┘
                                  │
                                  ▼
                   ┌──────────────────────────────────┐
                   │ 6. runtimeStore.applyPatches()   │
                   │    → React 리렌더링              │
                   └──────────────────────────────────┘
```

---

## 11. WinForm 룩앤필 (PRD 4.2.3)

### 11.1 기본 테마 (Windows Classic)

Phase 3 초기에는 Windows Classic 스타일 하나만 구현한다.

| 요소 | 스타일 |
|------|--------|
| 폼 배경 | `#F0F0F0` (Control 색상) |
| 제목 표시줄 | 그라데이션 파란색 `#0078D7` → `#005A9E` |
| 버튼 | 회색 배경 `#E1E1E1`, 1px outset 테두리 |
| 텍스트박스 | 흰색 배경, 1px inset 테두리 |
| 체크박스 | 16×16 체크 영역 + 레이블 |
| 콤보박스 | 드롭다운 화살표 포함 |
| 패널 | 선택적 테두리 |
| 그룹박스 | `<fieldset>` 스타일 테두리 + 레전드 |
| 탭 컨트롤 | 상단 탭 버튼 + 탭 페이지 영역 |
| 폰트 | `Segoe UI, 9pt` (WinForm 기본값) |

### 11.2 CSS 전략

- 각 컨트롤에 `className="wf-{type}"` 적용 (예: `wf-button`, `wf-textbox`)
- CSS Modules 또는 인라인 스타일로 WinForm 룩 구현
- 초기 구현은 인라인 스타일 위주, 향후 테마 시스템으로 확장 가능

---

## 12. 구현 순서 (권장)

| 순서 | 파일 | 설명 |
|------|------|------|
| 1 | `stores/runtimeStore.ts` | 상태 관리 기반 |
| 2 | `renderer/layoutUtils.ts` | 레이아웃 계산 유틸 |
| 3 | `controls/Label.tsx` | 가장 단순한 컨트롤 |
| 4 | `controls/Button.tsx` | 이벤트 기본 동작 |
| 5 | `controls/TextBox.tsx` | 상태 업데이트 동작 |
| 6 | `controls/CheckBox.tsx` | 토글 상태 |
| 7 | `controls/ComboBox.tsx` | 선택 상태 |
| 8 | `controls/Panel.tsx` | 컨테이너 기본 |
| 9 | `controls/GroupBox.tsx` | 컨테이너 + 제목 |
| 10 | `controls/TabControl.tsx` | 복합 컨테이너 |
| 11 | `controls/registry.ts` | 레지스트리 조립 |
| 12 | `hooks/useDataBinding.ts` | 바인딩 stub |
| 13 | `hooks/useEventHandlers.ts` | 이벤트 핸들러 핵심 |
| 14 | `communication/apiClient.ts` | REST 통신 |
| 15 | `communication/wsClient.ts` | WebSocket 통신 |
| 16 | `communication/patchApplier.ts` | 패치 리스너 |
| 17 | `renderer/FormContainer.tsx` | 폼 외관 |
| 18 | `renderer/ControlRenderer.tsx` | 재귀 렌더러 |
| 19 | `renderer/SDUIRenderer.tsx` | 메인 렌더러 |
| 20 | `App.tsx` | 앱 진입점 |
| 21 | `main.tsx` | React 18 마운트 (수정) |

---

## 13. 테스트 전략

### 13.1 단위 테스트

| 테스트 파일 | 대상 | 핵심 케이스 |
|------------|------|------------|
| `runtimeStore.test.ts` | runtimeStore | `setFormDef` 초기화, `updateControlState`, `applyPatch(updateProperty)`, `applyPatch(addControl)` |
| `layoutUtils.test.ts` | layoutUtils | `computeLayoutStyle` (None 좌표), `computeDockStyle` (Fill/Top/Bottom/Left/Right), Anchor 조합 |
| `SDUIRenderer.test.tsx` | SDUIRenderer + ControlRenderer | FormDefinition → Button/Label 렌더링, 중첩 Panel+자식, FormContainer 크기/색 |
| `useEventHandlers.test.ts` | useEventHandlers | client 이벤트 로컬 실행, server 이벤트 `postEvent` mock 호출 |
| `apiClient.test.ts` | apiClient | `fetchForm` GET 확인, `postEvent` POST 형식 + 응답 처리 |

### 13.2 테스트 유틸리티

샘플 `FormDefinition` fixture를 공유 테스트 데이터로 준비:

```typescript
// __tests__/fixtures/sampleForm.ts
export const sampleFormDefinition: FormDefinition = {
  id: 'test-form-1',
  name: 'Test Form',
  version: 1,
  properties: {
    title: '테스트 폼',
    width: 400,
    height: 300,
    backgroundColor: '#F0F0F0',
    font: { family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false },
    startPosition: 'CenterScreen',
    formBorderStyle: 'Sizable',
    maximizeBox: true,
    minimizeBox: true,
  },
  controls: [
    {
      id: 'lbl1', type: 'Label', name: 'lbl1',
      properties: { text: '이름:' },
      position: { x: 10, y: 10 }, size: { width: 60, height: 20 },
      anchor: { top: true, left: true, bottom: false, right: false },
      dock: 'None', tabIndex: 0, visible: true, enabled: true,
    },
    {
      id: 'txt1', type: 'TextBox', name: 'txt1',
      properties: { text: '', multiline: false },
      position: { x: 80, y: 10 }, size: { width: 200, height: 20 },
      anchor: { top: true, left: true, bottom: false, right: true },
      dock: 'None', tabIndex: 1, visible: true, enabled: true,
    },
    {
      id: 'btn1', type: 'Button', name: 'btn1',
      properties: { text: '저장' },
      position: { x: 280, y: 260 }, size: { width: 80, height: 30 },
      anchor: { top: false, left: false, bottom: true, right: true },
      dock: 'None', tabIndex: 2, visible: true, enabled: true,
    },
  ],
  eventHandlers: [
    { controlId: 'btn1', eventName: 'Click', handlerType: 'client', handlerCode: 'ctx.controls.lbl1.text = "클릭됨!";' },
  ],
  dataBindings: [],
};
```

---

## 14. 주요 설계 결정 및 근거

| 결정 | 근거 |
|------|------|
| Zustand + immer | PRD 기술 스택 지정, `applyPatch`에서 깊은 중첩 업데이트에 유리 |
| `Partial<Record<ControlType, ...>>` 레지스트리 | 25종 중 8종만 초기 구현, 미등록 시 graceful fallback |
| client 이벤트에 `new Function` 사용 | PRD 4.2.2의 요구사항. 서버 이벤트보다 신뢰도 높음 (디자이너가 작성한 코드) |
| useDataBinding stub | 데이터소스 서비스(`datasource-service` 태스크)가 별도 구현 예정 |
| WS 자동 재연결 5초 | 네트워크 불안정 대비, 단순한 초기 전략 |
| 인라인 스타일 위주 | WinForm 속성이 동적이므로 인라인이 자연스러움. CSS 클래스는 기본 테마용 |

---

## 15. 추가 의존성

`packages/runtime/package.json`에 추가 필요:

```json
{
  "dependencies": {
    "immer": "^10.0.0"
  }
}
```

Zustand v5의 `immer` 미들웨어 사용을 위해 `immer` 패키지가 필요하다.

---

## 16. 향후 확장 포인트 (현재 구현 범위 밖)

- 나머지 17종 컨트롤 (RadioButton, ListBox, NumericUpDown, DateTimePicker, DataGridView 등)
- 테마 시스템 (Windows 10/11 스타일)
- 실제 데이터 바인딩 (`useDataBinding` stub → 실제 구현)
- 폼 간 네비게이션 (`showDialog`, `navigate` 패치 타입)
- 리사이즈 대응 (Anchor 실시간 계산 + ResizeObserver)
- 접근성 (ARIA 속성, 키보드 탐색)
