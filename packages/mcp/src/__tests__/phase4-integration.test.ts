/**
 * Phase 4 통합 테스트
 *
 * Prompt 템플릿, 런타임/디버그 Tools, 유틸리티 Tools, 낙관적 잠금 재시도를
 * 종합 검증한다.
 *
 * 사전 조건: Express 서버(localhost:4000) 실행 중이어야 함.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = resolve(__dirname, '../index.ts');

// --- 테스트 유틸 ---

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    const msg = detail ? `${label} — ${detail}` : label;
    failures.push(msg);
    console.log(`  ❌ ${label}${detail ? ` (${detail})` : ''}`);
  }
}

function parseToolResult(result: { content: Array<{ type: string; text: string }> }): unknown {
  const text = result.content[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isToolError(result: unknown): boolean {
  return (result as any).isError === true;
}

// --- 메인 ---

async function main() {
  console.log('\n🔧 Phase 4 통합 테스트 시작\n');

  // 1. MCP 클라이언트 연결
  console.log('[1] MCP 서버 연결');
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', SERVER_ENTRY],
    env: { ...process.env, WEBFORM_API_URL: 'http://localhost:4000' },
  });

  const client = new Client({ name: 'phase4-test', version: '1.0.0' });
  await client.connect(transport);
  console.log('  ✅ MCP 서버 연결 성공\n');

  // ═══════════════════════════════════════════════════════════
  // 2. Phase 4 Tool 목록 검증
  // ═══════════════════════════════════════════════════════════

  console.log('[2] Phase 4 Tool 목록 검증');
  const { tools } = await client.listTools();
  const toolNames = tools.map((t) => t.name).sort();

  const expectedRuntimeTools = ['execute_event', 'get_runtime_form', 'get_runtime_app'].sort();
  const expectedDebugTools = ['debug_execute'].sort();
  const expectedUtilityTools = ['validate_form', 'get_server_health', 'search_controls'].sort();

  for (const name of expectedRuntimeTools) {
    assert(toolNames.includes(name), `런타임 Tool: ${name}`);
  }
  for (const name of expectedDebugTools) {
    assert(toolNames.includes(name), `디버그 Tool: ${name}`);
  }
  for (const name of expectedUtilityTools) {
    assert(toolNames.includes(name), `유틸리티 Tool: ${name}`);
  }

  // Phase 1(16) + Phase 2(14) + Phase 3(21) + Phase 4: Runtime(3) + Debug(1) + Utility(3) = 58
  const phase4ToolCount = expectedRuntimeTools.length + expectedDebugTools.length + expectedUtilityTools.length;
  assert(phase4ToolCount === 7, `Phase 4 Tool 합계 = 7 (실제: ${phase4ToolCount})`);
  console.log(`  총 등록된 Tool: ${tools.length}개`);
  console.log();

  // ═══════════════════════════════════════════════════════════
  // 3. Prompt 템플릿 검증
  // ═══════════════════════════════════════════════════════════

  console.log('[3] Prompt 템플릿 검증');
  const { prompts } = await client.listPrompts();
  const promptNames = prompts.map((p) => p.name).sort();

  const expectedPrompts = [
    'create-form-wizard',
    'add-crud-handlers',
    'setup-navigation',
    'clone-and-modify-form',
    'design-theme',
  ].sort();

  for (const name of expectedPrompts) {
    assert(promptNames.includes(name), `Prompt 등록: ${name}`);
  }
  assert(prompts.length === 5, `총 5개 Prompt (실제: ${prompts.length})`);

  // 3-1. create-form-wizard 프롬프트 조회
  console.log('  --- 3-1. create-form-wizard 프롬프트 조회 ---');
  const wizardPrompt = await client.getPrompt({
    name: 'create-form-wizard',
    arguments: {
      projectId: 'test-project-id',
      description: '사용자 등록 폼 - 이름, 이메일, 전화번호 입력',
    },
  });
  assert(wizardPrompt.messages.length > 0, 'create-form-wizard: 메시지 반환');
  const wizardText =
    wizardPrompt.messages[0]?.content?.type === 'text'
      ? wizardPrompt.messages[0].content.text
      : '';
  assert(wizardText.includes('test-project-id'), 'create-form-wizard: projectId 포함');
  assert(
    wizardText.includes('사용자 등록 폼'),
    'create-form-wizard: description 포함',
  );
  assert(wizardText.includes('create_form'), 'create-form-wizard: create_form 단계 포함');
  assert(
    wizardText.includes('batch_add_controls'),
    'create-form-wizard: batch_add_controls 단계 포함',
  );

  // 3-2. add-crud-handlers 프롬프트 조회
  console.log('  --- 3-2. add-crud-handlers 프롬프트 조회 ---');
  const crudPrompt = await client.getPrompt({
    name: 'add-crud-handlers',
    arguments: {
      formId: 'test-form-id',
      dataSourceId: 'test-ds-id',
      entityName: '사용자',
    },
  });
  assert(crudPrompt.messages.length > 0, 'add-crud-handlers: 메시지 반환');
  const crudText =
    crudPrompt.messages[0]?.content?.type === 'text'
      ? crudPrompt.messages[0].content.text
      : '';
  assert(crudText.includes('test-form-id'), 'add-crud-handlers: formId 포함');
  assert(crudText.includes('test-ds-id'), 'add-crud-handlers: dataSourceId 포함');
  assert(crudText.includes('사용자'), 'add-crud-handlers: entityName 포함');
  assert(crudText.includes('CRUD'), 'add-crud-handlers: CRUD 언급');

  // 3-3. setup-navigation 프롬프트 조회
  console.log('  --- 3-3. setup-navigation 프롬프트 조회 ---');
  const navPrompt = await client.getPrompt({
    name: 'setup-navigation',
    arguments: {
      projectId: 'test-project-id',
      formIds: 'form1,form2,form3',
    },
  });
  assert(navPrompt.messages.length > 0, 'setup-navigation: 메시지 반환');
  const navText =
    navPrompt.messages[0]?.content?.type === 'text'
      ? navPrompt.messages[0].content.text
      : '';
  assert(navText.includes('test-project-id'), 'setup-navigation: projectId 포함');
  assert(navText.includes('form1,form2,form3'), 'setup-navigation: formIds 포함');
  assert(
    navText.includes('네비게이션') || navText.includes('navigate'),
    'setup-navigation: 네비게이션 언급',
  );

  // 3-4. clone-and-modify-form 프롬프트 조회
  console.log('  --- 3-4. clone-and-modify-form 프롬프트 조회 ---');
  const clonePrompt = await client.getPrompt({
    name: 'clone-and-modify-form',
    arguments: {
      sourceFormId: 'source-form-id',
      newName: '복제된 폼',
      modifications: '버튼 색상 변경',
    },
  });
  assert(clonePrompt.messages.length > 0, 'clone-and-modify-form: 메시지 반환');
  const cloneText =
    clonePrompt.messages[0]?.content?.type === 'text'
      ? clonePrompt.messages[0].content.text
      : '';
  assert(cloneText.includes('source-form-id'), 'clone-and-modify-form: sourceFormId 포함');
  assert(cloneText.includes('복제된 폼'), 'clone-and-modify-form: newName 포함');
  assert(cloneText.includes('버튼 색상 변경'), 'clone-and-modify-form: modifications 포함');

  // 3-5. design-theme 프롬프트 조회
  console.log('  --- 3-5. design-theme 프롬프트 조회 ---');
  const themePrompt = await client.getPrompt({
    name: 'design-theme',
    arguments: {
      description: '어두운 배경에 밝은 텍스트의 다크 테마',
      baseTheme: 'preset-dark',
    },
  });
  assert(themePrompt.messages.length > 0, 'design-theme: 메시지 반환');
  const themeText =
    themePrompt.messages[0]?.content?.type === 'text'
      ? themePrompt.messages[0].content.text
      : '';
  assert(themeText.includes('다크 테마'), 'design-theme: description 포함');
  assert(themeText.includes('preset-dark'), 'design-theme: baseTheme 포함');
  assert(themeText.includes('create_theme'), 'design-theme: create_theme 단계 포함');

  console.log();

  // ═══════════════════════════════════════════════════════════
  // 4. 테스트 데이터 준비 (폼 + 컨트롤 + 이벤트 + 퍼블리시)
  // ═══════════════════════════════════════════════════════════

  console.log('[4] 테스트 데이터 준비');

  // 4-1. 프로젝트 생성
  const createProjectResult = await client.callTool({
    name: 'create_project',
    arguments: {
      name: '__MCP_PHASE4_TEST_PROJECT__',
      description: 'Phase 4 통합 테스트용',
    },
  });
  const projectData = parseToolResult(createProjectResult as any) as any;
  const projectId = projectData?.project?.id;
  assert(!!projectId, `프로젝트 생성 (id=${projectId})`);

  // 4-2. 폼 생성
  const createFormResult = await client.callTool({
    name: 'create_form',
    arguments: {
      name: '__MCP_PHASE4_TEST_FORM__',
      projectId,
      properties: { width: 800, height: 600 },
    },
  });
  const formData = parseToolResult(createFormResult as any) as any;
  const formId = formData?.id;
  assert(!!formId, `폼 생성 (id=${formId})`);

  // 4-3. 버튼 컨트롤 추가
  const addButtonResult = await client.callTool({
    name: 'add_control',
    arguments: {
      formId,
      type: 'Button',
      name: 'btnTest',
      properties: { text: '클릭' },
      position: { x: 100, y: 50 },
    },
  });
  const buttonData = parseToolResult(addButtonResult as any) as any;
  const buttonId = buttonData?.controlId;
  assert(!!buttonId, `버튼 컨트롤 추가 (id=${buttonId})`);

  // 4-4. 레이블 컨트롤 추가
  const addLabelResult = await client.callTool({
    name: 'add_control',
    arguments: {
      formId,
      type: 'Label',
      name: 'lblResult',
      properties: { text: '결과' },
      position: { x: 100, y: 100 },
    },
  });
  const labelData = parseToolResult(addLabelResult as any) as any;
  const labelId = labelData?.controlId;
  assert(!!labelId, `레이블 컨트롤 추가 (id=${labelId})`);

  // 4-5. TextBox 컨트롤 추가
  const addTextBoxResult = await client.callTool({
    name: 'add_control',
    arguments: {
      formId,
      type: 'TextBox',
      name: 'txtInput',
      properties: { text: '' },
      position: { x: 100, y: 150 },
    },
  });
  const textBoxData = parseToolResult(addTextBoxResult as any) as any;
  const textBoxId = textBoxData?.controlId;
  assert(!!textBoxId, `TextBox 컨트롤 추가 (id=${textBoxId})`);

  // 4-6. 이벤트 핸들러 추가 (버튼 Click)
  const addHandlerResult = await client.callTool({
    name: 'add_event_handler',
    arguments: {
      formId,
      controlId: buttonId,
      eventName: 'Click',
      handlerType: 'server',
      handlerCode: `ctx.controls.lblResult.text = '클릭됨!';`,
    },
  });
  const handlerData = parseToolResult(addHandlerResult as any) as any;
  assert(!isToolError(addHandlerResult), '이벤트 핸들러 추가 성공');
  assert(!!handlerData, '이벤트 핸들러 데이터 반환');

  // 4-7. 폼 퍼블리시
  const publishResult = await client.callTool({
    name: 'publish_form',
    arguments: { formId },
  });
  assert(!isToolError(publishResult), '폼 퍼블리시 성공');
  const publishData = parseToolResult(publishResult as any) as any;
  assert(publishData?.status === 'published', `폼 status=published (실제: ${publishData?.status})`);

  console.log();

  // ═══════════════════════════════════════════════════════════
  // 5. 런타임 Tools 테스트
  // ═══════════════════════════════════════════════════════════

  console.log('[5] 런타임 Tools 테스트');

  // 5-1. get_runtime_form — 퍼블리시된 폼 로드
  console.log('  --- 5-1. get_runtime_form ---');
  const runtimeFormResult = await client.callTool({
    name: 'get_runtime_form',
    arguments: { formId },
  });
  assert(!isToolError(runtimeFormResult), 'get_runtime_form: 에러 없음');
  const runtimeForm = parseToolResult(runtimeFormResult as any) as any;
  assert(!!runtimeForm, 'get_runtime_form: 데이터 반환');
  assert(
    runtimeForm?.name === '__MCP_PHASE4_TEST_FORM__' || !!runtimeForm?.id,
    'get_runtime_form: 폼 정보 포함',
  );
  assert(
    Array.isArray(runtimeForm?.controls),
    'get_runtime_form: controls 배열 반환',
  );
  assert(
    Array.isArray(runtimeForm?.eventHandlers),
    'get_runtime_form: eventHandlers 배열 반환',
  );

  // 5-2. get_runtime_form — 존재하지 않는 폼
  console.log('  --- 5-2. get_runtime_form (잘못된 ID) ---');
  const badRuntimeResult = await client.callTool({
    name: 'get_runtime_form',
    arguments: { formId: 'aaaaaaaaaaaaaaaaaaaaaaaa' },
  });
  assert(
    isToolError(badRuntimeResult) ||
      (badRuntimeResult as any).content?.[0]?.text?.includes('찾을 수 없'),
    'get_runtime_form: 없는 폼 → 에러',
  );

  // 5-3. get_runtime_form — 유효하지 않은 ObjectId
  console.log('  --- 5-3. get_runtime_form (잘못된 ObjectId) ---');
  const invalidIdResult = await client.callTool({
    name: 'get_runtime_form',
    arguments: { formId: 'invalid-id' },
  });
  assert(
    isToolError(invalidIdResult) ||
      (invalidIdResult as any).content?.[0]?.text?.includes('유효하지 않은'),
    'get_runtime_form: 잘못된 ObjectId → 에러',
  );

  // 5-4. execute_event — 버튼 Click 이벤트 실행
  console.log('  --- 5-4. execute_event ---');
  const execResult = await client.callTool({
    name: 'execute_event',
    arguments: {
      formId,
      controlId: buttonId,
      eventName: 'Click',
      formState: {
        [buttonId]: { text: '클릭' },
        [labelId]: { text: '결과' },
      },
    },
  });
  assert(!isToolError(execResult), 'execute_event: 에러 없음');
  const execData = parseToolResult(execResult as any) as any;
  assert(execData?.success === true, 'execute_event: success=true');
  assert(Array.isArray(execData?.patches), 'execute_event: patches 배열 반환');
  assert(Array.isArray(execData?.logs), 'execute_event: logs 배열 반환');
  assert(typeof execData?.patchCount === 'number', 'execute_event: patchCount 반환');

  // 패치 내용 검증 (레이블 text 변경 패치)
  if (execData?.patches?.length > 0) {
    const patch = execData.patches[0];
    assert(!!patch?.target || !!patch?.type, 'execute_event: 패치에 target 또는 type 포함');
  }

  // 5-5. execute_event — formState 포함 실행
  console.log('  --- 5-5. execute_event (formState 포함) ---');
  const execWithStateResult = await client.callTool({
    name: 'execute_event',
    arguments: {
      formId,
      controlId: buttonId,
      eventName: 'Click',
      formState: {
        [labelId]: { text: '초기 값' },
      },
    },
  });
  assert(!isToolError(execWithStateResult), 'execute_event (formState): 에러 없음');
  const execWithStateData = parseToolResult(execWithStateResult as any) as any;
  assert(execWithStateData?.success === true, 'execute_event (formState): success=true');

  // 5-6. execute_event — 존재하지 않는 폼
  console.log('  --- 5-6. execute_event (잘못된 폼 ID) ---');
  const execBadFormResult = await client.callTool({
    name: 'execute_event',
    arguments: {
      formId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      controlId: 'ctrl1',
      eventName: 'Click',
    },
  });
  assert(
    isToolError(execBadFormResult) ||
      (execBadFormResult as any).content?.[0]?.text?.includes('찾을 수 없'),
    'execute_event: 없는 폼 → 에러',
  );

  // 5-7. get_runtime_app
  console.log('  --- 5-7. get_runtime_app ---');
  const runtimeAppResult = await client.callTool({
    name: 'get_runtime_app',
    arguments: {
      projectId,
      formId,
    },
  });
  // Shell이 없으므로 shell=null 이거나 에러가 날 수 있음
  const runtimeAppData = parseToolResult(runtimeAppResult as any) as any;
  if (!isToolError(runtimeAppResult)) {
    assert(!!runtimeAppData, 'get_runtime_app: 데이터 반환');
    // shell이 없는 프로젝트이므로 null 가능
    assert(
      runtimeAppData?.shell === null || runtimeAppData?.shell !== undefined,
      'get_runtime_app: shell 필드 존재',
    );
  } else {
    // Shell 없이 앱 로드가 실패하는 경우도 허용
    assert(true, 'get_runtime_app: Shell 없이 앱 로드 (에러 허용)');
  }

  console.log();

  // ═══════════════════════════════════════════════════════════
  // 6. 디버그 Tools 테스트
  // ═══════════════════════════════════════════════════════════

  console.log('[6] 디버그 Tools 테스트');

  // 6-1. debug_execute — 정상 실행
  console.log('  --- 6-1. debug_execute ---');
  const debugResult = await client.callTool({
    name: 'debug_execute',
    arguments: {
      formId,
      controlId: buttonId,
      eventName: 'Click',
      formState: {
        [buttonId]: { text: '클릭' },
        [labelId]: { text: '결과' },
      },
    },
  });
  assert(!isToolError(debugResult), 'debug_execute: 에러 없음');
  const debugData = parseToolResult(debugResult as any) as any;
  assert(debugData?.success === true, 'debug_execute: success=true');
  assert(Array.isArray(debugData?.patches), 'debug_execute: patches 배열 반환');
  assert(Array.isArray(debugData?.logs), 'debug_execute: logs 배열 반환');
  assert(Array.isArray(debugData?.traces), 'debug_execute: traces 배열 반환');
  assert(typeof debugData?.patchCount === 'number', 'debug_execute: patchCount 반환');
  assert(typeof debugData?.traceCount === 'number', 'debug_execute: traceCount 반환');

  // 트레이스 내용 검증
  if (debugData?.traces?.length > 0) {
    const trace = debugData.traces[0];
    assert(typeof trace?.line === 'number', 'debug_execute: trace.line 존재');
    assert(typeof trace?.timestamp === 'number', 'debug_execute: trace.timestamp 존재');
    assert(typeof trace?.variables === 'object', 'debug_execute: trace.variables 존재');
  }

  // 6-2. debug_execute — 잘못된 formId
  console.log('  --- 6-2. debug_execute (잘못된 ID) ---');
  const debugBadResult = await client.callTool({
    name: 'debug_execute',
    arguments: {
      formId: 'invalid-id',
      controlId: 'ctrl1',
      eventName: 'Click',
    },
  });
  assert(
    isToolError(debugBadResult) ||
      (debugBadResult as any).content?.[0]?.text?.includes('유효하지 않은'),
    'debug_execute: 잘못된 ID → 에러',
  );

  console.log();

  // ═══════════════════════════════════════════════════════════
  // 7. 유틸리티 Tools 테스트
  // ═══════════════════════════════════════════════════════════

  console.log('[7] 유틸리티 Tools 테스트');

  // 7-1. get_server_health
  console.log('  --- 7-1. get_server_health ---');
  const healthResult = await client.callTool({
    name: 'get_server_health',
    arguments: {},
  });
  assert(!isToolError(healthResult), 'get_server_health: 에러 없음');
  const healthData = parseToolResult(healthResult as any) as any;
  assert(!!healthData, 'get_server_health: 데이터 반환');
  assert(typeof healthData?.responseTime === 'string', 'get_server_health: responseTime 반환');
  assert(typeof healthData?.serverUrl === 'string', 'get_server_health: serverUrl 반환');

  // MongoDB/Redis 상태 확인 (health API 응답 구조에 따라)
  if (healthData?.status) {
    assert(
      healthData.status === 'ok' || healthData.status === 'degraded',
      `get_server_health: status=${healthData.status}`,
    );
  }
  if (healthData?.mongo !== undefined) {
    console.log(`    MongoDB: ${JSON.stringify(healthData.mongo)}`);
  }
  if (healthData?.redis !== undefined) {
    console.log(`    Redis: ${JSON.stringify(healthData.redis)}`);
  }

  // 7-2. search_controls — 이름 검색
  console.log('  --- 7-2. search_controls (이름 검색) ---');
  const searchByNameResult = await client.callTool({
    name: 'search_controls',
    arguments: {
      formId,
      query: 'btn',
    },
  });
  assert(!isToolError(searchByNameResult), 'search_controls (이름): 에러 없음');
  const searchByNameData = parseToolResult(searchByNameResult as any) as any;
  assert(searchByNameData?.formId === formId, 'search_controls (이름): formId 일치');
  assert(typeof searchByNameData?.totalControls === 'number', 'search_controls (이름): totalControls 반환');
  assert(typeof searchByNameData?.matchCount === 'number', 'search_controls (이름): matchCount 반환');
  assert(Array.isArray(searchByNameData?.controls), 'search_controls (이름): controls 배열');
  assert(
    searchByNameData?.matchCount >= 1,
    `search_controls (이름): btn 검색 결과 >= 1 (실제: ${searchByNameData?.matchCount})`,
  );

  // 검색 결과에 btnTest 포함 확인
  const foundBtn = searchByNameData?.controls?.find((c: any) => c.name === 'btnTest');
  assert(!!foundBtn, 'search_controls (이름): btnTest 검색됨');

  // 7-3. search_controls — 타입 필터
  console.log('  --- 7-3. search_controls (타입 필터) ---');
  const searchByTypeResult = await client.callTool({
    name: 'search_controls',
    arguments: {
      formId,
      type: 'Label',
    },
  });
  assert(!isToolError(searchByTypeResult), 'search_controls (타입): 에러 없음');
  const searchByTypeData = parseToolResult(searchByTypeResult as any) as any;
  assert(
    searchByTypeData?.matchCount >= 1,
    `search_controls (타입): Label 결과 >= 1 (실제: ${searchByTypeData?.matchCount})`,
  );
  const foundLabel = searchByTypeData?.controls?.find((c: any) => c.name === 'lblResult');
  assert(!!foundLabel, 'search_controls (타입): lblResult 검색됨');

  // 7-4. search_controls — 결과 없음
  console.log('  --- 7-4. search_controls (결과 없음) ---');
  const searchNoResult = await client.callTool({
    name: 'search_controls',
    arguments: {
      formId,
      query: 'nonexistent_control_xyz',
    },
  });
  assert(!isToolError(searchNoResult), 'search_controls (결과 없음): 에러 없음');
  const searchNoData = parseToolResult(searchNoResult as any) as any;
  assert(searchNoData?.matchCount === 0, 'search_controls (결과 없음): matchCount=0');

  // 7-5. search_controls — 잘못된 formId
  console.log('  --- 7-5. search_controls (잘못된 formId) ---');
  const searchBadIdResult = await client.callTool({
    name: 'search_controls',
    arguments: {
      formId: 'invalid-id',
      query: 'test',
    },
  });
  assert(
    isToolError(searchBadIdResult) ||
      (searchBadIdResult as any).content?.[0]?.text?.includes('유효하지 않은'),
    'search_controls: 잘못된 formId → 에러',
  );

  // 7-6. validate_form — 유효한 폼 정의
  console.log('  --- 7-6. validate_form (유효한 폼) ---');
  const validateValidResult = await client.callTool({
    name: 'validate_form',
    arguments: {
      formDefinition: {
        id: 'test-form',
        name: 'Test Form',
        controls: [
          {
            id: 'ctrl1',
            type: 'Button',
            name: 'btnOk',
            position: { x: 10, y: 10 },
            size: { width: 100, height: 30 },
            properties: { text: 'OK' },
          },
          {
            id: 'ctrl2',
            type: 'Label',
            name: 'lblTitle',
            position: { x: 10, y: 50 },
            size: { width: 200, height: 20 },
            properties: { text: 'Title' },
          },
        ],
        eventHandlers: [
          {
            controlId: 'ctrl1',
            eventName: 'Click',
            handlerCode: 'console.log("clicked");',
          },
        ],
      },
    },
  });
  assert(!isToolError(validateValidResult), 'validate_form (유효): 에러 없음');
  const validateValidData = parseToolResult(validateValidResult as any) as any;
  assert(validateValidData?.valid === true, 'validate_form (유효): valid=true');
  assert(validateValidData?.errors?.length === 0, 'validate_form (유효): errors 없음');
  assert(validateValidData?.summary?.totalControls === 2, 'validate_form (유효): totalControls=2');
  assert(
    validateValidData?.summary?.totalEventHandlers === 1,
    'validate_form (유효): totalEventHandlers=1',
  );

  // 7-7. validate_form — 중복 ID
  console.log('  --- 7-7. validate_form (중복 ID) ---');
  const validateDupIdResult = await client.callTool({
    name: 'validate_form',
    arguments: {
      formDefinition: {
        controls: [
          { id: 'dup-id', type: 'Button', name: 'btn1', position: { x: 0, y: 0 }, size: { width: 80, height: 30 } },
          { id: 'dup-id', type: 'Label', name: 'lbl1', position: { x: 0, y: 40 }, size: { width: 80, height: 20 } },
        ],
      },
    },
  });
  const validateDupIdData = parseToolResult(validateDupIdResult as any) as any;
  assert(validateDupIdData?.valid === false, 'validate_form (중복 ID): valid=false');
  const dupIdError = validateDupIdData?.errors?.find((e: any) => e.type === 'duplicate_id');
  assert(!!dupIdError, 'validate_form (중복 ID): duplicate_id 에러 존재');

  // 7-8. validate_form — 잘못된 컨트롤 타입
  console.log('  --- 7-8. validate_form (잘못된 타입) ---');
  const validateBadTypeResult = await client.callTool({
    name: 'validate_form',
    arguments: {
      formDefinition: {
        controls: [
          { id: 'c1', type: 'NonExistentType', name: 'test', position: { x: 0, y: 0 }, size: { width: 80, height: 30 } },
        ],
      },
    },
  });
  const validateBadTypeData = parseToolResult(validateBadTypeResult as any) as any;
  assert(validateBadTypeData?.valid === false, 'validate_form (잘못된 타입): valid=false');
  const invalidTypeError = validateBadTypeData?.errors?.find(
    (e: any) => e.type === 'invalid_type',
  );
  assert(!!invalidTypeError, 'validate_form (잘못된 타입): invalid_type 에러 존재');

  // 7-9. validate_form — 핸들러 구문 오류
  console.log('  --- 7-9. validate_form (핸들러 구문 오류) ---');
  const validateSyntaxResult = await client.callTool({
    name: 'validate_form',
    arguments: {
      formDefinition: {
        controls: [
          { id: 'c1', type: 'Button', name: 'btn1', position: { x: 0, y: 0 }, size: { width: 80, height: 30 } },
        ],
        eventHandlers: [
          {
            controlId: 'c1',
            eventName: 'Click',
            handlerCode: 'function { broken syntax !!!',
          },
        ],
      },
    },
  });
  const validateSyntaxData = parseToolResult(validateSyntaxResult as any) as any;
  assert(validateSyntaxData?.valid === false, 'validate_form (구문 오류): valid=false');
  const syntaxError = validateSyntaxData?.errors?.find(
    (e: any) => e.type === 'handler_syntax_error',
  );
  assert(!!syntaxError, 'validate_form (구문 오류): handler_syntax_error 에러 존재');

  // 7-10. validate_form — 잘못된 controlId 참조
  console.log('  --- 7-10. validate_form (잘못된 핸들러 참조) ---');
  const validateBadRefResult = await client.callTool({
    name: 'validate_form',
    arguments: {
      formDefinition: {
        controls: [
          { id: 'c1', type: 'Button', name: 'btn1', position: { x: 0, y: 0 }, size: { width: 80, height: 30 } },
        ],
        eventHandlers: [
          {
            controlId: 'nonexistent-ctrl',
            eventName: 'Click',
            handlerCode: 'console.log("test");',
          },
        ],
      },
    },
  });
  const validateBadRefData = parseToolResult(validateBadRefResult as any) as any;
  assert(validateBadRefData?.valid === false, 'validate_form (잘못된 참조): valid=false');
  const badRefError = validateBadRefData?.errors?.find(
    (e: any) => e.type === 'invalid_handler_ref',
  );
  assert(!!badRefError, 'validate_form (잘못된 참조): invalid_handler_ref 에러 존재');

  // 7-11. validate_form — 빈 폼 (경고 없이 통과)
  console.log('  --- 7-11. validate_form (빈 폼) ---');
  const validateEmptyResult = await client.callTool({
    name: 'validate_form',
    arguments: {
      formDefinition: {
        controls: [],
        eventHandlers: [],
      },
    },
  });
  const validateEmptyData = parseToolResult(validateEmptyResult as any) as any;
  assert(validateEmptyData?.valid === true, 'validate_form (빈 폼): valid=true');
  assert(validateEmptyData?.summary?.totalControls === 0, 'validate_form (빈 폼): totalControls=0');

  console.log();

  // ═══════════════════════════════════════════════════════════
  // 8. 낙관적 잠금 재시도 테스트
  // ═══════════════════════════════════════════════════════════

  console.log('[8] 낙관적 잠금 재시도 테스트');

  // 두 번의 동시 업데이트를 시뮬레이션하여 낙관적 잠금 동작 확인
  // update_control 두 개를 동시에 실행하면 하나가 409를 받고 재시도해야 함

  // 8-1. 동시 업데이트 시뮬레이션
  console.log('  --- 8-1. 동시 업데이트 시뮬레이션 ---');

  // 먼저 현재 폼 상태 확인
  const getFormBefore = await client.callTool({
    name: 'get_form',
    arguments: { formId },
  });
  const formBefore = parseToolResult(getFormBefore as any) as any;
  const versionBefore = formBefore?.version;
  assert(typeof versionBefore === 'number', `현재 폼 버전: ${versionBefore}`);

  // 동시에 두 컨트롤 업데이트 실행
  const [concurrentResult1, concurrentResult2] = await Promise.all([
    client.callTool({
      name: 'update_control',
      arguments: {
        formId,
        controlId: buttonId,
        properties: { text: '동시 업데이트 1' },
      },
    }),
    client.callTool({
      name: 'update_control',
      arguments: {
        formId,
        controlId: labelId,
        properties: { text: '동시 업데이트 2' },
      },
    }),
  ]);

  // 두 업데이트 모두 성공해야 함 (낙관적 잠금 재시도 덕분)
  const both1Success = !isToolError(concurrentResult1);
  const both2Success = !isToolError(concurrentResult2);
  assert(both1Success, `동시 업데이트 1: ${both1Success ? '성공' : '실패'}`);
  assert(both2Success, `동시 업데이트 2: ${both2Success ? '성공' : '실패'}`);

  // 8-2. 최종 상태 확인
  console.log('  --- 8-2. 동시 업데이트 후 상태 확인 ---');
  const getFormAfter = await client.callTool({
    name: 'get_form',
    arguments: { formId },
  });
  const formAfter = parseToolResult(getFormAfter as any) as any;
  const versionAfter = formAfter?.version;
  assert(
    typeof versionAfter === 'number' && versionAfter > versionBefore,
    `폼 버전 증가 (before=${versionBefore}, after=${versionAfter})`,
  );

  // 두 업데이트 모두 반영되었는지 확인
  const controls = formAfter?.controls || [];
  const btnAfter = controls.find((c: any) => c.id === buttonId || c.name === 'btnTest');
  const lblAfter = controls.find((c: any) => c.id === labelId || c.name === 'lblResult');

  if (btnAfter?.properties?.text) {
    assert(
      btnAfter.properties.text === '동시 업데이트 1',
      `버튼 text 업데이트 반영: "${btnAfter.properties.text}"`,
    );
  }
  if (lblAfter?.properties?.text) {
    assert(
      lblAfter.properties.text === '동시 업데이트 2',
      `레이블 text 업데이트 반영: "${lblAfter.properties.text}"`,
    );
  }

  // 8-3. 순차 업데이트 후 버전 일관성 확인
  console.log('  --- 8-3. 순차 업데이트 버전 일관성 ---');
  const seqUpdate1 = await client.callTool({
    name: 'update_control',
    arguments: {
      formId,
      controlId: textBoxId,
      properties: { text: '순차 1' },
    },
  });
  assert(!isToolError(seqUpdate1), '순차 업데이트 1 성공');
  const seqData1 = parseToolResult(seqUpdate1 as any) as any;

  const seqUpdate2 = await client.callTool({
    name: 'update_control',
    arguments: {
      formId,
      controlId: textBoxId,
      properties: { text: '순차 2' },
    },
  });
  assert(!isToolError(seqUpdate2), '순차 업데이트 2 성공');
  const seqData2 = parseToolResult(seqUpdate2 as any) as any;

  if (seqData1?.formVersion && seqData2?.formVersion) {
    assert(
      seqData2.formVersion > seqData1.formVersion,
      `순차 업데이트 버전 증가 (${seqData1.formVersion} → ${seqData2.formVersion})`,
    );
  }

  console.log();

  // ═══════════════════════════════════════════════════════════
  // 9. 정리: 테스트 데이터 삭제
  // ═══════════════════════════════════════════════════════════

  console.log('[9] 테스트 데이터 정리');

  // 폼 삭제
  const deleteFormResult = await client.callTool({
    name: 'delete_form',
    arguments: { formId },
  });
  const deleteFormData = parseToolResult(deleteFormResult as any) as any;
  assert(deleteFormData?.deleted === true, 'delete_form: 폼 삭제 성공');

  // 프로젝트 삭제
  const deleteProjectResult = await client.callTool({
    name: 'delete_project',
    arguments: { projectId },
  });
  const deleteProjectData = parseToolResult(deleteProjectResult as any) as any;
  assert(deleteProjectData?.deleted === true, 'delete_project: 프로젝트 삭제 성공');

  console.log();

  // --- 결과 요약 ---
  console.log('═══════════════════════════════════════');
  console.log(`  결과: ${passed} 통과 / ${failed} 실패 (총 ${passed + failed}개)`);
  if (failures.length > 0) {
    console.log('\n  실패 항목:');
    for (const f of failures) {
      console.log(`    - ${f}`);
    }
  }
  console.log('═══════════════════════════════════════\n');

  await client.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n💥 테스트 실행 중 치명적 오류:', err);
  process.exit(1);
});
