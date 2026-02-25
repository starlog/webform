# Step 1 Designer 컨트롤 구현 계획서

> Task ID: `step1-designer-plan`
> Phase: phase2-step1 (EXTRA-ELEMENTS 프로젝트)
> 참조: EXTRA-ELEMENTS.md Step 1 섹션
> 작성일: 2026-02-25

---

## 1. 기존 패턴 분석

### 1.1 Designer 컨트롤 공통 패턴

모든 Designer 컨트롤은 동일한 구조를 따른다:

```ts
import type { DesignerControlProps } from './registry';
import { useTheme } from '../theme/ThemeContext';

export function XxxControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  // properties에서 값 추출: (properties.xxx as Type) ?? defaultValue
  // 색상 우선순위: (properties.foreColor as string) || theme.xxx.yyy
  return (
    <div style={{
      width: size.width,
      height: size.height,
      fontSize: 'inherit',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
      userSelect: 'none',
      // ...컨트롤별 스타일
    }}>
      {/* 컨트롤 미리보기 렌더링 */}
    </div>
  );
}
```

### 1.2 사용 가능한 테마 토큰

| 토큰 경로 | 속성 | 사용 컨트롤 |
|-----------|------|------------|
| `theme.controls.progressBar` | `.background`, `.fillBackground`, `.border`, `.borderRadius` | Slider |
| `theme.controls.checkRadio` | `.border`, `.background`, `.checkedBackground`, `.borderRadius` | Switch |
| `theme.controls.button` | `.background`, `.border`, `.borderRadius`, `.foreground` | Upload(Button) |
| `theme.form` | `.foreground`, `.backgroundColor` | Upload(DropZone), Alert, Tag, Divider |
| `theme.accent.primary` | — | 강조 색상 |

### 1.3 DesignerControlProps 인터페이스

```ts
export interface DesignerControlProps {
  id?: string;
  properties: Record<string, unknown>;
  size: { width: number; height: number };
  children?: React.ReactNode;
}
```

---

## 2. 생성할 파일 상세 설계 (6개)

### 2.1 SliderControl.tsx

**파일**: `packages/designer/src/controls/SliderControl.tsx`
**테마**: `theme.controls.progressBar` 재사용 (ProgressBarControl과 유사)

#### 속성 추출

```ts
const value = (properties.value as number) ?? 0;
const minimum = (properties.minimum as number) ?? 0;
const maximum = (properties.maximum as number) ?? 100;
const orientation = (properties.orientation as string) ?? 'Horizontal';
const showValue = (properties.showValue as boolean) ?? true;
const trackColor = (properties.trackColor as string) || theme.controls.progressBar.background;
const fillColor = (properties.fillColor as string) || theme.controls.progressBar.fillBackground;
const percent = maximum > minimum ? ((value - minimum) / (maximum - minimum)) * 100 : 0;
const clampedPercent = Math.min(100, Math.max(0, percent));
```

#### JSX 구조

```tsx
// Horizontal 모드
<div style={{ width, height, display: 'flex', alignItems: 'center', position: 'relative', ... }}>
  {/* 트랙 (전체 배경) */}
  <div style={{ flex: 1, height: 4, backgroundColor: trackColor, borderRadius: 2, position: 'relative' }}>
    {/* 채워진 영역 */}
    <div style={{ width: `${clampedPercent}%`, height: '100%', backgroundColor: fillColor, borderRadius: 2 }} />
    {/* 원형 썸 */}
    <div style={{
      position: 'absolute',
      left: `${clampedPercent}%`,
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: 12, height: 12,
      borderRadius: '50%',
      backgroundColor: fillColor,
      border: '2px solid white',
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    }} />
  </div>
  {/* showValue 텍스트 (썸 위) */}
  {showValue && <span style={{ position: 'absolute', left: `${clampedPercent}%`, top: -16, transform: 'translateX(-50%)', fontSize: 10 }}>{value}</span>}
</div>

// Vertical 모드: 외부 div에 transform: 'rotate(-90deg)', transformOrigin 적용
```

**Vertical 처리**: 외부 컨테이너에 `transform: 'rotate(-90deg)'` + `transformOrigin: 'center center'`로 회전. width/height를 swap하여 렌더링.

**기존 패턴과의 차이점**: ProgressBarControl에 썸(thumb)과 showValue 텍스트가 추가된 확장 형태. position: relative/absolute 사용.

---

### 2.2 SwitchControl.tsx

**파일**: `packages/designer/src/controls/SwitchControl.tsx`
**테마**: `theme.controls.checkRadio` 재사용 (CheckBoxControl과 유사)

#### 속성 추출

```ts
const text = (properties.text as string) ?? '';
const checked = (properties.checked as boolean) ?? false;
const onText = (properties.onText as string) ?? 'ON';
const offText = (properties.offText as string) ?? 'OFF';
const onColor = (properties.onColor as string) || theme.controls.checkRadio.checkedBackground;
const offColor = (properties.offColor as string) || theme.controls.checkRadio.background;
```

#### JSX 구조

```tsx
<div style={{ width, height, display: 'flex', alignItems: 'center', gap: 8, ... }}>
  {/* 라벨 텍스트 */}
  {text && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>}
  {/* Pill 트랙 */}
  <div style={{
    width: 36, height: 20, borderRadius: 10,
    backgroundColor: checked ? onColor : offColor,
    border: theme.controls.checkRadio.border,
    position: 'relative',
    flexShrink: 0,
  }}>
    {/* 썸 (원형) */}
    <div style={{
      width: 16, height: 16,
      borderRadius: '50%',
      backgroundColor: '#fff',
      position: 'absolute',
      top: 2,
      left: checked ? 18 : 2,
      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
    }} />
    {/* on/off 텍스트 (pill 내부) */}
    <span style={{
      position: 'absolute',
      fontSize: 8,
      color: '#fff',
      top: '50%', transform: 'translateY(-50%)',
      ...(checked ? { left: 4 } : { right: 4 }),
    }}>
      {checked ? onText : offText}
    </span>
  </div>
</div>
```

**기존 패턴과의 차이점**: CheckBox의 체크박스 사각형 대신 pill 형태 트랙 + 슬라이드 썸. 동일한 `checkRadio` 테마 토큰 재사용.

---

### 2.3 UploadControl.tsx

**파일**: `packages/designer/src/controls/UploadControl.tsx`
**테마**: Button 모드 → `theme.controls.button`, DropZone 모드 → `theme.form`

#### 속성 추출

```ts
const uploadMode = (properties.uploadMode as string) ?? 'DropZone';
const text = (properties.text as string) ?? 'Click or drag file to upload';
const backColor = (properties.backColor as string);
const foreColor = (properties.foreColor as string);
const borderStyle = (properties.borderStyle as string) ?? 'Dashed';
```

#### JSX 구조

```tsx
// uploadMode === 'Button'
<div style={{ width, height, display: 'flex', alignItems: 'center', gap: 8, ... }}>
  <div style={{
    padding: '4px 12px',
    backgroundColor: backColor || theme.controls.button.background,
    border: theme.controls.button.border,
    borderRadius: theme.controls.button.borderRadius,
    color: foreColor || theme.controls.button.foreground,
    display: 'flex', alignItems: 'center', gap: 4,
  }}>
    <span>⬆</span>
    <span>{text}</span>
  </div>
</div>

// uploadMode === 'DropZone'
<div style={{
  width, height,
  border: `2px ${borderStyle.toLowerCase()} ${foreColor || theme.form.foreground}40`,
  borderRadius: 8,
  backgroundColor: backColor || `${theme.form.backgroundColor}`,
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  gap: 8,
  color: foreColor || theme.form.foreground,
}}>
  <span style={{ fontSize: 24, opacity: 0.5 }}>⬆</span>
  <span style={{ fontSize: 12, opacity: 0.6 }}>{text}</span>
</div>
```

**기존 패턴과의 차이점**: `uploadMode`에 따라 완전히 다른 레이아웃을 조건부 렌더링. 두 가지 테마 토큰 세트를 모드별로 분리 사용.

---

### 2.4 AlertControl.tsx

**파일**: `packages/designer/src/controls/AlertControl.tsx`
**테마**: 전용 색상 맵 사용 (하드코딩 + foreColor 오버라이드)

#### 색상 맵 상수

```ts
const ALERT_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  Success: { bg: '#f6ffed', border: '#b7eb8f', icon: '✓' },
  Info:    { bg: '#e6f4ff', border: '#91caff', icon: 'ℹ' },
  Warning: { bg: '#fffbe6', border: '#ffe58f', icon: '⚠' },
  Error:   { bg: '#fff2f0', border: '#ffccc7', icon: '✕' },
};
```

#### 속성 추출

```ts
const message = (properties.message as string) ?? 'Alert message';
const description = (properties.description as string) ?? '';
const alertType = (properties.alertType as string) ?? 'Info';
const showIcon = (properties.showIcon as boolean) ?? true;
const closable = (properties.closable as boolean) ?? false;
const banner = (properties.banner as boolean) ?? false;
const foreColor = (properties.foreColor as string);
const style = ALERT_STYLES[alertType] || ALERT_STYLES.Info;
```

#### JSX 구조

```tsx
<div style={{
  width, height,
  backgroundColor: style.bg,
  border: banner ? 'none' : `1px solid ${style.border}`,
  borderRadius: banner ? 0 : 4,
  padding: '8px 12px',
  display: 'flex', alignItems: 'flex-start', gap: 8,
  color: foreColor || style.border,
  overflow: 'hidden',
}}>
  {/* 좌측 아이콘 */}
  {showIcon && <span style={{ fontSize: 14, flexShrink: 0, lineHeight: '20px' }}>{style.icon}</span>}
  {/* 메시지 영역 */}
  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{message}</div>
    {description && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{description}</div>}
  </div>
  {/* 닫기 버튼 */}
  {closable && <span style={{ cursor: 'pointer', opacity: 0.5, flexShrink: 0 }}>✕</span>}
</div>
```

**기존 패턴과의 차이점**: 테마 토큰 대신 alertType별 하드코딩 색상 맵 사용. Ant Design Alert 스타일 기반. banner 속성으로 테두리/라운드 조건부 변경.

---

### 2.5 TagControl.tsx

**파일**: `packages/designer/src/controls/TagControl.tsx`
**테마**: 전용 색상 맵 사용

#### 색상 맵 상수

```ts
const TAG_COLORS: Record<string, { bg: string; border: string; text: string }> = {
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

#### 속성 추출

```ts
const tags = (properties.tags as string[]) ?? ['Tag1', 'Tag2'];
const tagColor = (properties.tagColor as string) ?? 'Default';
const closable = (properties.closable as boolean) ?? false;
const addable = (properties.addable as boolean) ?? false;
const foreColor = (properties.foreColor as string);
const colorSet = TAG_COLORS[tagColor] || TAG_COLORS.Default;
```

#### JSX 구조

```tsx
<div style={{
  width, height,
  display: 'flex', flexWrap: 'wrap', gap: 4,
  alignItems: 'center', alignContent: 'flex-start',
  overflow: 'hidden',
  fontSize: 'inherit', fontFamily: 'inherit',
  boxSizing: 'border-box',
  userSelect: 'none',
}}>
  {tags.map((tag, i) => (
    <span key={i} style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      padding: '2px 8px',
      borderRadius: 4,
      border: `1px solid ${colorSet.border}`,
      backgroundColor: colorSet.bg,
      color: foreColor || colorSet.text,
      fontSize: 12, lineHeight: '20px',
      whiteSpace: 'nowrap',
    }}>
      {tag}
      {closable && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 2 }}>✕</span>}
    </span>
  ))}
  {addable && (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 4,
      border: '1px dashed #d9d9d9',
      backgroundColor: 'transparent',
      color: foreColor || 'rgba(0,0,0,0.65)',
      fontSize: 12, lineHeight: '20px',
      cursor: 'pointer',
    }}>
      + New Tag
    </span>
  )}
</div>
```

**기존 패턴과의 차이점**: 배열 속성(`tags`)을 순회하여 여러 요소 렌더링. 8가지 색상 맵. closable/addable로 추가 UI 요소 조건부 표시.

---

### 2.6 DividerControl.tsx

**파일**: `packages/designer/src/controls/DividerControl.tsx`
**테마**: `theme.form.foreground` (opacity 0.2)

#### 속성 추출

```ts
const text = (properties.text as string) ?? '';
const orientation = (properties.orientation as string) ?? 'Horizontal';
const textAlign = (properties.textAlign as string) ?? 'Center';
const lineStyle = (properties.lineStyle as string) ?? 'Solid';
const lineColor = (properties.lineColor as string) || `${theme.form.foreground}33`; // opacity ~0.2
const foreColor = (properties.foreColor as string) || theme.form.foreground;
```

#### textAlign 위치 변환

```ts
const textPosition = textAlign === 'Left' ? '5%' : textAlign === 'Right' ? '95%' : '50%';
```

#### JSX 구조

```tsx
// Horizontal 모드
<div style={{
  width, height,
  display: 'flex', alignItems: 'center',
  boxSizing: 'border-box', userSelect: 'none',
}}>
  {text ? (
    // 텍스트 있을 때: 좌측 선 + 텍스트 + 우측 선
    <>
      <div style={{
        flex: textAlign === 'Left' ? '0 0 5%' : textAlign === 'Right' ? '1' : '1',
        height: 0,
        borderTop: `1px ${lineStyle.toLowerCase()} ${lineColor}`,
      }} />
      <span style={{
        padding: '0 8px',
        fontSize: 12,
        color: foreColor,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>{text}</span>
      <div style={{
        flex: textAlign === 'Left' ? '1' : textAlign === 'Right' ? '0 0 5%' : '1',
        height: 0,
        borderTop: `1px ${lineStyle.toLowerCase()} ${lineColor}`,
      }} />
    </>
  ) : (
    // 텍스트 없을 때: 단일 수평선
    <div style={{ flex: 1, height: 0, borderTop: `1px ${lineStyle.toLowerCase()} ${lineColor}` }} />
  )}
</div>

// Vertical 모드
<div style={{
  width, height,
  display: 'flex', justifyContent: 'center',
  boxSizing: 'border-box', userSelect: 'none',
}}>
  <div style={{
    width: 0, height: '100%',
    borderLeft: `1px ${lineStyle.toLowerCase()} ${lineColor}`,
  }} />
</div>
```

**기존 패턴과의 차이점**: 순수 표시 컨트롤. orientation에 따라 수평/수직 분기. 텍스트 유무에 따라 선 분리. flex 비율로 textAlign 위치 조정.

---

## 3. registry.ts 수정 계획

**파일**: `packages/designer/src/controls/registry.ts`

### 3.1 import 추가 (라인 32 이후)

```ts
import { SliderControl } from './SliderControl';
import { SwitchControl } from './SwitchControl';
import { UploadControl } from './UploadControl';
import { AlertControl } from './AlertControl';
import { TagControl } from './TagControl';
import { DividerControl } from './DividerControl';
```

### 3.2 designerControlRegistry 추가 (라인 73, MongoDBConnector 뒤)

```ts
  MongoDBConnector: MongoDBConnectorControl,
  Slider: SliderControl,
  Switch: SwitchControl,
  Upload: UploadControl,
  Alert: AlertControl,
  Tag: TagControl,
  Divider: DividerControl,
```

### 3.3 controlMetadata 추가 (라인 118, MongoDBConnector 뒤)

```ts
  { type: 'MongoDBConnector', displayName: 'MongoDBConnector', icon: '🗄', category: 'database' },

  { type: 'Slider',  displayName: 'Slider',  icon: '⎯', category: 'basic' },
  { type: 'Switch',  displayName: 'Switch',  icon: '⊘', category: 'basic' },
  { type: 'Upload',  displayName: 'Upload',  icon: '⬆', category: 'data' },
  { type: 'Alert',   displayName: 'Alert',   icon: '⚠', category: 'basic' },
  { type: 'Tag',     displayName: 'Tag',     icon: '⬡', category: 'basic' },
  { type: 'Divider', displayName: 'Divider', icon: '—', category: 'basic' },
```

---

## 4. 기존 패턴과의 동일점/차이점 요약

### 동일점 (모든 6개 컨트롤)

- `import type { DesignerControlProps } from './registry'`
- `import { useTheme } from '../theme/ThemeContext'`
- `export function XxxControl({ properties, size }: DesignerControlProps)` 시그니처
- `const theme = useTheme()` 최상단 호출
- `(properties.xxx as Type) ?? defaultValue` 패턴으로 속성 추출
- `(properties.foreColor as string) || theme.xxx` 색상 우선순위
- 공통 스타일: `fontSize: 'inherit'`, `fontFamily: 'inherit'`, `boxSizing: 'border-box'`, `userSelect: 'none'`

### 차이점

| 컨트롤 | 차이점 |
|--------|--------|
| **Slider** | position: relative/absolute 활용 (썸 배치), Vertical 시 transform rotate |
| **Switch** | 2개 영역 (라벨 + pill 트랙), 트랙 내부에 absolute 썸 |
| **Upload** | uploadMode에 따라 2가지 완전히 다른 레이아웃 분기 |
| **Alert** | ALERT_STYLES 하드코딩 색상 맵, alertType별 조건부 스타일 |
| **Tag** | 배열 속성 순회 (tags.map), 8가지 TAG_COLORS 색상 맵 |
| **Divider** | orientation 분기 + 텍스트 유무 분기, flex 비율로 위치 제어 |

---

## 5. 구현 순서

1. **DividerControl.tsx** — 가장 단순 (순수 표시, 조건부 CSS만)
2. **AlertControl.tsx** — 단순 표시 + 색상 맵
3. **SwitchControl.tsx** — CheckBox 패턴 확장
4. **SliderControl.tsx** — ProgressBar 패턴 확장 + 썸
5. **TagControl.tsx** — 배열 순회 + 색상 맵
6. **UploadControl.tsx** — 모드별 분기 (가장 복잡)
7. **registry.ts 수정** — 6개 import + registry + metadata 등록

> 각 컨트롤 구현 후 즉시 `pnpm typecheck`으로 타입 오류 확인
