# Designer UI 확장 설계 계획 — DataSourcePanel dialect 선택 UI

## 1. 현재 DataSourcePanel.tsx 구조 분석

### 파일 구조 (518줄)

```
[1-17]   API 함수: fetchDataSources()
[19-30]  API 함수: createDataSource()
[32-37]  API 함수: testConnection()
[39-48]  API 함수: previewData()
[50-200] 스타일 객체 (styles)
[202-326] AddDataSourceModal 컴포넌트 (내부 컴포넌트)
[328-364] PreviewTable 컴포넌트 (내부 컴포넌트)
[366-517] DataSourcePanel 메인 컴포넌트
```

### AddDataSourceModal 현재 상태

- **위치**: `DataSourcePanel.tsx` 내부에 선언된 로컬 컴포넌트 (line 211)
- **렌더링**: `DataSourcePanel`의 `showAddModal` 상태로 제어 (line 512)
- **props**: `onClose`, `onSubmit: (ds: Omit<DataSourceDefinition, 'id'>) => void`
- **상태 관리**: `name`, `type`, `connectionString`, `database`, `baseUrl`, `staticData` (6개 useState)
- **문제점**:
  - dialect가 `'mongodb'`로 **하드코딩** (line 224)
  - SQL DB 설정 필드 (host, port, user, password, ssl) 없음
  - dialect 드롭다운 없음

### 서버 API 현황

**GET /api/datasources/dialects** (datasources.ts:15-17)
- 응답: `{ data: [{ dialect: string, displayName: string }] }`
- 현재 등록된 dialect: MongoDB, PostgreSQL, MySQL, MSSQL

**DatabaseConfig 타입** (datasource.ts:3-14)
```typescript
interface DatabaseConfig {
  dialect: DatabaseDialect;
  connectionString?: string;  // MongoDB용
  host?: string;              // SQL DB 공통
  port?: number;
  user?: string;
  password?: string;
  database: string;           // 공통 (필수)
  ssl?: boolean;
}
```

**기본 포트** (각 어댑터에서 확인):
- PostgreSQL: 5432
- MySQL: 3306
- MSSQL: 1433

---

## 2. Dialect Fetch 시점

### 선택: type이 'database'로 변경될 때 fetch

**이유:**
- 모달이 열릴 때 fetch하면 type이 restApi/static인 경우 불필요한 API 호출 발생
- type이 'database'로 처음 변경되는 시점에 fetch하고, 결과를 캐시(상태 보관)
- 이후 type을 변경했다가 다시 'database'로 돌아오면 이미 로드된 데이터 재사용

**구현:**
```typescript
const [dialects, setDialects] = useState<Array<{ dialect: string; displayName: string }>>([]);
const [dialectsLoaded, setDialectsLoaded] = useState(false);

useEffect(() => {
  if (type === 'database' && !dialectsLoaded) {
    fetch(`${DESIGNER_API}/datasources/dialects`)
      .then(res => res.json())
      .then(json => {
        setDialects(json.data);
        setDialectsLoaded(true);
        // 첫 번째 dialect를 기본값으로 설정
        if (json.data.length > 0) {
          setDialect(json.data[0].dialect);
        }
      })
      .catch(console.error);
  }
}, [type, dialectsLoaded]);
```

---

## 3. 상태 관리 방법 (useState 목록)

### 기존 유지 (6개)
| 상태 | 타입 | 용도 |
|------|------|------|
| `name` | `string` | 데이터소스 이름 |
| `type` | `DsType` | 유형 (database/restApi/static) |
| `connectionString` | `string` | MongoDB 연결 문자열 |
| `database` | `string` | 데이터베이스 이름 (MongoDB + SQL 공통) |
| `baseUrl` | `string` | REST API Base URL |
| `staticData` | `string` | Static 데이터 JSON |

### 신규 추가 (8개)
| 상태 | 타입 | 기본값 | 용도 |
|------|------|--------|------|
| `dialects` | `Array<{dialect, displayName}>` | `[]` | 서버에서 로드한 dialect 목록 |
| `dialectsLoaded` | `boolean` | `false` | dialect 로드 여부 (중복 fetch 방지) |
| `dialect` | `string` | `''` | 선택된 dialect |
| `host` | `string` | `''` | SQL DB 호스트 |
| `port` | `string` | `''` | SQL DB 포트 (문자열로 관리, 제출 시 숫자 변환) |
| `user` | `string` | `''` | SQL DB 사용자 |
| `password` | `string` | `''` | SQL DB 비밀번호 |
| `ssl` | `boolean` | `false` | SSL 사용 여부 |

### dialect 변경 시 기본 포트 설정

```typescript
const DEFAULT_PORTS: Record<string, string> = {
  postgresql: '5432',
  mysql: '3306',
  mssql: '1433',
};

const handleDialectChange = (newDialect: string) => {
  setDialect(newDialect);
  // dialect 변경 시 port를 기본값으로 설정 (사용자가 수정하지 않은 경우)
  setPort(DEFAULT_PORTS[newDialect] || '');
  // MongoDB로 변경 시 SQL 필드 초기화, SQL로 변경 시 MongoDB 필드 초기화
  if (newDialect === 'mongodb') {
    setHost(''); setUser(''); setPassword(''); setSsl(false);
  } else {
    setConnectionString('');
  }
};
```

---

## 4. Dialect별 폼 렌더링 전략

### 조건 분기 구조

```
type === 'database'
├── dialect 드롭다운 (공통)
├── dialect === 'mongodb'
│   ├── Connection String 입력
│   └── Database 입력
└── dialect !== 'mongodb' (SQL 계열)
    ├── Host 입력
    ├── Port 입력 (type="number")
    ├── User 입력
    ├── Password 입력 (type="password")
    ├── Database 입력
    └── SSL 체크박스
```

### 렌더링 코드 구조

```tsx
{type === 'database' && (
  <>
    {/* Dialect 드롭다운 */}
    <div style={styles.formGroup}>
      <label style={styles.formLabel}>Dialect</label>
      <select
        style={styles.formSelect}
        value={dialect}
        onChange={(e) => handleDialectChange(e.target.value)}
      >
        {dialects.map(d => (
          <option key={d.dialect} value={d.dialect}>{d.displayName}</option>
        ))}
      </select>
    </div>

    {/* MongoDB 설정 */}
    {dialect === 'mongodb' && (
      <>
        <FormField label="Connection String" value={connectionString}
          onChange={setConnectionString} placeholder="mongodb://localhost:27017" />
        <FormField label="Database" value={database}
          onChange={setDatabase} placeholder="mydb" />
      </>
    )}

    {/* SQL DB 설정 */}
    {dialect && dialect !== 'mongodb' && (
      <>
        <FormField label="Host" value={host}
          onChange={setHost} placeholder="localhost" />
        <FormField label="Port" value={port}
          onChange={setPort} placeholder={DEFAULT_PORTS[dialect] || ''} type="number" />
        <FormField label="User" value={user}
          onChange={setUser} placeholder="sa" />
        <FormField label="Password" value={password}
          onChange={setPassword} placeholder="" type="password" />
        <FormField label="Database" value={database}
          onChange={setDatabase} placeholder="mydb" />
        <CheckboxField label="SSL" checked={ssl} onChange={setSsl} />
      </>
    )}
  </>
)}
```

**참고**: `FormField`와 `CheckboxField`는 인라인 JSX로 구현 (별도 컴포넌트 추출 불필요). 기존 코드의 `<div style={styles.formGroup}>` + `<label>` + `<input>` 패턴을 그대로 사용.

---

## 5. API 연동 방법

### 5-1. Dialect 목록 fetch

```typescript
// AddDataSourceModal 내부
async function fetchDialects(): Promise<Array<{ dialect: string; displayName: string }>> {
  const res = await fetch(`${DESIGNER_API}/datasources/dialects`);
  if (!res.ok) throw new Error(`Failed to fetch dialects: ${res.status}`);
  const json = await res.json();
  return json.data;
}
```

### 5-2. 폼 제출 시 config 구성

`handleSubmit` 함수에서 dialect에 따라 config 객체 구성:

```typescript
const handleSubmit = () => {
  if (!name.trim()) return;

  let config: DataSourceDefinition['config'];

  if (type === 'database') {
    if (dialect === 'mongodb') {
      config = { dialect: 'mongodb', connectionString, database };
    } else {
      // SQL 계열 (postgresql, mysql, mssql)
      config = {
        dialect: dialect as DatabaseDialect,
        host,
        port: port ? Number(port) : undefined,
        user,
        password,
        database,
        ssl,
      };
    }
  } else if (type === 'restApi') {
    config = { baseUrl, headers: {}, auth: { type: 'none' } };
  } else {
    try {
      config = { data: JSON.parse(staticData) };
    } catch {
      config = { data: [] };
    }
  }

  onSubmit({ name, type, config });
};
```

**주의**: `DatabaseConfig` 타입의 `port`는 `number | undefined`이므로 빈 문자열일 때 `undefined` 전달.

---

## 6. WinForms 스타일 일관성 유지 방법

### 기존 스타일 토큰 재사용

모든 신규 UI 요소는 `styles` 객체에 정의된 기존 스타일 토큰을 사용:

| 요소 | 사용할 스타일 |
|------|-------------|
| Dialect 드롭다운 | `styles.formSelect` (기존 type 드롭다운과 동일) |
| Host/Port/User 입력 | `styles.formInput` (기존 input 스타일) |
| Password 입력 | `styles.formInput` + `type="password"` |
| SSL 체크박스 라벨 | `styles.formLabel` |
| 필드 그룹 | `styles.formGroup` (marginBottom: 8px) |

### 신규 스타일 추가 (최소한)

```typescript
// styles 객체에 추가
formCheckboxGroup: {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '8px',
} as CSSProperties,
```

### 디자인 원칙

1. **폰트**: `Segoe UI, Tahoma, Geneva, Verdana, sans-serif` (기존 container 스타일)
2. **색상**: 테두리 `#a0a0a0`, 배경 `#f0f0f0`, 액센트 `#0078d7` (WinForms 스타일)
3. **크기**: fontSize 11-12px, padding 3-6px (기존과 동일)
4. **모달 크기**: 기존 `minWidth: 360px` 유지 (SQL 필드가 추가되어도 충분)

---

## 7. 수정 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| `packages/designer/src/components/DataSourcePanel/DataSourcePanel.tsx` | AddDataSourceModal에 dialect fetch, 드롭다운, SQL 설정 폼, config 구성 로직 추가 |

### 변경 범위 상세

1. **styles 객체** (line 50-200): `formCheckboxGroup` 스타일 1개 추가
2. **AddDataSourceModal** (line 211-326):
   - 신규 상태 8개 추가 (dialects, dialectsLoaded, dialect, host, port, user, password, ssl)
   - `DEFAULT_PORTS` 상수 추가
   - `handleDialectChange` 핸들러 추가
   - useEffect로 dialect fetch 로직 추가
   - `handleSubmit` 수정 (dialect별 config 분기)
   - JSX에 dialect 드롭다운 + SQL 필드 추가
3. **API 함수 영역** (line 1-48): 변경 없음 (dialect fetch는 모달 내부 inline)
4. **DataSourcePanel 메인** (line 366-517): 변경 없음

---

## 8. 구현 순서

1. `styles` 객체에 `formCheckboxGroup` 추가
2. `AddDataSourceModal` 내부에 신규 상태 변수 추가
3. `DEFAULT_PORTS` 상수 및 `handleDialectChange` 핸들러 추가
4. `useEffect`로 dialect fetch 로직 추가
5. `handleSubmit` 함수에서 dialect별 config 구성 분기 추가
6. JSX에 dialect 드롭다운 렌더링 추가
7. JSX에 MongoDB/SQL 조건부 폼 필드 렌더링 추가
8. 기존 MongoDB 하드코딩 필드 (`connectionString`, `database`) 를 dialect 조건부 렌더링으로 이동
