# [Phase2] Designer SwaggerConnector UI 구현 계획

## 분석 결과 요약

### 기존 패턴 분석

#### 1. MongoDBConnectorControl.tsx (비-UI 컨트롤 디자이너 표시 패턴)
- `useTheme()` 훅으로 테마 색상 참조
- 점선 테두리 (`border: 1px dashed ...`)
- 아이콘 + 상태 텍스트 (연결 여부) 표시
- `DesignerControlProps` 타입 사용 (`{ properties, size }`)
- 파일 위치: `packages/designer/src/controls/MongoDBConnectorControl.tsx`

#### 2. controlProperties.ts (PropertyMeta 정의 패턴)
- `EditorType` 유니온 타입에 커스텀 에디터 타입 선언 (예: `'mongoConnectionString'`, `'mongoColumns'`)
- MongoDBConnector는 `withCommon()` 미사용, 직접 배열 정의 (비-UI 컨트롤이므로 공통 Layout/Behavior 속성 최소화)
- `CONTROL_PROPERTY_META` 객체에 등록

#### 3. PropertyCategory.tsx (editorType 분기 처리)
- `PropertyEditor` 함수 내 `switch (meta.editorType)` 문에서 각 타입별 에디터 컴포넌트 렌더링
- 커스텀 에디터는 `./editors/` 디렉토리에서 import
- 각 에디터 컴포넌트는 `{ value, onChange }` props 패턴 사용

#### 4. Monaco Editor 사용 패턴
- `@monaco-editor/react` 패키지의 `Editor` 컴포넌트 사용 (이미 designer 패키지 의존성에 포함)
- `import Editor, { type OnMount } from '@monaco-editor/react'` 패턴
- EventEditor.tsx에서 JavaScript 모드로 사용 중

#### 5. registry.ts (컨트롤 등록 패턴)
- `ControlMeta.category` 타입: `'basic' | 'container' | 'data' | 'database'`
- **주의**: task에서 `category: 'advanced'` 지정되어 있으나, 현재 타입에 'advanced'가 없음
- MongoDBConnector는 `category: 'database'` 사용 → SwaggerConnector도 `'database'` 사용
- `TOOLBOX_CATEGORIES`에 `{ id: 'database', name: '데이터베이스' }` 존재

---

## 구현 계획

### 1. SwaggerConnectorControl.tsx (신규 생성)

**파일**: `packages/designer/src/controls/SwaggerConnectorControl.tsx`

MongoDBConnectorControl 패턴을 따라 구현:

```typescript
import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

export function SwaggerConnectorControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const specYaml = (properties.specYaml as string) || '';
  const baseUrl = (properties.baseUrl as string) || '';
  const hasSpec = specYaml.length > 0;

  // 간이 파싱: title 추출
  let title = 'Swagger API';
  let endpointCount = 0;
  if (hasSpec) {
    const titleMatch = specYaml.match(/title:\s*['"]?([^'"\n]+)/);
    if (titleMatch) title = titleMatch[1].trim();
    // HTTP 메서드 라인 카운트로 endpoint 수 추정
    endpointCount = (specYaml.match(/^\s+(get|post|put|patch|delete):/gm) || []).length;
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 8px',
      border: `1px dashed ${theme.controls.panel.border}`,
      borderRadius: theme.controls.panel.borderRadius,
      backgroundColor: theme.controls.panel.background,
      width: size.width, height: size.height,
      boxSizing: 'border-box', overflow: 'hidden', whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>🔗</span>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#334E68' }}>
          {title}
        </span>
        <span style={{ fontSize: 9, color: hasSpec ? '#627D98' : '#D64545' }}>
          {hasSpec
            ? `${endpointCount} endpoints` + (baseUrl ? ` · ${baseUrl}` : '')
            : 'Not configured'}
        </span>
      </div>
    </div>
  );
}
```

**핵심 포인트:**
- `useTheme()` 훅 사용 (MongoDBConnectorControl과 동일)
- specYaml에서 title/endpoint count 정규식으로 간이 추출 (정확한 파싱은 서버의 SwaggerParser 담당)
- 아이콘: 🔗
- 미설정 시 'Not configured' 빨간색 표시

---

### 2. SwaggerSpecEditor.tsx (신규 생성)

**파일**: `packages/designer/src/components/PropertyPanel/editors/SwaggerSpecEditor.tsx`

Monaco Editor 기반 YAML 에디터:

```typescript
import { useState, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';

interface SwaggerSpecEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function SwaggerSpecEditor({ value, onChange }: SwaggerSpecEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationInfo, setValidationInfo] = useState<string>('');

  // YAML 간이 검증 (title, endpoint count 추출)
  const validate = useCallback((yaml: string) => {
    if (!yaml.trim()) { setValidationInfo(''); return; }
    const titleMatch = yaml.match(/title:\s*['"]?([^'"\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : 'Unknown';
    const endpoints = (yaml.match(/^\s+(get|post|put|patch|delete):/gm) || []).length;
    setValidationInfo(`${title} — ${endpoints} endpoints`);
  }, []);

  const handleEditorChange = useCallback((val: string | undefined) => {
    const newVal = val ?? '';
    onChange(newVal);
    validate(newVal);
  }, [onChange, validate]);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      onChange(text);
      validate(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [onChange, validate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {validationInfo && (
          <span style={{ fontSize: 10, color: '#2e7d32', flex: 1 }}>{validationInfo}</span>
        )}
        <button type="button" onClick={() => fileInputRef.current?.click()}
          style={{
            border: '1px solid #0078d4', borderRadius: 2, backgroundColor: '#0078d4',
            color: '#fff', fontSize: 10, padding: '1px 6px', cursor: 'pointer',
            whiteSpace: 'nowrap', flex: '0 0 auto',
          }}>
          Import
        </button>
        <input ref={fileInputRef} type="file" accept=".yaml,.yml"
          onChange={handleFileImport} style={{ display: 'none' }} />
      </div>
      <Editor
        height={200}
        language="yaml"
        value={value}
        onChange={handleEditorChange}
        options={{
          minimap: { enabled: false }, lineNumbers: 'off', fontSize: 11,
          scrollBeyondLastLine: false, wordWrap: 'on', tabSize: 2,
        }}
      />
    </div>
  );
}
```

**핵심 포인트:**
- `@monaco-editor/react`의 `Editor` 컴포넌트 사용 (EventEditor.tsx 패턴)
- language: `'yaml'`
- 파일 Import: `<input type="file" accept=".yaml,.yml">` hidden + button 트리거
- 간이 검증 결과 (title + endpoint count) 표시
- 높이 200px 고정 (PropertyPanel 내 적절한 크기)
- Import 버튼 스타일: MongoConnectionStringEditor의 Test 버튼 스타일 참고

---

### 3. controlProperties.ts 수정

**파일**: `packages/designer/src/components/PropertyPanel/controlProperties.ts`

#### 3-1. EditorType 유니온에 'swaggerSpec' 추가 (line 19 근처)

```typescript
// 변경 전:
  | 'statusStripEditor';

// 변경 후:
  | 'statusStripEditor'
  | 'swaggerSpec';
```

#### 3-2. swaggerConnectorProps 배열 추가 (mongoDBConnectorProps 뒤, line 328 이후)

```typescript
const swaggerConnectorProps: PropertyMeta[] = [
  { name: 'name',                       label: 'Name',            category: 'Design',   editorType: 'text' },
  { name: 'properties.specYaml',        label: 'Spec (YAML)',     category: 'Data',     editorType: 'swaggerSpec' },
  { name: 'properties.baseUrl',         label: 'Base URL',        category: 'Data',     editorType: 'text' },
  { name: 'properties.defaultHeaders',  label: 'DefaultHeaders',  category: 'Data',     editorType: 'text' },
  { name: 'properties.timeout',         label: 'Timeout (ms)',    category: 'Behavior', editorType: 'number', min: 1000, max: 60000, defaultValue: 10000 },
];
```

**참고:** MongoDBConnector와 동일하게 `withCommon()` 미사용 (비-UI 컨트롤)

#### 3-3. CONTROL_PROPERTY_META에 등록 (MongoDBConnector 항목 아래)

```typescript
SwaggerConnector: swaggerConnectorProps,
```

---

### 4. PropertyCategory.tsx 수정

**파일**: `packages/designer/src/components/PropertyPanel/PropertyCategory.tsx`

#### 4-1. SwaggerSpecEditor import 추가 (line 15 근처, 다른 에디터 import들과 함께)

```typescript
import { SwaggerSpecEditor } from './editors/SwaggerSpecEditor';
```

#### 4-2. PropertyEditor switch문에 case 추가 (line 150 statusStripEditor case 아래)

```typescript
case 'swaggerSpec':
  return <SwaggerSpecEditor value={value as string ?? ''} onChange={onChange} />;
```

---

### 5. registry.ts 수정

**파일**: `packages/designer/src/controls/registry.ts`

#### 5-1. import 추가 (line 32 MongoDBConnectorControl import 근처)

```typescript
import { SwaggerConnectorControl } from './SwaggerConnectorControl';
```

#### 5-2. designerControlRegistry에 등록 (line 86 MongoDBConnector 항목 아래)

```typescript
SwaggerConnector: SwaggerConnectorControl,
```

#### 5-3. controlMetadata 배열에 추가 (line 143 MongoDBConnector 항목 아래)

```typescript
{ type: 'SwaggerConnector', displayName: 'SwaggerConnector', icon: '🔗', category: 'database' },
```

**주의:** `category: 'database'` 사용 — task에서 'advanced' 지정되었으나 현재 `ControlMeta.category` 타입 유니온에 `'advanced'`가 없어 `'database'` 사용. MongoDBConnector와 같은 카테고리에 배치.

---

## 수정 파일 요약

| 파일 | 작업 | 변경 내용 |
|------|------|-----------|
| `packages/designer/src/controls/SwaggerConnectorControl.tsx` | **신규** | 디자이너 캔버스 표시 컴포넌트 |
| `packages/designer/src/components/PropertyPanel/editors/SwaggerSpecEditor.tsx` | **신규** | Monaco YAML 에디터 + Import 버튼 |
| `packages/designer/src/components/PropertyPanel/controlProperties.ts` | **수정** | EditorType에 'swaggerSpec' 추가, swaggerConnectorProps 정의, CONTROL_PROPERTY_META 등록 |
| `packages/designer/src/components/PropertyPanel/PropertyCategory.tsx` | **수정** | SwaggerSpecEditor import + switch case 추가 |
| `packages/designer/src/controls/registry.ts` | **수정** | import, designerControlRegistry, controlMetadata 추가 |

## 의존성

- `@monaco-editor/react` — 이미 designer 패키지에 설치됨 (EventEditor에서 사용 중)
- `@webform/common` — Phase1에서 'SwaggerConnector' ControlType 이미 추가됨

## 주의사항

1. MongoDBConnectorControl 패턴 충실히 따를 것 (useTheme, 점선 테두리, 상태 표시)
2. 기존 editorType 처리 파이프라인 유지 (PropertyMeta → PropertyCategory → PropertyEditor switch)
3. category는 'database' 사용 (ControlMeta 타입 제약)
4. specYaml 간이 파싱은 정규식으로만 수행 (정확한 파싱은 서버의 SwaggerParser 담당)
5. 기존 코드 스타일 준수 (singleQuote, trailingComma: all, printWidth: 100, tabWidth: 2)
