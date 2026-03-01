# [Phase2] MCP 기본값 - SwaggerConnector 추가 계획

## 개요

`packages/mcp/src/utils/controlDefaults.ts`의 `CONTROL_DEFAULTS` 객체에 SwaggerConnector 기본값을 추가한다.

## 분석 결과

### 현재 파일 구조 (`controlDefaults.ts`)

- **ControlDefault 인터페이스**: `{ size, properties, description, category, isContainer }` (3-9줄)
- **CONTROL_DEFAULTS**: `Record<ControlType, ControlDefault>` 타입, 44개 컨트롤 정의 (15-434줄)
- **MongoDBConnector 항목** (289-301줄):
  ```typescript
  MongoDBConnector: {
    size: { width: 120, height: 40 },
    properties: {
      connectionString: '',
      database: '',
      defaultCollection: '',
      queryTimeout: 10000,
      maxResultCount: 1000,
    },
    description: 'MongoDB 연결',
    category: '고급',
    isContainer: false,
  },
  ```
- MongoDBConnector는 "고급 컨트롤 (10종)" 섹션의 마지막 항목

### 패턴 분석

- 비-UI 커넥터 컨트롤 패턴: 작은 크기(120x40), 빈 문자열 기본값, `category: '고급'`, `isContainer: false`
- properties에 커넥터 연결 정보와 동작 설정 포함
- 문자열 기본값은 `''`, 숫자 기본값은 실제 값, JSON 문자열은 `'{}'`

## 수정 계획

### 대상 파일

`packages/mcp/src/utils/controlDefaults.ts`

### 추가 내용

MongoDBConnector 항목(301줄) 바로 뒤에 다음을 추가:

```typescript
SwaggerConnector: {
  size: { width: 180, height: 40 },
  properties: {
    specYaml: '',
    baseUrl: '',
    defaultHeaders: '{}',
    timeout: 10000,
  },
  description: 'Swagger/OpenAPI REST 클라이언트',
  category: '고급',
  isContainer: false,
},
```

### 속성 설명

| 속성 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| specYaml | string | `''` | Swagger/OpenAPI YAML 스펙 문자열 |
| baseUrl | string | `''` | API 기본 URL (미지정 시 스펙의 servers[0].url 사용) |
| defaultHeaders | string | `'{}'` | 기본 HTTP 헤더 (JSON 문자열) |
| timeout | number | `10000` | HTTP 요청 타임아웃 (ms) |

### 크기 결정 근거

- MongoDBConnector: `120x40` — 텍스트가 짧음 ("MongoDB 연결")
- SwaggerConnector: `180x40` — "Swagger/OpenAPI" 레이블이 더 길어 약간 넓게 설정
- 높이 40은 MongoDBConnector와 동일 (비-UI 커넥터 표준 높이)

### 섹션 주석 수정

"고급 컨트롤 (10종)" → "고급 컨트롤 (11종)"으로 업데이트

## 전제 조건

- `packages/common/src/types/form.ts`의 `CONTROL_TYPES`에 `'SwaggerConnector'`가 이미 추가되어 있어야 함 (Phase1 common-types-commit에서 완료)
- `ControlType` 타입에 `'SwaggerConnector'`가 포함되지 않으면 TypeScript 타입 에러 발생

## 검증 방법

1. `pnpm typecheck` — `Record<ControlType, ControlDefault>` 타입 만족 확인
2. `pnpm lint` — 코드 스타일 검증
