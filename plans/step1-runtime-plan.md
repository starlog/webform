# Step 1 Runtime 컨트롤 구현 계획

> 6개 컨트롤(Slider, Switch, Upload, Alert, Tag, Divider)의 Runtime 인터랙티브 컴포넌트 구현

---

## 1. 기존 패턴 요약

### 파일 구조 패턴
- 위치: `packages/runtime/src/controls/{Name}.tsx`
- named export: `export function {Name}({ id, ...props }: {Name}Props) { ... }`
- `data-control-id={id}` 속성 필수
- `className="wf-{lowercase}"` 관례

### Props 인터페이스 패턴
```ts
interface {Name}Props {
  id: string;
  name: string;
  // 고유 속성들...
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  on{Event}?: () => void;  // 이벤트 콜백
  children?: ReactNode;
  [key: string]: unknown;  // 추가 props 허용
}
```

### 상태 업데이트 패턴
```ts
const updateControlState = useRuntimeStore((s) => s.updateControlState);
// 값 변경 시:
updateControlState(id, 'propertyName', newValue);
onEventCallback?.();
```

### 테마 색상 패턴
```ts
const colors = useControlColors('ControlType', { backColor, foreColor });
// colors.backgroundColor, colors.color 사용
```
- `useControlColors`는 `controlThemeMap`에 해당 타입의 resolver가 있으면 그 테마 토큰 사용
- 없으면 `theme.form.backgroundColor` / `theme.form.foreground` 폴백
- **useControlColors.ts의 controlThemeMap에 신규 타입 매핑 추가 필요**

### useTheme() 패턴
- 테두리/패딩 등 구조적 스타일에는 `useTheme()` 직접 호출
- 예: `theme.controls.progressBar.border`, `theme.controls.button.borderRadius`

---

## 2. 생성 파일 목록 (6개)

| # | 파일 | 설명 |
|---|------|------|
| 1 | `packages/runtime/src/controls/Slider.tsx` | 범위 슬라이더 |
| 2 | `packages/runtime/src/controls/Switch.tsx` | ON/OFF 토글 |
| 3 | `packages/runtime/src/controls/Upload.tsx` | 파일 업로드 영역 |
| 4 | `packages/runtime/src/controls/Alert.tsx` | 인라인 알림 메시지 |
| 5 | `packages/runtime/src/controls/Tag.tsx` | 태그 칩 컬렉션 |
| 6 | `packages/runtime/src/controls/Divider.tsx` | 구분선 |

## 3. 수정 파일 목록 (2개)

| # | 파일 | 작업 |
|---|------|------|
| 1 | `packages/runtime/src/controls/registry.ts` | 6개 import + registry 등록 |
| 2 | `packages/runtime/src/theme/useControlColors.ts` | controlThemeMap에 6개 타입 매핑 추가 |

---

## 4. 각 컴포넌트 상세 구현 계획

### 4.1 Slider.tsx

**Props:**
```ts
interface SliderProps {
  id: string;
  name: string;
  value?: number;          // default: 0
  minimum?: number;        // default: 0
  maximum?: number;        // default: 100
  step?: number;           // default: 1
  orientation?: 'Horizontal' | 'Vertical';  // default: 'Horizontal'
  showValue?: boolean;     // default: true
  trackColor?: string;
  fillColor?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onValueChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}
```

**상태 관리:**
- `onChange` → `updateControlState(id, 'value', parseFloat(e.target.value))`
- `onValueChanged?.()` 콜백 호출

**렌더링:**
- `<input type="range" min={minimum} max={maximum} step={step} value={value} />`
- `showValue` true이면 값 텍스트 표시 (우측 또는 상단)
- Vertical 모드: 컨테이너에 `writing-mode: vertical-lr; direction: rtl` 적용
- `enabled=false`: `disabled` 속성 + opacity 0.6

**테마 매핑:**
- `controlThemeMap.Slider` → `progressBar` 토큰 재사용
  - `background: t.controls.progressBar.background, foreground: t.form.foreground`

**CSS 스타일링:**
- `appearance: none` 리셋 후 커스텀 트랙/썸 스타일
  - track: `trackColor` 또는 테마 배경색
  - `::-webkit-slider-runnable-track`, `::-moz-range-track`
  - 인라인 스타일로 충분 (별도 CSS 파일 불필요, 기존 패턴과 동일)
- fillColor 적용은 CSS gradient 기법 사용:
  - `background: linear-gradient(to right, fillColor 0%, fillColor {percent}%, trackBg {percent}%, trackBg 100%)`

---

### 4.2 Switch.tsx

**Props:**
```ts
interface SwitchProps {
  id: string;
  name: string;
  checked?: boolean;       // default: false
  text?: string;           // default: ''
  onText?: string;         // default: 'ON'
  offText?: string;        // default: 'OFF'
  onColor?: string;        // checked true일 때 트랙 색상
  offColor?: string;       // checked false일 때 트랙 색상
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onCheckedChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}
```

**상태 관리:**
- 클릭 → `updateControlState(id, 'checked', !checked)`
- `onCheckedChanged?.()` 콜백 호출

**렌더링 구조:**
```tsx
<div className="wf-switch" style={containerStyle}>
  {text && <span style={labelStyle}>{text}</span>}
  <div style={trackStyle} onClick={handleToggle}>
    <span style={trackTextStyle}>{checked ? onText : offText}</span>
    <div style={thumbStyle} />
  </div>
</div>
```

**스타일 상세:**
- 트랙: `width: 44px, height: 22px, borderRadius: 11px`
- 썸: `width: 18px, height: 18px, borderRadius: 50%, background: white`
- checked: 썸 `transform: translateX(22px)`, 트랙 배경 `onColor` 또는 `#1677ff`
- unchecked: 썸 `transform: translateX(2px)`, 트랙 배경 `offColor` 또는 `#bfbfbf`
- `transition: all 0.2s ease` (트랙/썸 모두)
- `enabled=false`: `opacity: 0.5, pointerEvents: 'none'`

**테마 매핑:**
- `controlThemeMap.Switch` → `checkRadio` 토큰 재사용
  - `background: t.form.backgroundColor, foreground: t.form.foreground`

---

### 4.3 Upload.tsx

**Props:**
```ts
interface UploadProps {
  id: string;
  name: string;
  uploadMode?: 'Button' | 'DropZone';  // default: 'DropZone'
  text?: string;           // default: 'Click or drag file to upload'
  accept?: string;         // default: ''
  multiple?: boolean;      // default: false
  maxFileSize?: number;    // default: 10 (MB)
  maxCount?: number;       // default: 1
  borderStyle?: 'None' | 'Solid' | 'Dashed';  // default: 'Dashed'
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onFileSelected?: () => void;
  onUploadCompleted?: () => void;
  onUploadFailed?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}
```

**상태 관리:**
- 파일 선택 시 → 파일 메타 배열 생성 → `updateControlState(id, 'selectedFiles', fileMeta[])`
- `onFileSelected?.()` 콜백 호출 (서버에서 eventArgs `{ files: [{ name, size, type }] }` 전달)

**내부 상태 (useState):**
- `isDragOver: boolean` — 드래그 오버 시각 피드백용
- 선택된 파일 목록은 `controlState`에서 읽음 (props 또는 store)

**렌더링 구조:**
```tsx
// 숨겨진 input
<input ref={inputRef} type="file" style={{ display: 'none' }}
       accept={accept} multiple={multiple} onChange={handleFileChange} />

// DropZone 모드
<div style={dropZoneStyle}
     onClick={() => inputRef.current?.click()}
     onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
  <span>⬆</span>
  <span>{text}</span>
  {/* 선택된 파일 목록 */}
</div>

// Button 모드
<button style={buttonStyle} onClick={() => inputRef.current?.click()}>
  ⬆ {text}
</button>
```

**드래그앤드롭 처리:**
- `onDragOver`: `e.preventDefault()` + `setIsDragOver(true)`
- `onDragLeave`: `setIsDragOver(false)`
- `onDrop`: `e.preventDefault()` + `setIsDragOver(false)` + 파일 처리
- isDragOver 시: 테두리 색상 변경 (`#1677ff`)

**파일 처리 로직:**
```ts
const handleFiles = (fileList: FileList) => {
  const files = Array.from(fileList).slice(0, maxCount);
  const fileMeta = files.map(f => ({ name: f.name, size: f.size, type: f.type }));
  updateControlState(id, 'selectedFiles', fileMeta);
  onFileSelected?.();
};
```

**테마 매핑:**
- `controlThemeMap.Upload` → `button` (Button모드) / `form` (DropZone모드) 토큰
  - 단순화: `background: t.form.backgroundColor, foreground: t.form.foreground`

---

### 4.4 Alert.tsx

**Props:**
```ts
interface AlertProps {
  id: string;
  name: string;
  message?: string;        // default: 'Alert message'
  description?: string;    // default: ''
  alertType?: 'Success' | 'Info' | 'Warning' | 'Error';  // default: 'Info'
  showIcon?: boolean;      // default: true
  closable?: boolean;      // default: false
  banner?: boolean;        // default: false
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onClosed?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}
```

**상태 관리:**
- `closable` + ✕ 클릭 → `updateControlState(id, 'visible', false)` → `onClosed?.()`
- 나머지는 정적 표시 (읽기 전용)

**타입별 스타일 맵 (상수):**
```ts
const ALERT_STYLES = {
  Success: { bg: '#f6ffed', border: '#b7eb8f', icon: '✓' },
  Info:    { bg: '#e6f4ff', border: '#91caff', icon: 'ℹ' },
  Warning: { bg: '#fffbe6', border: '#ffe58f', icon: '⚠' },
  Error:   { bg: '#fff2f0', border: '#ffccc7', icon: '✕' },
};
```

**렌더링 구조:**
```tsx
<div className="wf-alert" data-control-id={id} style={containerStyle}>
  {showIcon && <span style={iconStyle}>{alertIcon}</span>}
  <div style={contentStyle}>
    <div style={messageStyle}>{message}</div>
    {description && <div style={descriptionStyle}>{description}</div>}
  </div>
  {closable && <span style={closeStyle} onClick={handleClose}>✕</span>}
</div>
```

**스타일 상세:**
- 컨테이너: `padding: 8px 12px, borderRadius: 6px, border: 1px solid`
- `banner`: `border: none, borderRadius: 0`
- message: `fontWeight: 'bold'`
- description: `fontSize: '0.9em', marginTop: 4px`

**테마 매핑:**
- `controlThemeMap.Alert` → Alert은 자체 색상 맵을 사용하므로 폼 기본값:
  - `background: t.form.backgroundColor, foreground: t.form.foreground`
  - 실제 배경/테두리는 `ALERT_STYLES[alertType]`에서 가져옴

---

### 4.5 Tag.tsx

**Props:**
```ts
interface TagProps {
  id: string;
  name: string;
  tags?: string[];         // default: ['Tag1', 'Tag2']
  tagColor?: 'Default' | 'Blue' | 'Green' | 'Red' | 'Orange' | 'Purple' | 'Cyan' | 'Gold';
  closable?: boolean;      // default: false
  addable?: boolean;       // default: false
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onTagAdded?: () => void;
  onTagRemoved?: () => void;
  onTagClicked?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}
```

**상태 관리:**
- 태그 삭제: `updateControlState(id, 'tags', tags.filter(t => t !== tag))` → `onTagRemoved?.()`
- 태그 추가: `updateControlState(id, 'tags', [...tags, newTag])` → `onTagAdded?.()`
- 태그 클릭: `onTagClicked?.()` (eventArgs는 서버 사이드에서 처리)

**내부 상태 (useState):**
- `isAdding: boolean` — 인라인 input 표시 여부
- `newTagValue: string` — 입력 중인 태그 텍스트

**색상 맵 (상수):**
```ts
const TAG_COLORS = {
  Default: { bg: '#fafafa', border: '#d9d9d9', text: 'rgba(0,0,0,0.88)' },
  Blue:    { bg: '#e6f4ff', border: '#91caff', text: '#1677ff' },
  Green:   { bg: '#f6ffed', border: '#b7eb8f', text: '#52c41a' },
  Red:     { bg: '#fff2f0', border: '#ffccc7', text: '#ff4d4f' },
  Orange:  { bg: '#fff7e6', border: '#ffd591', text: '#fa8c16' },
  Purple:  { bg: '#f9f0ff', border: '#d3adf7', text: '#722ed1' },
  Cyan:    { bg: '#e6fffb', border: '#87e8de', text: '#13c2c2' },
  Gold:    { bg: '#fffbe6', border: '#ffe58f', text: '#faad14' },
};
```

**렌더링 구조:**
```tsx
<div className="wf-tag" data-control-id={id} style={containerStyle}>
  {tags.map((tag, index) => (
    <span key={`${tag}-${index}`} style={tagStyle} onClick={() => handleTagClick(tag, index)}>
      {tag}
      {closable && <span style={closeStyle} onClick={(e) => { e.stopPropagation(); handleRemove(tag); }}>✕</span>}
    </span>
  ))}
  {addable && !isAdding && (
    <span style={addButtonStyle} onClick={() => setIsAdding(true)}>+ New Tag</span>
  )}
  {addable && isAdding && (
    <input style={inputStyle} autoFocus value={newTagValue}
           onChange={e => setNewTagValue(e.target.value)}
           onKeyDown={handleKeyDown} onBlur={handleAddConfirm} />
  )}
</div>
```

**태그 추가 로직:**
```ts
const handleAddConfirm = () => {
  const trimmed = newTagValue.trim();
  if (trimmed) {
    updateControlState(id, 'tags', [...(tags || []), trimmed]);
    onTagAdded?.();
  }
  setNewTagValue('');
  setIsAdding(false);
};

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') handleAddConfirm();
  if (e.key === 'Escape') { setNewTagValue(''); setIsAdding(false); }
};
```

**스타일 상세:**
- 컨테이너: `display: flex, flexWrap: wrap, gap: 6px, alignItems: 'center'`
- 각 태그: `borderRadius: 4px, padding: '2px 8px', border: '1px solid', fontSize: '0.85em'`
- 추가 버튼: `border: '1px dashed', cursor: 'pointer'`
- 인라인 input: `width: 80px, fontSize: '0.85em'`

**테마 매핑:**
- `controlThemeMap.Tag` → 폼 기본값
  - `background: t.form.backgroundColor, foreground: t.form.foreground`
  - 실제 색상은 `TAG_COLORS[tagColor]`에서 가져옴

---

### 4.6 Divider.tsx

**Props:**
```ts
interface DividerProps {
  id: string;
  name: string;
  text?: string;           // default: ''
  orientation?: 'Horizontal' | 'Vertical';  // default: 'Horizontal'
  textAlign?: 'Left' | 'Center' | 'Right';  // default: 'Center'
  lineStyle?: 'Solid' | 'Dashed' | 'Dotted';  // default: 'Solid'
  lineColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}
```

**상태 관리:**
- 없음 (순수 표시 컨트롤, 인터랙션 없음)

**렌더링 — Horizontal + 텍스트 없음:**
```tsx
<div style={{ ...containerStyle, display: 'flex', alignItems: 'center' }}>
  <div style={{ flex: 1, borderTop: `1px ${lineStyle} ${resolvedColor}` }} />
</div>
```

**렌더링 — Horizontal + 텍스트 있음:**
```tsx
<div style={{ ...containerStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
  <div style={{ flex: leftFlex, borderTop: lineStr }} />
  <span style={{ color: foreColor, fontSize: '0.9em', whiteSpace: 'nowrap' }}>{text}</span>
  <div style={{ flex: rightFlex, borderTop: lineStr }} />
</div>
```
- textAlign 처리: Left → `flex: 0.05` / `flex: 0.95`, Center → `flex: 1` / `flex: 1`, Right → `flex: 0.95` / `flex: 0.05`

**렌더링 — Vertical:**
```tsx
<div style={{ ...containerStyle, display: 'flex', justifyContent: 'center' }}>
  <div style={{ height: '100%', borderLeft: `1px ${lineStyle} ${resolvedColor}` }} />
</div>
```

**테마 매핑:**
- `controlThemeMap.Divider` → 폼 기본값
  - `background: t.form.backgroundColor, foreground: t.form.foreground`
  - lineColor 기본값: `foreColor` 또는 `theme.form.foreground`에 opacity 0.2 적용

---

## 5. registry.ts 수정 내용

```ts
// 추가 import (기존 import 블록 하단에)
import { Slider } from './Slider';
import { Switch } from './Switch';
import { Upload } from './Upload';
import { Alert } from './Alert';
import { Tag } from './Tag';
import { Divider } from './Divider';

// registry 객체에 추가 (기존 항목 이후)
export const runtimeControlRegistry: Partial<Record<ControlType, ComponentType<any>>> = {
  // ... 기존 28개 ...
  Slider,
  Switch,
  Upload,
  Alert,
  Tag,
  Divider,
};
```

---

## 6. useControlColors.ts 수정 내용

`controlThemeMap` 객체에 6개 항목 추가:

```ts
const controlThemeMap: Record<string, ThemeColorResolver> = {
  // ... 기존 매핑 ...

  // Step 1 신규 컨트롤
  Slider: (t) => ({ background: t.controls.progressBar.background, foreground: t.form.foreground }),
  Switch: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Upload: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Alert: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Tag: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Divider: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
};
```

- Slider는 `progressBar` 토큰 재사용 (EXTRA-ELEMENTS.md 명세)
- Switch/Upload/Alert/Tag/Divider는 자체 색상 로직이 있어 폼 기본값 사용

---

## 7. 구현 순서

1. `useControlColors.ts` — controlThemeMap에 6개 타입 매핑 추가
2. `Divider.tsx` — 가장 단순 (순수 표시, 상태 관리 없음)
3. `Alert.tsx` — 비교적 단순 (closable만 인터랙션)
4. `Slider.tsx` — input range 기반, 비교적 표준적
5. `Switch.tsx` — 커스텀 UI, CheckBox 패턴 참고
6. `Tag.tsx` — 가장 복잡 (추가/삭제/클릭, 내부 상태 관리)
7. `Upload.tsx` — 드래그앤드롭 + useRef + 내부 상태
8. `registry.ts` — 6개 import + 등록

---

## 8. 주의사항

- **이벤트 콜백은 무인수 함수**: `onValueChanged?.()` 패턴. eventArgs는 서버 사이드에서 `EventEngine`이 구성함
- **enabled 처리**: 기존 CheckBox 패턴 따라 `if (!enabled) return;` 가드 또는 `disabled` 속성
- **style prop 병합**: 항상 `...style`을 마지막에 spread하여 외부 레이아웃 스타일(position, width, height) 적용
- **data-control-id**: SDUI 렌더러가 이벤트 타겟을 식별하는 데 사용. 모든 루트 요소에 필수
- **[key: string]: unknown**: Props 인터페이스에 index signature 포함 (SDUIRenderer가 전체 properties를 spread로 전달)
- **useRef 사용 시**: Upload에서 `<input type="file" />` 참조용. React.useRef import 필요
- **useState 사용 시**: Tag의 isAdding/newTagValue, Upload의 isDragOver에 사용
