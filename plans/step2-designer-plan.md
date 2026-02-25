# Step 2 Designer 컨트롤 구현 계획서

> Task ID: `step2-designer-plan`
> Phase: phase2-step2 (EXTRA-ELEMENTS 프로젝트)
> 참조: EXTRA-ELEMENTS.md Step 2 섹션
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

### 1.2 Container 컨트롤 패턴

PanelControl, GroupBoxControl은 `children` prop을 받아 렌더링한다:

```ts
export function PanelControl({ properties, size, children }: DesignerControlProps) {
  // ...
  return (
    <div style={{ width, height, position: 'relative', overflow: 'hidden', ... }}>
      {children}
    </div>
  );
}
```

**Card, Tooltip, Collapse**는 이 Container 패턴을 따른다.

### 1.3 TabControl 패턴 (패널/탭 전환)

TabControlControl은 `useDesignerStore`를 사용하여 디자이너에서 탭 클릭 시 `selectedIndex`를 업데이트한다:

```ts
import { useDesignerStore } from '../stores/designerStore';

const updateControl = useDesignerStore((s) => s.updateControl);
const handleTabClick = (index: number) => {
  if (id) {
    updateControl(id, { properties: { ...properties, selectedIndex: index } });
  }
};
```

**Collapse**는 이 패턴을 활용하여 `activeKeys` 토글을 구현한다.

### 1.4 사용 가능한 테마 토큰

| 토큰 경로 | 속성 | 사용 컨트롤 |
|-----------|------|------------|
| `theme.form` | `.backgroundColor`, `.foreground` | Card, Collapse, Statistic, Tooltip |
| `theme.controls.panel` | `.background`, `.border`, `.borderRadius` | Card (참고용) |
| `theme.controls.tabControl` | `.tabBackground`, `.tabActiveBackground`, 등 | Collapse (참고용) |
| `theme.accent.primary` | — | Badge(Processing), Avatar(기본 배경) |

### 1.5 DesignerControlProps 인터페이스

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

### 2.1 CardControl.tsx

**파일**: `packages/designer/src/controls/CardControl.tsx`
**카테고리**: `container`
**기본 크기**: `{ width: 300, height: 200 }`
**테마**: `theme.form.background` + `theme.form.foreground`

#### 속성 추출

```ts
const title = (properties.title as string) ?? 'Card Title';
const subtitle = (properties.subtitle as string) ?? '';
const showHeader = (properties.showHeader as boolean) ?? true;
const showBorder = (properties.showBorder as boolean) ?? true;
const cardSize = (properties.size as string) ?? 'Default';
const backColor = (properties.backColor as string) || theme.form.backgroundColor;
const foreColor = (properties.foreColor as string) || theme.form.foreground;
const borderRadius = (properties.borderRadius as number) ?? 8;
```

#### JSX 구조

```tsx
<div style={{
  width: size.width,
  height: size.height,
  backgroundColor: backColor,
  color: foreColor,
  borderRadius,
  border: showBorder ? `1px solid ${theme.form.foreground}20` : 'none',
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  overflow: 'hidden',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  userSelect: 'none',
}}>
  {/* 헤더 영역 */}
  {showHeader && (
    <div style={{
      padding: cardSize === 'Small' ? '8px 12px' : '12px 16px',
      borderBottom: `1px solid ${theme.form.foreground}15`,
      flexShrink: 0,
    }}>
      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subtitle}
        </div>
      )}
    </div>
  )}
  {/* Body 영역 (자식 컨트롤 배치) */}
  <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
    {children}
  </div>
</div>
```

**Container 패턴**: `children` prop을 body 영역에 렌더링. PanelControl과 동일한 방식.

---

### 2.2 BadgeControl.tsx

**파일**: `packages/designer/src/controls/BadgeControl.tsx`
**카테고리**: `basic`
**기본 크기**: `{ width: 80, height: 30 }`
**테마**: 전용 색상 맵 사용

#### 색상 맵 상수

```ts
const STATUS_COLORS: Record<string, string> = {
  Default: '#ff4d4f',
  Success: '#52c41a',
  Processing: '#1677ff',
  Error: '#ff4d4f',
  Warning: '#faad14',
};
```

#### 속성 추출

```ts
const count = (properties.count as number) ?? 0;
const overflowCount = (properties.overflowCount as number) ?? 99;
const showZero = (properties.showZero as boolean) ?? false;
const dot = (properties.dot as boolean) ?? false;
const status = (properties.status as string) ?? 'Default';
const text = (properties.text as string) ?? '';
const badgeColor = (properties.badgeColor as string) || STATUS_COLORS[status] || STATUS_COLORS.Default;
```

#### 표시 로직

```ts
const displayCount = count > overflowCount ? `${overflowCount}+` : `${count}`;
const showBadge = dot || count > 0 || showZero;
```

#### JSX 구조

```tsx
<div style={{
  width: size.width,
  height: size.height,
  display: 'inline-flex',
  alignItems: 'center',
  position: 'relative',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  userSelect: 'none',
}}>
  {/* 텍스트 (있으면) */}
  {text && (
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )}
  {/* 뱃지 오버레이 */}
  {showBadge && (
    dot ? (
      // Dot 모드: 6x6 원형
      <div style={{
        position: text ? 'absolute' : 'relative',
        top: text ? 0 : 'auto',
        right: text ? 0 : 'auto',
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: badgeColor,
      }} />
    ) : (
      // 숫자 모드
      <div style={{
        position: text ? 'absolute' : 'relative',
        top: text ? -4 : 'auto',
        right: text ? -4 : 'auto',
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: badgeColor,
        color: '#fff',
        fontSize: 12,
        lineHeight: '20px',
        textAlign: 'center',
        padding: '0 6px',
        whiteSpace: 'nowrap',
      }}>
        {displayCount}
      </div>
    )
  )}
</div>
```

**기존 패턴과의 차이점**: 조건부 절대/상대 위치 전환 (text 유무에 따라). dot/숫자 모드 분기. STATUS_COLORS 색상 맵.

---

### 2.3 AvatarControl.tsx

**파일**: `packages/designer/src/controls/AvatarControl.tsx`
**카테고리**: `basic`
**기본 크기**: `{ width: 40, height: 40 }`
**테마**: 하드코딩 기본값 (`#1677ff`, `#ffffff`)

#### 속성 추출

```ts
const imageUrl = (properties.imageUrl as string) ?? '';
const text = (properties.text as string) ?? 'U';
const shape = (properties.shape as string) ?? 'Circle';
const backColor = (properties.backColor as string) || '#1677ff';
const foreColor = (properties.foreColor as string) || '#ffffff';
```

#### 크기 계산

```ts
const avatarSize = Math.min(size.width, size.height);
const borderRadius = shape === 'Circle' ? '50%' : 4;
const fontSize = avatarSize * 0.45; // 아바타 크기에 비례
```

#### JSX 구조

```tsx
<div style={{
  width: size.width,
  height: size.height,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  userSelect: 'none',
}}>
  <div style={{
    width: avatarSize,
    height: avatarSize,
    borderRadius,
    backgroundColor: imageUrl ? 'transparent' : backColor,
    color: foreColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize,
    fontWeight: 600,
    overflow: 'hidden',
    flexShrink: 0,
  }}>
    {imageUrl ? (
      <img
        src={imageUrl}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    ) : (
      <span>{text.charAt(0).toUpperCase()}{text.length > 1 ? text.charAt(1) : ''}</span>
    )}
  </div>
</div>
```

**기존 패턴과의 차이점**: `Math.min(width, height)` 기준 크기. imageUrl 유무에 따라 이미지/이니셜 분기. 비례 폰트 크기.

---

### 2.4 TooltipControl.tsx

**파일**: `packages/designer/src/controls/TooltipControl.tsx`
**카테고리**: `basic`
**기본 크기**: `{ width: 100, height: 30 }`
**테마**: `theme.form.foreground`

#### 속성 추출

```ts
const title = (properties.title as string) ?? 'Tooltip text';
```

#### JSX 구조

```tsx
<div style={{
  width: size.width,
  height: size.height,
  position: 'relative',
  boxSizing: 'border-box',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  userSelect: 'none',
}}>
  {children ? (
    <>
      {/* 자식 컨트롤 렌더링 */}
      {children}
      {/* 디자이너 전용 말풍선 오버레이 (좌측 상단) */}
      <div style={{
        position: 'absolute',
        top: -2,
        left: -2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        backgroundColor: 'rgba(0,0,0,0.65)',
        color: '#fff',
        fontSize: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 1,
      }}>
        💬
      </div>
    </>
  ) : (
    // 자식 없을 때: 점선 테두리 + 텍스트
    <div style={{
      width: '100%',
      height: '100%',
      border: `1px dashed ${theme.form.foreground}40`,
      borderRadius: 4,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: `${theme.form.foreground}80`,
      fontSize: 12,
    }}>
      [Tooltip]
    </div>
  )}
</div>
```

**Container 패턴**: `children` prop을 받아 래퍼 역할. 디자이너에서만 말풍선 아이콘 오버레이 표시.

---

### 2.5 CollapseControl.tsx

**파일**: `packages/designer/src/controls/CollapseControl.tsx`
**카테고리**: `container`
**기본 크기**: `{ width: 300, height: 200 }`
**테마**: `theme.form.background` + `theme.form.foreground`

#### 속성 추출

```ts
const panels = (properties.panels as Array<{ title: string; key: string }>) ?? [
  { title: 'Panel 1', key: '1' },
  { title: 'Panel 2', key: '2' },
];
const activeKeysStr = (properties.activeKeys as string) ?? '1';
const activeKeys = activeKeysStr.split(',').map((k) => k.trim()).filter(Boolean);
const bordered = (properties.bordered as boolean) ?? true;
const expandIconPosition = (properties.expandIconPosition as string) ?? 'Start';
const backColor = (properties.backColor as string) || theme.form.backgroundColor;
const foreColor = (properties.foreColor as string) || theme.form.foreground;
```

#### Designer 상호작용 (TabControl 패턴 활용)

```ts
import { useDesignerStore } from '../stores/designerStore';

const updateControl = useDesignerStore((s) => s.updateControl);

const handlePanelClick = (key: string) => {
  if (!id) return;
  const newActiveKeys = activeKeys.includes(key)
    ? activeKeys.filter((k) => k !== key)
    : [...activeKeys, key];
  updateControl(id, {
    properties: { ...properties, activeKeys: newActiveKeys.join(',') },
  });
};
```

#### JSX 구조

```tsx
<div style={{
  width: size.width,
  height: size.height,
  border: bordered ? `1px solid ${foreColor}20` : 'none',
  borderRadius: bordered ? 4 : 0,
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  overflow: 'hidden',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  userSelect: 'none',
}}>
  {panels.map((panel) => {
    const isActive = activeKeys.includes(panel.key);
    return (
      <div key={panel.key}>
        {/* 패널 헤더 */}
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); handlePanelClick(panel.key); }}
          style={{
            padding: '8px 12px',
            backgroundColor: `${foreColor}08`,
            borderBottom: bordered ? `1px solid ${foreColor}15` : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            flexDirection: expandIconPosition === 'End' ? 'row-reverse' : 'row',
          }}
        >
          <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: isActive ? 'rotate(90deg)' : 'none' }}>
            ▶
          </span>
          <span style={{ color: foreColor, fontWeight: 500, flex: 1 }}>
            {panel.title}
          </span>
        </div>
        {/* 패널 Body (활성 시에만) */}
        {isActive && (
          <div style={{
            padding: '8px 12px',
            backgroundColor: backColor,
            minHeight: 40,
            position: 'relative',
            borderBottom: bordered ? `1px solid ${foreColor}15` : 'none',
          }}>
            {/* 자식 컨트롤은 런타임에서 패널별 매칭 */}
          </div>
        )}
      </div>
    );
  })}
</div>
```

**TabControl 패턴 활용**: `useDesignerStore` + `updateControl`로 디자이너에서 패널 클릭 시 `activeKeys` 토글. `onMouseDown stopPropagation`으로 캔버스 선택 방지.

---

### 2.6 StatisticControl.tsx

**파일**: `packages/designer/src/controls/StatisticControl.tsx`
**카테고리**: `basic`
**기본 크기**: `{ width: 150, height: 80 }`
**테마**: `theme.form.foreground`

#### 속성 추출

```ts
const title = (properties.title as string) ?? 'Statistic';
const value = (properties.value as string) ?? '0';
const prefix = (properties.prefix as string) ?? '';
const suffix = (properties.suffix as string) ?? '';
const precision = (properties.precision as number) ?? 0;
const showGroupSeparator = (properties.showGroupSeparator as boolean) ?? true;
const valueColor = (properties.valueColor as string);
const foreColor = (properties.foreColor as string) || theme.form.foreground;
```

#### 값 포맷 유틸

```ts
function formatValue(val: string, precision: number, showGroupSeparator: boolean): string {
  const num = parseFloat(val);
  if (isNaN(num)) return val; // 비숫자 문자열은 그대로 표시
  let formatted = precision > 0 ? num.toFixed(precision) : Math.round(num).toString();
  if (showGroupSeparator) {
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    formatted = parts.join('.');
  }
  return formatted;
}
```

#### JSX 구조

```tsx
<div style={{
  width: size.width,
  height: size.height,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  boxSizing: 'border-box',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  userSelect: 'none',
  padding: '8px 0',
}}>
  {/* 타이틀 */}
  <div style={{
    fontSize: 14,
    color: `${foreColor}99`,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginBottom: 4,
  }}>
    {title}
  </div>
  {/* 값 */}
  <div style={{
    fontSize: 24,
    fontWeight: 'bold',
    color: valueColor || foreColor,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
  }}>
    {prefix && <span style={{ fontSize: 16, marginRight: 2 }}>{prefix}</span>}
    {formatValue(value, precision, showGroupSeparator)}
    {suffix && <span style={{ fontSize: 16, marginLeft: 2 }}>{suffix}</span>}
  </div>
</div>
```

**기존 패턴과의 차이점**: 숫자 포맷 로직 (`formatValue` 헬퍼). prefix/suffix 인라인 렌더링. valueColor 별도 색상 속성.

---

## 3. registry.ts 수정 계획

**파일**: `packages/designer/src/controls/registry.ts`

### 3.1 import 추가 (기존 Step 1 import 뒤, 라인 38 이후)

```ts
import { CardControl } from './CardControl';
import { BadgeControl } from './BadgeControl';
import { AvatarControl } from './AvatarControl';
import { TooltipControl } from './TooltipControl';
import { CollapseControl } from './CollapseControl';
import { StatisticControl } from './StatisticControl';
```

### 3.2 designerControlRegistry 추가 (Divider 뒤)

```ts
  Divider: DividerControl,
  Card: CardControl,
  Badge: BadgeControl,
  Avatar: AvatarControl,
  Tooltip: TooltipControl,
  Collapse: CollapseControl,
  Statistic: StatisticControl,
```

### 3.3 controlMetadata 추가 (Divider 뒤)

```ts
  { type: 'Divider', displayName: 'Divider', icon: '—', category: 'basic' },

  { type: 'Card',      displayName: 'Card',      icon: '▢', category: 'container' },
  { type: 'Badge',     displayName: 'Badge',     icon: '●', category: 'basic' },
  { type: 'Avatar',    displayName: 'Avatar',    icon: '⊙', category: 'basic' },
  { type: 'Tooltip',   displayName: 'Tooltip',   icon: '💬', category: 'basic' },
  { type: 'Collapse',  displayName: 'Collapse',  icon: '≡', category: 'container' },
  { type: 'Statistic', displayName: 'Statistic', icon: '#', category: 'basic' },
```

> 주의: Statistic의 icon '#'과 NumericUpDown의 icon '#'이 동일. 구분이 필요하면 '∑' 또는 다른 아이콘으로 변경 가능.

---

## 4. 기존 패턴과의 동일점/차이점 요약

### 동일점 (모든 6개 컨트롤)

- `import type { DesignerControlProps } from './registry'`
- `import { useTheme } from '../theme/ThemeContext'`
- `export function XxxControl({ properties, size }: DesignerControlProps)` 시그니처
  - Card, Tooltip, Collapse는 `{ id, properties, size, children }` (Container)
- `const theme = useTheme()` 최상단 호출
- `(properties.xxx as Type) ?? defaultValue` 패턴으로 속성 추출
- `(properties.foreColor as string) || theme.xxx` 색상 우선순위
- 공통 스타일: `fontSize: 'inherit'`, `fontFamily: 'inherit'`, `boxSizing: 'border-box'`, `userSelect: 'none'`

### 차이점

| 컨트롤 | 주요 차이점 |
|--------|------------|
| **Card** | Container 패턴 (children 렌더링). showHeader 조건부 헤더. borderRadius 속성. |
| **Badge** | text 유무에 따라 절대/상대 위치 전환. dot/숫자 모드 분기. STATUS_COLORS 맵. |
| **Avatar** | Math.min(width, height) 기반 정사각형 크기. imageUrl/이니셜 분기. 비례 폰트. |
| **Tooltip** | Container 패턴 (children 래퍼). 디자이너 전용 말풍선 오버레이. 빈 상태 표시. |
| **Collapse** | TabControl 패턴 활용 (useDesignerStore + updateControl). panels 배열 순회. activeKeys 토글. |
| **Statistic** | formatValue 숫자 포맷 헬퍼. prefix/suffix 인라인. valueColor 별도 색상. |

---

## 5. 구현 순서

1. **StatisticControl.tsx** — 가장 단순 (순수 표시, 숫자 포맷만)
2. **AvatarControl.tsx** — 단순 표시 + imageUrl/이니셜 분기
3. **BadgeControl.tsx** — 표시 + 색상 맵 + dot/숫자 분기
4. **CardControl.tsx** — Container 패턴 (Panel과 유사, 헤더 추가)
5. **TooltipControl.tsx** — Container 패턴 (래퍼 + 오버레이)
6. **CollapseControl.tsx** — Container + TabControl 패턴 (가장 복잡)
7. **registry.ts 수정** — 6개 import + registry + metadata 등록

> 각 컨트롤 구현 후 즉시 `pnpm typecheck`으로 타입 오류 확인
