# Step 2 Runtime 컨트롤 구현 계획

> 6개 컨트롤(Card, Badge, Avatar, Tooltip, Collapse, Statistic)의 Runtime 인터랙티브 컴포넌트 구현

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
  on{Event}?: () => void;  // 이벤트 콜백 (무인수)
  children?: ReactNode;    // 컨테이너 컨트롤용
  [key: string]: unknown;  // SDUIRenderer spread 허용
}
```

### 상태 업데이트 패턴
```ts
const updateControlState = useRuntimeStore((s) => s.updateControlState);
updateControlState(id, 'propertyName', newValue);
onEventCallback?.();
```

### 테마 색상 패턴
```ts
const colors = useControlColors('ControlType', { backColor, foreColor });
// colors.backgroundColor, colors.color 사용
```

### 컨테이너 컨트롤 패턴 (Panel/GroupBox/TabControl 참고)
- `children?: ReactNode` prop으로 자식 컨트롤 수신
- `ControlRenderer`가 `definition.children`을 재귀 렌더링하여 `children` prop으로 전달
- 컨테이너 내부에서 `{children}`으로 자식 컨트롤 배치
- `position: 'relative'` + 자식은 absolute 포지셔닝 (SDUI 좌표계)
- TabControl 패턴: `childArray[selectedIndex]`로 활성 탭의 자식만 표시

---

## 2. 생성 파일 목록 (6개)

| # | 파일 | 설명 |
|---|------|------|
| 1 | `packages/runtime/src/controls/Card.tsx` | 모던 컨테이너 카드 |
| 2 | `packages/runtime/src/controls/Badge.tsx` | 숫자/상태 뱃지 |
| 3 | `packages/runtime/src/controls/Avatar.tsx` | 사용자 아바타 |
| 4 | `packages/runtime/src/controls/Tooltip.tsx` | 툴팁 래퍼 |
| 5 | `packages/runtime/src/controls/Collapse.tsx` | 아코디언 패널 |
| 6 | `packages/runtime/src/controls/Statistic.tsx` | 통계 수치 표시 |

## 3. 수정 파일 목록 (2개)

| # | 파일 | 작업 |
|---|------|------|
| 1 | `packages/runtime/src/controls/registry.ts` | 6개 import + registry 등록 |
| 2 | `packages/runtime/src/theme/useControlColors.ts` | controlThemeMap에 6개 타입 매핑 추가 |

---

## 4. 각 컴포넌트 상세 구현 계획

### 4.1 Card.tsx

**Props:**
```ts
interface CardProps {
  id: string;
  name: string;
  title?: string;            // default: 'Card Title'
  subtitle?: string;         // default: ''
  showHeader?: boolean;      // default: true
  showBorder?: boolean;      // default: true
  hoverable?: boolean;       // default: false
  size?: 'Default' | 'Small';  // default: 'Default'
  borderRadius?: number;     // default: 8
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}
```

**상태 관리:**
- 내부 상태: `isHovered: boolean` (useState) — hoverable 시각 피드백용
- 이벤트 콜백 없음 (공통 이벤트만)

**렌더링 구조:**
```tsx
<div className="wf-card" data-control-id={id} style={containerStyle}
     onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
  {showHeader && (
    <div style={headerStyle}>
      <div style={{ fontWeight: 'bold', fontSize: size === 'Small' ? '0.9em' : '1em' }}>
        {title}
      </div>
      {subtitle && <div style={{ fontSize: '0.8em', opacity: 0.65 }}>{subtitle}</div>}
      <div style={dividerStyle} />  {/* 1px solid 구분선 */}
    </div>
  )}
  <div style={bodyStyle}>
    {children}
  </div>
</div>
```

**스타일 상세:**
- 컨테이너:
  - `position: 'relative'` (자식 absolute 포지셔닝용)
  - `borderRadius: borderRadius + 'px'`
  - `border: showBorder ? '1px solid rgba(0,0,0,0.1)' : 'none'`
  - 기본 `boxShadow: '0 1px 2px rgba(0,0,0,0.06)'`
  - `hoverable && isHovered` 시: `boxShadow: '0 4px 12px rgba(0,0,0,0.15)'`
  - `transition: 'box-shadow 0.3s ease'`
  - `overflow: 'hidden'`
- 헤더: `padding: size === 'Small' ? '8px 12px' : '12px 16px'`
- 구분선: `borderBottom: '1px solid rgba(0,0,0,0.06)'`
- body: `position: 'relative'`, `flex: 1` (자식 컨트롤 영역)

**hoverable 구현:**
```ts
const [isHovered, setIsHovered] = useState(false);
const handleMouseEnter = () => { if (hoverable) setIsHovered(true); };
const handleMouseLeave = () => { if (hoverable) setIsHovered(false); };
```

**테마 매핑:**
- `controlThemeMap.Card` → Panel 토큰 재사용
  - `background: t.controls.panel.background, foreground: t.form.foreground`

---

### 4.2 Badge.tsx

**Props:**
```ts
interface BadgeProps {
  id: string;
  name: string;
  count?: number;            // default: 0
  overflowCount?: number;    // default: 99
  showZero?: boolean;        // default: false
  dot?: boolean;             // default: false
  status?: 'Default' | 'Success' | 'Processing' | 'Error' | 'Warning';
  text?: string;             // default: ''
  badgeColor?: string;
  offset?: string;           // default: ''
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}
```

**상태 관리:**
- 없음 (순수 표시 컨트롤. 이벤트 핸들러에서 count/status 동적 변경)

**상태별 색상 맵 (상수):**
```ts
const STATUS_COLORS: Record<string, string> = {
  Default: '#ff4d4f',
  Success: '#52c41a',
  Processing: '#1677ff',
  Error: '#ff4d4f',
  Warning: '#faad14',
};
```

**렌더링 구조 — text 있을 때 (콘텐츠 + 뱃지):**
```tsx
<div className="wf-badge" data-control-id={id} style={containerStyle}>
  <span>{text}</span>
  {shouldShowBadge && (
    <span style={badgeStyle}>
      {dot ? null : displayCount}
    </span>
  )}
</div>
```

**렌더링 구조 — text 없을 때 (독립 뱃지):**
```tsx
<div className="wf-badge" data-control-id={id} style={containerStyle}>
  <span style={badgeStyle}>
    {dot ? null : displayCount}
  </span>
</div>
```

**뱃지 표시 로직:**
```ts
const shouldShowBadge = dot || count > 0 || showZero;
const displayCount = count > overflowCount ? `${overflowCount}+` : `${count}`;
```

**스타일 상세:**
- 컨테이너: `display: 'inline-flex', position: 'relative', alignItems: 'center'`
- 뱃지 (숫자):
  - text가 있으면 `position: 'absolute', top: 0, right: 0, transform: 'translate(50%, -50%)'`
  - `minWidth: 20px, height: 20px, borderRadius: 10px`
  - `backgroundColor: badgeColor || statusColor`
  - `color: '#fff', fontSize: '0.75em', fontWeight: 'bold'`
  - `display: 'flex', alignItems: 'center', justifyContent: 'center'`
  - `padding: '0 6px'`
- 뱃지 (dot):
  - `width: 6, height: 6, borderRadius: '50%'`
  - text가 있으면 같은 absolute 위치

**Processing 애니메이션:**
- CSS @keyframes는 인라인으로 구현 불가 → `animationName` 대신 간단한 방법 사용
- `status === 'Processing'`일 때 인라인 `<style>` 태그로 keyframes 주입하거나,
  또는 더 간단하게: `box-shadow` + `animation` 대신 CSS `opacity` 깜빡임을 `setInterval`로 구현
- **권장 구현**: 컴포넌트 마운트 시 `<style>` 태그를 동적으로 삽입하는 대신, `useEffect` + `useState`로 opacity 토글 (0.4s 간격)
```ts
const [pulse, setPulse] = useState(true);
useEffect(() => {
  if (status !== 'Processing') return;
  const timer = setInterval(() => setPulse(p => !p), 800);
  return () => clearInterval(timer);
}, [status]);
```
- pulse 값에 따라 뱃지 dot의 opacity를 0.4 / 1.0으로 토글, `transition: 'opacity 0.4s ease'`

**테마 매핑:**
- `controlThemeMap.Badge` → 폼 기본값
  - `background: t.form.backgroundColor, foreground: t.form.foreground`
  - 실제 뱃지 색상은 `STATUS_COLORS[status]`에서 가져옴

---

### 4.3 Avatar.tsx

**Props:**
```ts
interface AvatarProps {
  id: string;
  name: string;
  imageUrl?: string;         // default: ''
  text?: string;             // default: 'U'
  shape?: 'Circle' | 'Square';  // default: 'Circle'
  backColor?: string;        // default: '#1677ff'
  foreColor?: string;        // default: '#ffffff'
  style?: CSSProperties;
  enabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}
```

**상태 관리:**
- 내부 상태: `imgError: boolean` (useState) — 이미지 로딩 실패 시 폴백용
- 클릭 이벤트: `onClick?.()` 콜백

**렌더링 구조:**
```tsx
<div className="wf-avatar" data-control-id={id}
     style={containerStyle} onClick={handleClick}>
  {imageUrl && !imgError ? (
    <img src={imageUrl} alt={text}
         style={imgStyle}
         onError={() => setImgError(true)} />
  ) : (
    <span style={initialStyle}>{initials}</span>
  )}
</div>
```

**이니셜 계산:**
```ts
const initials = (text || 'U').slice(0, 2).toUpperCase();
```

**스타일 상세:**
- 크기: `style`에서 `width`, `height` 가져오되, 실제 아바타 크기는 `min(width, height)` 기준
- 컨테이너:
  - `display: 'flex', alignItems: 'center', justifyContent: 'center'`
  - `borderRadius: shape === 'Circle' ? '50%' : '4px'`
  - `backgroundColor: colors.backgroundColor` (기본 `#1677ff`)
  - `color: colors.color` (기본 `#ffffff`)
  - `overflow: 'hidden'`
  - `cursor: onClick ? 'pointer' : 'default'`
  - `userSelect: 'none'`
- 이미지: `width: '100%', height: '100%', objectFit: 'cover'`
- 이니셜: `fontSize: '크기의 40%', fontWeight: 'bold'`

**테마 매핑:**
- `controlThemeMap.Avatar` → 폼 기본값
  - `background: t.form.backgroundColor, foreground: t.form.foreground`
  - 실제 기본 색상은 props default(`#1677ff` / `#ffffff`)로 처리

---

### 4.4 Tooltip.tsx

**Props:**
```ts
interface TooltipProps {
  id: string;
  name: string;
  title?: string;            // default: 'Tooltip text'
  placement?: 'Top' | 'Bottom' | 'Left' | 'Right' | 'TopLeft' | 'TopRight' | 'BottomLeft' | 'BottomRight';
  trigger?: 'Hover' | 'Click' | 'Focus';  // default: 'Hover'
  backColor?: string;        // default: 'rgba(0,0,0,0.85)'
  foreColor?: string;        // default: '#ffffff'
  style?: CSSProperties;
  enabled?: boolean;
  onVisibleChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}
```

**상태 관리:**
- 내부 상태: `isVisible: boolean` (useState) — 팝업 표시 여부
- `updateControlState(id, 'tooltipVisible', isVisible)` → `onVisibleChanged?.()`

**트리거별 이벤트 핸들러:**
```ts
const triggerProps: Record<string, object> = {};

if (trigger === 'Hover') {
  triggerProps.onMouseEnter = () => show();
  triggerProps.onMouseLeave = () => hide();
} else if (trigger === 'Click') {
  triggerProps.onClick = () => toggle();
} else if (trigger === 'Focus') {
  triggerProps.onFocus = () => show();
  triggerProps.onBlur = () => hide();
}
```

**렌더링 구조:**
```tsx
<div className="wf-tooltip" data-control-id={id}
     style={{ ...style, position: 'relative' }} {...triggerProps}>
  {children}
  {isVisible && title && (
    <div style={popupStyle}>
      {title}
      <div style={arrowStyle} />  {/* 화살표 */}
    </div>
  )}
</div>
```

**placement별 팝업 위치 계산:**
```ts
const PLACEMENT_STYLES: Record<string, CSSProperties> = {
  Top:         { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8 },
  Bottom:      { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 },
  Left:        { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 },
  Right:       { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 },
  TopLeft:     { bottom: '100%', left: 0, marginBottom: 8 },
  TopRight:    { bottom: '100%', right: 0, marginBottom: 8 },
  BottomLeft:  { top: '100%', left: 0, marginTop: 8 },
  BottomRight: { top: '100%', right: 0, marginTop: 8 },
};
```

**팝업 스타일:**
- `position: 'absolute', zIndex: 1000`
- `backgroundColor: backColor || 'rgba(0,0,0,0.85)'`
- `color: foreColor || '#ffffff'`
- `padding: '6px 8px', borderRadius: '6px'`
- `fontSize: '0.85em', whiteSpace: 'nowrap'`
- `pointerEvents: 'none'` (팝업이 이벤트를 가로채지 않도록)

**화살표 (arrow):**
- CSS border trick으로 삼각형 생성
- placement에 따라 위치/방향 조정
- 구현 복잡도를 줄이기 위해 화살표 생략도 가능하나, 스펙에 "dark rounded box + arrow"로 명시되어 있으므로 구현
```ts
// Top placement 기준 arrow (하단 중앙, 아래를 가리킴)
const arrowStyle: CSSProperties = {
  position: 'absolute',
  // placement에 따라 top/bottom/left/right 동적 설정
  width: 0, height: 0,
  borderLeft: '5px solid transparent',
  borderRight: '5px solid transparent',
  borderTop: `5px solid ${resolvedBgColor}`,  // Top의 경우
};
```

**테마 매핑:**
- `controlThemeMap.Tooltip` → 폼 기본값
  - `background: t.form.backgroundColor, foreground: t.form.foreground`
  - 실제 팝업 색상은 props에서 직접 가져옴

---

### 4.5 Collapse.tsx

**Props:**
```ts
interface CollapsePanel {
  title: string;
  key: string;
}

interface CollapseProps {
  id: string;
  name: string;
  panels?: CollapsePanel[];    // default: [{ title: 'Panel 1', key: '1' }, { title: 'Panel 2', key: '2' }]
  activeKeys?: string;         // default: '1' (쉼표 구분 문자열)
  accordion?: boolean;         // default: false
  bordered?: boolean;          // default: true
  expandIconPosition?: 'Start' | 'End';  // default: 'Start'
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onActiveKeyChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}
```

**상태 관리:**
- `activeKeys` 문자열 → 배열로 파싱: `activeKeys.split(',').map(s => s.trim()).filter(Boolean)`
- 패널 헤더 클릭 시:
  - accordion=true: 해당 key만 열림 (나머지 닫힘)
  - accordion=false: 해당 key 토글
- `updateControlState(id, 'activeKeys', newActiveKeys.join(','))`
- `onActiveKeyChanged?.()`

**children 분배 (TabControl 패턴 참고):**
```ts
const childArray = Array.isArray(children) ? children : children ? [children] : [];
// panels[i]에 해당하는 자식 = childArray[i]
```

**렌더링 구조:**
```tsx
<div className="wf-collapse" data-control-id={id} style={containerStyle}>
  {(panels || []).map((panel, index) => {
    const isActive = activeKeySet.has(panel.key);
    return (
      <div key={panel.key} style={panelContainerStyle}>
        {/* 패널 헤더 */}
        <div style={headerStyle} onClick={() => handleToggle(panel.key)}>
          {expandIconPosition === 'Start' && <span style={iconStyle}>{isActive ? '▼' : '▶'}</span>}
          <span style={{ flex: 1 }}>{panel.title}</span>
          {expandIconPosition === 'End' && <span style={iconStyle}>{isActive ? '▼' : '▶'}</span>}
        </div>
        {/* 패널 본문 — height transition으로 열림/닫힘 애니메이션 */}
        <div style={{
          overflow: 'hidden',
          maxHeight: isActive ? '9999px' : '0px',
          transition: 'max-height 0.3s ease',
        }}>
          <div style={bodyStyle}>
            {childArray[index]}
          </div>
        </div>
      </div>
    );
  })}
</div>
```

**토글 로직:**
```ts
const handleToggle = (key: string) => {
  if (!enabled) return;
  let newKeys: string[];
  if (accordion) {
    newKeys = activeKeySet.has(key) ? [] : [key];
  } else {
    newKeys = activeKeySet.has(key)
      ? activeKeyArray.filter(k => k !== key)
      : [...activeKeyArray, key];
  }
  updateControlState(id, 'activeKeys', newKeys.join(','));
  onActiveKeyChanged?.();
};
```

**스타일 상세:**
- 컨테이너:
  - `border: bordered ? '1px solid rgba(0,0,0,0.1)' : 'none'`
  - `borderRadius: '8px'`
  - `overflow: 'hidden'`
- 헤더:
  - `padding: '8px 12px'`
  - `backgroundColor: 'rgba(0,0,0,0.02)'` (약간 어둡게)
  - `cursor: 'pointer'`
  - `display: 'flex', alignItems: 'center', gap: '8px'`
  - `borderBottom: bordered ? '1px solid rgba(0,0,0,0.06)' : 'none'`
  - `userSelect: 'none'`
- 아이콘: `fontSize: '0.7em', transition: 'transform 0.3s'`
- body:
  - `position: 'relative'` (자식 컨트롤 absolute 포지셔닝용)
  - `padding: '12px'`

**height transition 구현:**
- 정확한 height 트랜지션은 동적 높이 측정이 필요하여 복잡
- 실용적 접근: `maxHeight: isActive ? '9999px' : '0px'` + `overflow: hidden` + `transition: max-height 0.3s ease`
- 닫힘은 자연스럽지만 열림이 살짝 지연될 수 있음 → 충분히 수용 가능한 수준

**테마 매핑:**
- `controlThemeMap.Collapse` → Panel 토큰 재사용
  - `background: t.controls.panel.background, foreground: t.form.foreground`

---

### 4.6 Statistic.tsx

**Props:**
```ts
interface StatisticProps {
  id: string;
  name: string;
  title?: string;            // default: 'Statistic'
  value?: string;            // default: '0'
  prefix?: string;           // default: ''
  suffix?: string;           // default: ''
  precision?: number;        // default: 0
  showGroupSeparator?: boolean;  // default: true
  valueColor?: string;
  foreColor?: string;
  backColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}
```

**상태 관리:**
- 없음 (순수 표시 컨트롤. 이벤트 핸들러에서 value/title 등 동적 변경)

**값 포맷 함수:**
```ts
function formatValue(value: string, precision: number, showGroupSeparator: boolean): string {
  const num = Number(value);
  if (isNaN(num)) return value;  // 비숫자 문자열은 그대로 표시

  let formatted = precision > 0 ? num.toFixed(precision) : String(Math.round(num));

  if (showGroupSeparator) {
    const [intPart, decPart] = formatted.split('.');
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    formatted = decPart ? `${withCommas}.${decPart}` : withCommas;
  }

  return formatted;
}
```

**렌더링 구조:**
```tsx
<div className="wf-statistic" data-control-id={id} style={containerStyle}>
  {title && <div style={titleStyle}>{title}</div>}
  <div style={valueContainerStyle}>
    {prefix && <span style={affixStyle}>{prefix}</span>}
    <span style={valueStyle}>{formattedValue}</span>
    {suffix && <span style={affixStyle}>{suffix}</span>}
  </div>
</div>
```

**스타일 상세:**
- 컨테이너: `boxSizing: 'border-box'`
- title: `fontSize: '0.85em', color: colors.color, opacity: 0.65, marginBottom: '4px'`
- value 컨테이너: `display: 'flex', alignItems: 'baseline', gap: '4px'`
- value: `fontSize: '24px', fontWeight: 'bold', color: valueColor || colors.color`
- prefix/suffix: `fontSize: '0.85em', color: colors.color`

**테마 매핑:**
- `controlThemeMap.Statistic` → 폼 기본값
  - `background: t.form.backgroundColor, foreground: t.form.foreground`

---

## 5. registry.ts 수정 내용

```ts
// 추가 import (기존 import 블록 하단에)
import { Card } from './Card';
import { Badge } from './Badge';
import { Avatar } from './Avatar';
import { Tooltip } from './Tooltip';
import { Collapse } from './Collapse';
import { Statistic } from './Statistic';

// registry 객체에 추가 (기존 항목 이후)
export const runtimeControlRegistry: Partial<Record<ControlType, ComponentType<any>>> = {
  // ... 기존 34개 (Step 1 포함) ...
  Card,
  Badge,
  Avatar,
  Tooltip,
  Collapse,
  Statistic,
};
```

---

## 6. useControlColors.ts 수정 내용

`controlThemeMap` 객체에 6개 항목 추가:

```ts
const controlThemeMap: Record<string, ThemeColorResolver> = {
  // ... 기존 매핑 ...

  // Step 2 신규 컨트롤
  Card: (t) => ({ background: t.controls.panel.background, foreground: t.form.foreground }),
  Badge: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Avatar: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Tooltip: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
  Collapse: (t) => ({ background: t.controls.panel.background, foreground: t.form.foreground }),
  Statistic: (t) => ({ background: t.form.backgroundColor, foreground: t.form.foreground }),
};
```

- Card, Collapse는 컨테이너 → `panel` 토큰 재사용
- Badge/Avatar/Tooltip/Statistic은 자체 색상 로직 → 폼 기본값

---

## 7. 구현 순서

1. `useControlColors.ts` — controlThemeMap에 6개 타입 매핑 추가
2. `Statistic.tsx` — 가장 단순 (순수 표시, 값 포맷만)
3. `Badge.tsx` — 순수 표시 + Processing 애니메이션
4. `Avatar.tsx` — 이미지 폴백 로직 + 클릭 이벤트
5. `Card.tsx` — 컨테이너 (Panel 패턴 기반, hoverable 추가)
6. `Tooltip.tsx` — 트리거별 이벤트 + 팝업 위치 계산
7. `Collapse.tsx` — 가장 복잡 (아코디언, 자식 분배, height transition)
8. `registry.ts` — 6개 import + 등록

---

## 8. 주의사항

- **이벤트 콜백은 무인수 함수**: `onVisibleChanged?.()`, `onActiveKeyChanged?.()` 패턴. eventArgs는 서버 사이드 `EventEngine`이 구성
- **children은 ControlRenderer가 전달**: 컨테이너 컨트롤(Card, Tooltip, Collapse)은 `children` prop으로 자식 컨트롤을 수신
- **Collapse의 자식 분배**: TabControl과 동일한 `childArray[index]` 패턴으로 패널별 자식 매핑
- **style prop 병합**: 항상 `...style`을 마지막에 spread하여 외부 레이아웃 스타일 적용
- **data-control-id**: 모든 루트 요소에 필수
- **[key: string]: unknown**: Props 인터페이스에 index signature 포함
- **useState 사용**: Card(isHovered), Badge(pulse), Avatar(imgError), Tooltip(isVisible)
- **Processing 애니메이션**: CSS @keyframes 대신 useEffect + useState로 opacity 토글 (인라인 스타일 한계)
- **Tooltip z-index**: 다른 컨트롤 위에 표시되도록 `zIndex: 1000` 필요
- **Collapse max-height 트릭**: 정확한 height transition 대신 `maxHeight: '9999px'` 방식 사용 (실용적 타협)
