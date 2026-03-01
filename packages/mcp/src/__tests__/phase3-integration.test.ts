/**
 * Phase 3 통합 테스트
 *
 * 데이터소스 Tools, 데이터 바인딩 Tools, 테마 Tools, Shell Tools,
 * 테마/Shell 리소스를 종합 검증한다.
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
  console.log('\n🔧 Phase 3 통합 테스트 시작\n');

  // 1. MCP 클라이언트 연결
  console.log('[1] MCP 서버 연결');
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', SERVER_ENTRY],
    env: { ...process.env, WEBFORM_API_URL: 'http://localhost:4000' },
  });

  const client = new Client({ name: 'phase3-test', version: '1.0.0' });
  await client.connect(transport);
  console.log('  ✅ MCP 서버 연결 성공\n');

  // --- 2. Tool 목록 검증 (Phase 3 추가 Tool 포함) ---
  console.log('[2] Phase 3 Tool 목록 검증');
  const { tools } = await client.listTools();
  const toolNames = tools.map((t) => t.name).sort();

  const expectedDatasourceTools = [
    'list_datasources',
    'get_datasource',
    'create_datasource',
    'update_datasource',
    'delete_datasource',
    'test_datasource_connection',
    'query_datasource',
  ].sort();

  const expectedDatabindingTools = [
    'add_data_binding',
    'remove_data_binding',
    'list_data_bindings',
  ].sort();

  const expectedThemeTools = [
    'list_themes',
    'get_theme',
    'create_theme',
    'update_theme',
    'delete_theme',
    'apply_theme_to_form',
  ].sort();

  const expectedShellTools = [
    'get_shell',
    'create_shell',
    'update_shell',
    'delete_shell',
    'publish_shell',
  ].sort();

  // Phase 1(16) + Phase 2(14) + Phase 3: DS(7) + DB(3) + Theme(6) + Shell(5) = 51
  const expectedTotal = 51;
  assert(
    tools.length === expectedTotal,
    `총 ${expectedTotal}개 Tool 등록됨 (실제: ${tools.length})`,
  );

  for (const name of expectedDatasourceTools) {
    assert(toolNames.includes(name), `데이터소스 Tool: ${name}`);
  }
  for (const name of expectedDatabindingTools) {
    assert(toolNames.includes(name), `데이터바인딩 Tool: ${name}`);
  }
  for (const name of expectedThemeTools) {
    assert(toolNames.includes(name), `테마 Tool: ${name}`);
  }
  for (const name of expectedShellTools) {
    assert(toolNames.includes(name), `Shell Tool: ${name}`);
  }
  console.log();

  // --- 3. Resource 목록 검증 (테마 + Shell 리소스 템플릿) ---
  console.log('[3] Phase 3 Resource 템플릿 검증');
  const { resourceTemplates } = await client.listResourceTemplates();
  const templateUris = resourceTemplates.map((r) => r.uriTemplate).sort();

  assert(
    templateUris.includes('webform://themes/{themeId}'),
    'Resource 템플릿: webform://themes/{themeId}',
  );
  assert(
    templateUris.includes('webform://shells/{projectId}'),
    'Resource 템플릿: webform://shells/{projectId}',
  );
  console.log();

  // --- 4. 테스트 데이터 준비: 프로젝트 + 폼 생성 ---
  console.log('[4] 테스트 데이터 준비');

  const createProjectResult = await client.callTool({
    name: 'create_project',
    arguments: {
      name: '__MCP_PHASE3_TEST_PROJECT__',
      description: 'Phase 3 통합 테스트용',
    },
  });
  const projectData = parseToolResult(createProjectResult as any) as any;
  const projectId = projectData?.project?.id;
  assert(!!projectId, `프로젝트 생성 (id=${projectId})`);

  const createFormResult = await client.callTool({
    name: 'create_form',
    arguments: {
      name: '__MCP_PHASE3_TEST_FORM__',
      projectId,
      properties: { width: 800, height: 600 },
    },
  });
  const formData = parseToolResult(createFormResult as any) as any;
  const formId = formData?.id;
  assert(!!formId, `폼 생성 (id=${formId})`);

  // 바인딩 테스트용 컨트롤 추가
  const addButtonResult = await client.callTool({
    name: 'add_control',
    arguments: {
      formId,
      type: 'Button',
      name: 'btnPhase3',
      properties: { text: 'Phase3 버튼' },
      position: { x: 100, y: 50 },
    },
  });
  const buttonData = parseToolResult(addButtonResult as any) as any;
  const buttonId = buttonData?.controlId;
  assert(!!buttonId, `버튼 컨트롤 추가 (id=${buttonId})`);

  const addLabelResult = await client.callTool({
    name: 'add_control',
    arguments: {
      formId,
      type: 'Label',
      name: 'lblPhase3',
      properties: { text: 'Phase3 레이블' },
      position: { x: 100, y: 100 },
    },
  });
  const labelData = parseToolResult(addLabelResult as any) as any;
  const labelId = labelData?.controlId;
  assert(!!labelId, `레이블 컨트롤 추가 (id=${labelId})`);
  console.log();

  // ═══════════════════════════════════════════════════════════
  // 5. 데이터소스 Tools 테스트
  // ═══════════════════════════════════════════════════════════

  console.log('[5] 데이터소스 Tools 테스트');

  // 5-1. create_datasource (static 타입)
  console.log('  --- 5-1. create_datasource (static) ---');
  const createDsResult = await client.callTool({
    name: 'create_datasource',
    arguments: {
      name: '__MCP_PHASE3_TEST_DS__',
      type: 'static',
      projectId,
      description: 'Phase 3 테스트 정적 데이터소스',
      config: {
        data: [
          { id: 1, name: '홍길동', email: 'hong@test.com' },
          { id: 2, name: '김철수', email: 'kim@test.com' },
          { id: 3, name: '이영희', email: 'lee@test.com' },
        ],
      },
    },
  });
  const createDsData = parseToolResult(createDsResult as any) as any;
  const datasourceId = createDsData?.id;
  assert(!!datasourceId, `create_datasource: static 생성 (id=${datasourceId})`);
  assert(createDsData?.name === '__MCP_PHASE3_TEST_DS__', 'create_datasource: 이름 일치');
  assert(createDsData?.type === 'static', 'create_datasource: 타입=static');

  // 5-2. get_datasource
  console.log('  --- 5-2. get_datasource ---');
  const getDsResult = await client.callTool({
    name: 'get_datasource',
    arguments: { datasourceId },
  });
  const getDsData = parseToolResult(getDsResult as any) as any;
  assert(getDsData?.id === datasourceId, 'get_datasource: id 일치');
  assert(getDsData?.name === '__MCP_PHASE3_TEST_DS__', 'get_datasource: 이름 일치');
  assert(getDsData?.type === 'static', 'get_datasource: 타입=static');
  assert(!!getDsData?.config, 'get_datasource: config 포함');
  assert(
    Array.isArray(getDsData?.config?.data) && getDsData.config.data.length === 3,
    `get_datasource: config.data 3건 (실제: ${getDsData?.config?.data?.length})`,
  );

  // 5-3. list_datasources
  console.log('  --- 5-3. list_datasources ---');
  const listDsResult = await client.callTool({
    name: 'list_datasources',
    arguments: { projectId },
  });
  const listDsData = parseToolResult(listDsResult as any) as any;
  assert(Array.isArray(listDsData?.datasources), 'list_datasources: datasources 배열');
  const foundDs = listDsData?.datasources?.find((ds: any) => ds.id === datasourceId);
  assert(!!foundDs, 'list_datasources: 생성한 데이터소스 포함');
  assert(!!listDsData?.meta, 'list_datasources: meta 존재');

  // 5-4. test_datasource_connection (static → 항상 성공)
  console.log('  --- 5-4. test_datasource_connection ---');
  const testConnResult = await client.callTool({
    name: 'test_datasource_connection',
    arguments: { datasourceId },
  });
  const testConnData = parseToolResult(testConnResult as any) as any;
  assert(testConnData?.success === true, 'test_datasource_connection: success=true');
  assert(typeof testConnData?.message === 'string', 'test_datasource_connection: message 반환');

  // 5-5. query_datasource (static 쿼리)
  console.log('  --- 5-5. query_datasource ---');
  const queryDsResult = await client.callTool({
    name: 'query_datasource',
    arguments: {
      datasourceId,
      query: { limit: 2 },
    },
  });
  const queryDsData = parseToolResult(queryDsResult as any) as any;
  assert(Array.isArray(queryDsData?.data), 'query_datasource: data 배열');
  assert(
    queryDsData?.rowCount <= 3,
    `query_datasource: rowCount (실제: ${queryDsData?.rowCount})`,
  );

  // 5-6. update_datasource
  console.log('  --- 5-6. update_datasource ---');
  const updateDsResult = await client.callTool({
    name: 'update_datasource',
    arguments: {
      datasourceId,
      name: '__MCP_PHASE3_TEST_DS_UPDATED__',
      description: '수정된 설명',
    },
  });
  const updateDsData = parseToolResult(updateDsResult as any) as any;
  assert(updateDsData?.id === datasourceId, 'update_datasource: id 일치');
  assert(
    updateDsData?.name === '__MCP_PHASE3_TEST_DS_UPDATED__',
    'update_datasource: 이름 변경됨',
  );

  // 5-7. 수정 확인
  const getDsAfterUpdate = await client.callTool({
    name: 'get_datasource',
    arguments: { datasourceId },
  });
  const dsAfterUpdate = parseToolResult(getDsAfterUpdate as any) as any;
  assert(
    dsAfterUpdate?.name === '__MCP_PHASE3_TEST_DS_UPDATED__',
    'update_datasource: 수정 확인',
  );
  assert(dsAfterUpdate?.description === '수정된 설명', 'update_datasource: description 변경됨');

  console.log();

  // ═══════════════════════════════════════════════════════════
  // 6. 데이터 바인딩 Tools 테스트
  // ═══════════════════════════════════════════════════════════

  console.log('[6] 데이터 바인딩 Tools 테스트');

  // 6-1. add_data_binding
  console.log('  --- 6-1. add_data_binding ---');
  const addBindingResult = await client.callTool({
    name: 'add_data_binding',
    arguments: {
      formId,
      controlId: buttonId,
      controlProperty: 'text',
      dataSourceId: datasourceId,
      dataField: 'name',
      bindingMode: 'oneWay',
    },
  });
  const addBindingData = parseToolResult(addBindingResult as any) as any;
  assert(!isToolError(addBindingResult), 'add_data_binding: 에러 없음');
  assert(addBindingData?.controlId === buttonId, 'add_data_binding: controlId 일치');
  assert(addBindingData?.controlProperty === 'text', 'add_data_binding: controlProperty=text');
  assert(addBindingData?.dataSourceId === datasourceId, 'add_data_binding: dataSourceId 일치');
  assert(addBindingData?.dataField === 'name', 'add_data_binding: dataField=name');
  assert(addBindingData?.bindingMode === 'oneWay', 'add_data_binding: bindingMode=oneWay');
  assert(addBindingData?.totalBindings >= 1, 'add_data_binding: totalBindings >= 1');
  assert(typeof addBindingData?.formVersion === 'number', 'add_data_binding: formVersion 반환');

  // 6-2. 두 번째 바인딩 추가 (레이블)
  console.log('  --- 6-2. add_data_binding (레이블) ---');
  const addBinding2Result = await client.callTool({
    name: 'add_data_binding',
    arguments: {
      formId,
      controlId: labelId,
      controlProperty: 'text',
      dataSourceId: datasourceId,
      dataField: 'email',
      bindingMode: 'twoWay',
    },
  });
  const addBinding2Data = parseToolResult(addBinding2Result as any) as any;
  assert(!isToolError(addBinding2Result), 'add_data_binding (레이블): 에러 없음');
  assert(addBinding2Data?.bindingMode === 'twoWay', 'add_data_binding (레이블): bindingMode=twoWay');
  assert(addBinding2Data?.totalBindings >= 2, 'add_data_binding (레이블): totalBindings >= 2');

  // 6-3. list_data_bindings
  console.log('  --- 6-3. list_data_bindings ---');
  const listBindingsResult = await client.callTool({
    name: 'list_data_bindings',
    arguments: { formId },
  });
  const listBindingsData = parseToolResult(listBindingsResult as any) as any;
  assert(
    listBindingsData?.totalCount >= 2,
    `list_data_bindings: totalCount >= 2 (실제: ${listBindingsData?.totalCount})`,
  );
  assert(Array.isArray(listBindingsData?.bindings), 'list_data_bindings: bindings 배열');

  const btnBinding = listBindingsData?.bindings?.find(
    (b: any) => b.controlId === buttonId && b.controlProperty === 'text',
  );
  assert(!!btnBinding, 'list_data_bindings: 버튼 바인딩 조회');
  assert(btnBinding?.controlName === 'btnPhase3', 'list_data_bindings: controlName 매핑');
  assert(btnBinding?.dataField === 'name', 'list_data_bindings: dataField 일치');

  const lblBinding = listBindingsData?.bindings?.find(
    (b: any) => b.controlId === labelId && b.controlProperty === 'text',
  );
  assert(!!lblBinding, 'list_data_bindings: 레이블 바인딩 조회');

  // 6-4. 중복 바인딩 에러
  console.log('  --- 6-4. 중복 바인딩 에러 ---');
  const dupBindingResult = await client.callTool({
    name: 'add_data_binding',
    arguments: {
      formId,
      controlId: buttonId,
      controlProperty: 'text',
      dataSourceId: datasourceId,
      dataField: 'email',
    },
  });
  assert(
    isToolError(dupBindingResult) ||
      (dupBindingResult as any).content?.[0]?.text?.includes('이미 존재'),
    '중복 바인딩 → 에러 응답',
  );

  // 6-5. remove_data_binding
  console.log('  --- 6-5. remove_data_binding ---');
  const removeBindingResult = await client.callTool({
    name: 'remove_data_binding',
    arguments: {
      formId,
      controlId: buttonId,
      controlProperty: 'text',
    },
  });
  const removeBindingData = parseToolResult(removeBindingResult as any) as any;
  assert(!isToolError(removeBindingResult), 'remove_data_binding: 에러 없음');
  assert(removeBindingData?.removed === true, 'remove_data_binding: removed=true');
  assert(
    typeof removeBindingData?.remainingBindings === 'number',
    'remove_data_binding: remainingBindings 반환',
  );

  // 삭제 확인
  const listAfterRemove = await client.callTool({
    name: 'list_data_bindings',
    arguments: { formId },
  });
  const afterRemoveData = parseToolResult(listAfterRemove as any) as any;
  const removedBinding = afterRemoveData?.bindings?.find(
    (b: any) => b.controlId === buttonId && b.controlProperty === 'text',
  );
  assert(!removedBinding, 'remove_data_binding: 삭제 후 바인딩 없음');

  // 6-6. 존재하지 않는 바인딩 삭제 에러
  console.log('  --- 6-6. 존재하지 않는 바인딩 삭제 에러 ---');
  const removeNotFoundResult = await client.callTool({
    name: 'remove_data_binding',
    arguments: {
      formId,
      controlId: buttonId,
      controlProperty: 'nonexistent',
    },
  });
  assert(
    isToolError(removeNotFoundResult) ||
      (removeNotFoundResult as any).content?.[0]?.text?.includes('찾을 수 없'),
    '존재하지 않는 바인딩 삭제 → 에러 응답',
  );

  console.log();

  // ═══════════════════════════════════════════════════════════
  // 7. 테마 Tools 테스트
  // ═══════════════════════════════════════════════════════════

  console.log('[7] 테마 Tools 테스트');

  // 7-1. list_themes → 프리셋 테마 확인
  console.log('  --- 7-1. list_themes ---');
  const listThemesResult = await client.callTool({
    name: 'list_themes',
    arguments: {},
  });
  const listThemesData = parseToolResult(listThemesResult as any) as any;
  assert(Array.isArray(listThemesData?.themes), 'list_themes: themes 배열');
  assert(listThemesData?.themes?.length > 0, 'list_themes: 최소 1개 테마 존재');
  assert(!!listThemesData?.meta, 'list_themes: meta 존재');

  // 프리셋 테마 확인
  const presetThemes = listThemesData?.themes?.filter((t: any) => t.isPreset === true) || [];
  assert(presetThemes.length > 0, `list_themes: 프리셋 테마 존재 (${presetThemes.length}개)`);

  // 프리셋 테마 ID를 기록 (apply_theme_to_form에서 사용)
  const firstPresetThemeId = presetThemes[0]?.id;
  assert(!!firstPresetThemeId, `list_themes: 첫 번째 프리셋 테마 ID (${firstPresetThemeId})`);

  // 7-2. get_theme (프리셋 테마)
  console.log('  --- 7-2. get_theme (프리셋) ---');
  if (firstPresetThemeId) {
    const getThemeResult = await client.callTool({
      name: 'get_theme',
      arguments: { themeId: firstPresetThemeId },
    });
    const getThemeData = parseToolResult(getThemeResult as any) as any;
    assert(getThemeData?.id === firstPresetThemeId, 'get_theme: id 일치');
    assert(getThemeData?.isPreset === true, 'get_theme: isPreset=true');
    assert(!!getThemeData?.tokens, 'get_theme: tokens 포함');
  }

  // 7-3. create_theme (커스텀 테마)
  console.log('  --- 7-3. create_theme ---');
  const createThemeResult = await client.callTool({
    name: 'create_theme',
    arguments: {
      name: '__MCP_PHASE3_TEST_THEME__',
      tokens: {
        window: {
          titleBar: { background: '#2d2d30', foreground: '#ffffff' },
        },
        form: {
          backgroundColor: '#1e1e1e',
          foreground: '#d4d4d4',
          fontFamily: 'Segoe UI',
          fontSize: 14,
        },
        controls: {
          button: {
            background: '#0e639c',
            foreground: '#ffffff',
            border: '#0e639c',
            hoverBackground: '#1177bb',
          },
        },
        accent: {
          primary: '#0e639c',
          primaryHover: '#1177bb',
          primaryForeground: '#ffffff',
        },
      },
    },
  });
  const createThemeData = parseToolResult(createThemeResult as any) as any;
  const customThemeId = createThemeData?.id;
  assert(!!customThemeId, `create_theme: 커스텀 테마 생성 (id=${customThemeId})`);
  assert(createThemeData?.name === '__MCP_PHASE3_TEST_THEME__', 'create_theme: 이름 일치');
  assert(createThemeData?.isPreset === false, 'create_theme: isPreset=false');

  // 7-4. get_theme (커스텀 테마 확인)
  console.log('  --- 7-4. get_theme (커스텀) ---');
  if (customThemeId) {
    const getCustomThemeResult = await client.callTool({
      name: 'get_theme',
      arguments: { themeId: customThemeId },
    });
    const getCustomThemeData = parseToolResult(getCustomThemeResult as any) as any;
    assert(getCustomThemeData?.id === customThemeId, 'get_theme (커스텀): id 일치');
    assert(
      getCustomThemeData?.tokens?.form?.backgroundColor === '#1e1e1e',
      'get_theme (커스텀): tokens.form.backgroundColor 일치',
    );
  }

  // 7-5. update_theme (커스텀 테마 수정)
  console.log('  --- 7-5. update_theme ---');
  if (customThemeId) {
    const updateThemeResult = await client.callTool({
      name: 'update_theme',
      arguments: {
        themeId: customThemeId,
        name: '__MCP_PHASE3_TEST_THEME_UPDATED__',
      },
    });
    const updateThemeData = parseToolResult(updateThemeResult as any) as any;
    assert(!isToolError(updateThemeResult), 'update_theme: 에러 없음');
    assert(updateThemeData?.id === customThemeId, 'update_theme: id 일치');
    assert(
      updateThemeData?.name === '__MCP_PHASE3_TEST_THEME_UPDATED__',
      'update_theme: 이름 변경됨',
    );
  }

  // 7-6. apply_theme_to_form
  console.log('  --- 7-6. apply_theme_to_form ---');
  const themeToApply = customThemeId || firstPresetThemeId;
  if (themeToApply) {
    const applyResult = await client.callTool({
      name: 'apply_theme_to_form',
      arguments: {
        formId,
        themeId: themeToApply,
      },
    });
    const applyData = parseToolResult(applyResult as any) as any;
    assert(!isToolError(applyResult), 'apply_theme_to_form: 에러 없음');
    assert(applyData?.applied === true, 'apply_theme_to_form: applied=true');
    assert(applyData?.formId === formId, 'apply_theme_to_form: formId 일치');
    assert(applyData?.themeId === themeToApply, 'apply_theme_to_form: themeId 일치');
    assert(typeof applyData?.version === 'number', 'apply_theme_to_form: version 반환');
  }

  // 7-7. 폼 조회로 테마 적용 확인
  console.log('  --- 7-7. 폼에서 테마 적용 확인 ---');
  const getFormResult = await client.callTool({
    name: 'get_form',
    arguments: { formId },
  });
  const formWithTheme = parseToolResult(getFormResult as any) as any;
  assert(
    formWithTheme?.properties?.theme === themeToApply,
    `폼 properties.theme=${themeToApply}`,
  );

  console.log();

  // ═══════════════════════════════════════════════════════════
  // 8. Shell Tools 테스트
  // ═══════════════════════════════════════════════════════════

  console.log('[8] Shell Tools 테스트');

  // 8-1. get_shell (생성 전 → null)
  console.log('  --- 8-1. get_shell (생성 전) ---');
  const getShellBeforeResult = await client.callTool({
    name: 'get_shell',
    arguments: { projectId },
  });
  const shellBefore = parseToolResult(getShellBeforeResult as any) as any;
  // Shell이 없으면 data: null 또는 에러
  const shellNotExist =
    shellBefore?.shell === null || isToolError(getShellBeforeResult);
  assert(shellNotExist, 'get_shell (생성 전): Shell 없음');

  // 8-2. create_shell
  console.log('  --- 8-2. create_shell ---');
  const createShellResult = await client.callTool({
    name: 'create_shell',
    arguments: {
      projectId,
      name: '__MCP_PHASE3_TEST_SHELL__',
      properties: {
        title: 'Phase3 Test Shell',
        width: 1024,
        height: 768,
        backgroundColor: '#f0f0f0',
        showTitleBar: true,
        formBorderStyle: 'Sizable',
        maximizeBox: true,
        minimizeBox: true,
      },
      startFormId: formId,
    },
  });
  const createShellData = parseToolResult(createShellResult as any) as any;
  assert(!isToolError(createShellResult), 'create_shell: 에러 없음');
  assert(!!createShellData?.shellId, `create_shell: shellId 반환 (${createShellData?.shellId})`);
  assert(createShellData?.name === '__MCP_PHASE3_TEST_SHELL__', 'create_shell: 이름 일치');
  assert(typeof createShellData?.version === 'number', 'create_shell: version 반환');
  assert(createShellData?.published === false, 'create_shell: published=false');
  const shellId = createShellData?.shellId;

  // 8-3. get_shell (생성 후)
  console.log('  --- 8-3. get_shell (생성 후) ---');
  const getShellAfterResult = await client.callTool({
    name: 'get_shell',
    arguments: { projectId },
  });
  const shellAfter = parseToolResult(getShellAfterResult as any) as any;
  assert(!isToolError(getShellAfterResult), 'get_shell (생성 후): 에러 없음');
  assert(!!shellAfter?.shell, 'get_shell (생성 후): shell 존재');
  assert(
    shellAfter?.shell?.properties?.title === 'Phase3 Test Shell',
    'get_shell: properties.title 일치',
  );
  assert(
    shellAfter?.shell?.properties?.width === 1024,
    'get_shell: properties.width=1024',
  );
  assert(
    shellAfter?.shell?.startFormId === formId,
    'get_shell: startFormId 일치',
  );

  // 8-4. update_shell
  console.log('  --- 8-4. update_shell ---');
  const updateShellResult = await client.callTool({
    name: 'update_shell',
    arguments: {
      projectId,
      properties: {
        title: 'Updated Shell Title',
        height: 900,
      },
    },
  });
  const updateShellData = parseToolResult(updateShellResult as any) as any;
  assert(!isToolError(updateShellResult), 'update_shell: 에러 없음');
  assert(updateShellData?.published === false, 'update_shell: published=false (수정 시 리셋)');

  // 수정 확인
  const getShellUpdated = await client.callTool({
    name: 'get_shell',
    arguments: { projectId },
  });
  const shellUpdated = parseToolResult(getShellUpdated as any) as any;
  assert(
    shellUpdated?.shell?.properties?.title === 'Updated Shell Title',
    'update_shell: title 변경됨',
  );

  // 8-5. publish_shell
  console.log('  --- 8-5. publish_shell ---');
  const publishShellResult = await client.callTool({
    name: 'publish_shell',
    arguments: { projectId },
  });
  const publishShellData = parseToolResult(publishShellResult as any) as any;
  assert(!isToolError(publishShellResult), 'publish_shell: 에러 없음');
  assert(publishShellData?.published === true, 'publish_shell: published=true');

  // 8-6. 중복 publish 에러
  console.log('  --- 8-6. 중복 publish 에러 ---');
  const dupPublishResult = await client.callTool({
    name: 'publish_shell',
    arguments: { projectId },
  });
  assert(
    isToolError(dupPublishResult) ||
      (dupPublishResult as any).content?.[0]?.text?.includes('이미 published'),
    '중복 publish → 에러 응답',
  );

  // 8-7. 중복 create 에러
  console.log('  --- 8-7. 중복 create_shell 에러 ---');
  const dupCreateShellResult = await client.callTool({
    name: 'create_shell',
    arguments: {
      projectId,
      name: 'duplicate-shell',
    },
  });
  assert(
    isToolError(dupCreateShellResult) ||
      (dupCreateShellResult as any).content?.[0]?.text?.includes('이미 Shell'),
    '중복 Shell 생성 → 에러 응답',
  );

  console.log();

  // ═══════════════════════════════════════════════════════════
  // 9. 리소스 테스트
  // ═══════════════════════════════════════════════════════════

  console.log('[9] 리소스 테스트');

  // 9-1. webform://themes/{themeId}
  console.log('  --- 9-1. webform://themes/{themeId} ---');
  const themeResourceId = customThemeId || firstPresetThemeId;
  if (themeResourceId) {
    const themeResource = await client.readResource({
      uri: `webform://themes/${themeResourceId}`,
    });
    assert(themeResource.contents.length > 0, 'themes resource: 내용 반환');
    const themeContent = JSON.parse(
      (themeResource.contents[0] as { uri: string; text: string }).text,
    );
    assert(!!themeContent, 'themes resource: JSON 파싱 성공');
    assert(
      themeContent?._id === themeResourceId || themeContent?.id === themeResourceId,
      'themes resource: ID 일치',
    );
    assert(!!themeContent?.tokens || !!themeContent?.name, 'themes resource: 데이터 포함');
  } else {
    assert(false, 'themes resource: 테스트할 테마 ID 없음');
  }

  // 9-2. webform://shells/{projectId}
  console.log('  --- 9-2. webform://shells/{projectId} ---');
  const shellResource = await client.readResource({
    uri: `webform://shells/${projectId}`,
  });
  assert(shellResource.contents.length > 0, 'shells resource: 내용 반환');
  const shellContent = JSON.parse(
    (shellResource.contents[0] as { uri: string; text: string }).text,
  );
  assert(!!shellContent, 'shells resource: JSON 파싱 성공');
  assert(
    shellContent?._id === shellId ||
      shellContent?.projectId === projectId ||
      shellContent?.name === '__MCP_PHASE3_TEST_SHELL__',
    'shells resource: Shell 데이터 포함',
  );

  // 9-3. webform://schema/theme-tokens (Phase 2에서도 테스트했지만 Phase 3 맥락에서 재검증)
  console.log('  --- 9-3. webform://schema/theme-tokens ---');
  const ttResource = await client.readResource({
    uri: 'webform://schema/theme-tokens',
  });
  assert(ttResource.contents.length > 0, 'schema/theme-tokens: 내용 반환');
  const ttContent = JSON.parse(
    (ttResource.contents[0] as { uri: string; text: string }).text,
  );
  assert(ttContent?.title === 'ThemeTokens', 'schema/theme-tokens: title=ThemeTokens');
  assert(!!ttContent?.structure?.controls, 'schema/theme-tokens: controls 구조 존재');
  assert(!!ttContent?.structure?.window, 'schema/theme-tokens: window 구조 존재');
  assert(!!ttContent?.structure?.form, 'schema/theme-tokens: form 구조 존재');
  assert(!!ttContent?.structure?.accent, 'schema/theme-tokens: accent 구조 존재');

  console.log();

  // ═══════════════════════════════════════════════════════════
  // 10. 에러 케이스 추가 검증
  // ═══════════════════════════════════════════════════════════

  console.log('[10] 에러 케이스 검증');

  // 10-1. 잘못된 ObjectId
  const badIdResult = await client.callTool({
    name: 'get_datasource',
    arguments: { datasourceId: 'invalid-id' },
  });
  assert(
    isToolError(badIdResult) ||
      (badIdResult as any).content?.[0]?.text?.includes('유효하지 않은'),
    '잘못된 ObjectId → 에러 응답',
  );

  // 10-2. 존재하지 않는 데이터소스
  const notFoundDsResult = await client.callTool({
    name: 'get_datasource',
    arguments: { datasourceId: 'aaaaaaaaaaaaaaaaaaaaaaaa' },
  });
  assert(
    isToolError(notFoundDsResult) ||
      (notFoundDsResult as any).content?.[0]?.text?.includes('찾을 수 없'),
    '존재하지 않는 데이터소스 → 에러 응답',
  );

  // 10-3. 존재하지 않는 컨트롤에 바인딩 추가
  const badCtrlBindingResult = await client.callTool({
    name: 'add_data_binding',
    arguments: {
      formId,
      controlId: 'nonexistent-ctrl-id',
      controlProperty: 'text',
      dataSourceId: datasourceId,
      dataField: 'name',
    },
  });
  assert(
    isToolError(badCtrlBindingResult) ||
      (badCtrlBindingResult as any).content?.[0]?.text?.includes('찾을 수 없'),
    '존재하지 않는 컨트롤 바인딩 → 에러 응답',
  );

  console.log();

  // --- 11. 정리: 테스트 데이터 삭제 ---
  console.log('[11] 테스트 데이터 정리');

  // Shell 삭제
  const deleteShellResult = await client.callTool({
    name: 'delete_shell',
    arguments: { projectId },
  });
  const deleteShellData = parseToolResult(deleteShellResult as any) as any;
  assert(
    deleteShellData?.deleted === true || !isToolError(deleteShellResult),
    'delete_shell: Shell 삭제 성공',
  );

  // 커스텀 테마 삭제
  if (customThemeId) {
    const deleteThemeResult = await client.callTool({
      name: 'delete_theme',
      arguments: { themeId: customThemeId },
    });
    const deleteThemeData = parseToolResult(deleteThemeResult as any) as any;
    assert(deleteThemeData?.deleted === true, 'delete_theme: 커스텀 테마 삭제 성공');
  }

  // 데이터소스 삭제
  const deleteDsResult = await client.callTool({
    name: 'delete_datasource',
    arguments: { datasourceId },
  });
  const deleteDsData = parseToolResult(deleteDsResult as any) as any;
  assert(deleteDsData?.deleted === true, 'delete_datasource: 데이터소스 삭제 성공');

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
