# Runtime SwaggerConnector 컴포넌트 구현 계획

## 개요
SwaggerConnector는 MongoDBConnector와 동일한 비시각적(non-UI) 컨트롤이다. 런타임에서 렌더링하지 않으며 `return null`을 반환한다.

## 변경 파일

### 1. 신규: `packages/runtime/src/controls/SwaggerConnector.tsx`

MongoDBConnector.tsx와 동일한 패턴으로 작성한다.

```tsx
// 비시각적 컴포넌트: 런타임에서 렌더링하지 않음
export function SwaggerConnector() {
  return null;
}
```

### 2. 수정: `packages/runtime/src/controls/registry.ts`

#### import 추가 (33행 `MongoDBConnector` import 다음)

```ts
import { SwaggerConnector } from './SwaggerConnector';
```

#### runtimeControlRegistry 객체에 등록 (78행 `MongoDBConnector` 다음)

```ts
  SwaggerConnector,
```

## 참고
- `ControlType`에 `'SwaggerConnector'`는 이미 `packages/common/src/types/form.ts`에 정의되어 있음
- 추가 props 타입 없음 (MongoDBConnector와 동일하게 인자 없는 함수 컴포넌트)
