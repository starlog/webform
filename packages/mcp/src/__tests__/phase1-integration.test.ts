/**
 * Phase 1 통합 테스트
 *
 * MCP SDK Client를 통해 stdio 기반으로 MCP 서버에 연결한 후,
 * Tool/Resource 목록, CRUD 흐름, 에러 케이스를 종합 검증한다.
 *
 * 사전 조건: Express 서버(localhost:4000) 실행 중이어야 함.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = resolve(__dirname, '../../dist/index.js');

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

// --- 메인 ---

async function main() {
  console.log('\n🔧 Phase 1 통합 테스트 시작\n');

  // 1. MCP 클라이언트 연결
  console.log('[1] MCP 서버 연결');
  const transport = new StdioClientTransport({
    command: 'node',
    args: [SERVER_ENTRY],
    env: { ...process.env, WEBFORM_API_URL: 'http://localhost:4000' },
  });

  const client = new Client({ name: 'phase1-test', version: '1.0.0' });
  await client.connect(transport);
  console.log('  ✅ MCP 서버 연결 성공\n');

  // --- 2. Tool 목록 검증 ---
  console.log('[2] Tool 목록 검증');
  const { tools } = await client.listTools();
  const toolNames = tools.map((t) => t.name).sort();

  const expectedProjectTools = [
    'list_projects',
    'get_project',
    'create_project',
    'update_project',
    'delete_project',
    'export_project',
    'import_project',
    'publish_all',
  ].sort();

  const expectedFormTools = [
    'list_forms',
    'get_form',
    'create_form',
    'update_form',
    'delete_form',
    'publish_form',
    'get_form_versions',
    'get_form_version_snapshot',
  ].sort();

  assert(tools.length === 16, `총 16개 Tool 등록됨 (실제: ${tools.length})`);

  for (const name of expectedProjectTools) {
    assert(toolNames.includes(name), `프로젝트 Tool: ${name}`);
  }
  for (const name of expectedFormTools) {
    assert(toolNames.includes(name), `폼 Tool: ${name}`);
  }

  // 각 Tool에 description이 있는지
  for (const tool of tools) {
    assert(
      !!tool.description && tool.description.length > 0,
      `Tool ${tool.name}에 description 존재`,
    );
  }
  console.log();

  // --- 3. Resource Template 목록 검증 ---
  console.log('[3] Resource Template 목록 검증');
  const { resourceTemplates } = await client.listResourceTemplates();
  const templateUris = resourceTemplates.map((r) => r.uriTemplate).sort();

  const expectedTemplates = [
    'webform://projects/{projectId}',
    'webform://forms/{formId}',
    'webform://forms/{formId}/controls',
    'webform://forms/{formId}/events',
    'webform://forms/{formId}/bindings',
    'webform://forms/{formId}/versions',
  ].sort();

  assert(
    resourceTemplates.length === 6,
    `총 6개 Resource Template 등록됨 (실제: ${resourceTemplates.length})`,
  );

  for (const uri of expectedTemplates) {
    assert(templateUris.includes(uri), `Resource Template: ${uri}`);
  }
  console.log();

  // --- 4. 기능 테스트: 프로젝트 CRUD ---
  console.log('[4] 프로젝트 CRUD 테스트');

  // 4-1. list_projects
  const listResult = await client.callTool({ name: 'list_projects', arguments: {} });
  const listData = parseToolResult(listResult as any) as any;
  assert(Array.isArray(listData?.projects), 'list_projects: projects 배열 반환');
  assert(typeof listData?.meta?.total === 'number', 'list_projects: meta.total 존재');

  // 4-2. create_project
  const createResult = await client.callTool({
    name: 'create_project',
    arguments: {
      name: '__MCP_TEST_PROJECT__',
      description: 'Phase 1 통합 테스트용 프로젝트',
    },
  });
  const createData = parseToolResult(createResult as any) as any;
  const projectId = createData?.project?.id;
  assert(!!projectId, `create_project: 프로젝트 생성 (id=${projectId})`);
  assert(createData?.project?.name === '__MCP_TEST_PROJECT__', 'create_project: 이름 일치');

  // 4-3. get_project
  const getResult = await client.callTool({
    name: 'get_project',
    arguments: { projectId },
  });
  const getData = parseToolResult(getResult as any) as any;
  assert(getData?.project?.id === projectId, 'get_project: ID 일치');
  assert(getData?.project?.name === '__MCP_TEST_PROJECT__', 'get_project: 이름 일치');
  assert(Array.isArray(getData?.forms), 'get_project: forms 배열 포함');

  // 4-4. update_project
  const updateResult = await client.callTool({
    name: 'update_project',
    arguments: { projectId, name: '__MCP_TEST_UPDATED__' },
  });
  const updateData = parseToolResult(updateResult as any) as any;
  assert(updateData?.project?.name === '__MCP_TEST_UPDATED__', 'update_project: 이름 변경 확인');

  // 4-5. export_project
  const exportResult = await client.callTool({
    name: 'export_project',
    arguments: { projectId },
  });
  const exportData = parseToolResult(exportResult as any) as any;
  assert(!!exportData?.exportVersion, 'export_project: exportVersion 존재');
  assert(!!exportData?.project, 'export_project: project 정보 포함');

  console.log();

  // --- 5. 기능 테스트: 폼 CRUD ---
  console.log('[5] 폼 CRUD 테스트');

  // 5-1. create_form
  const createFormResult = await client.callTool({
    name: 'create_form',
    arguments: {
      name: '__MCP_TEST_FORM__',
      projectId,
      properties: { width: 1024, height: 768 },
    },
  });
  const createFormData = parseToolResult(createFormResult as any) as any;
  const formId = createFormData?.id;
  assert(!!formId, `create_form: 폼 생성 (id=${formId})`);
  assert(createFormData?.name === '__MCP_TEST_FORM__', 'create_form: 이름 일치');
  assert(createFormData?.status === 'draft', 'create_form: 초기 상태 draft');

  // 5-2. get_form
  const getFormResult = await client.callTool({
    name: 'get_form',
    arguments: { formId },
  });
  const getFormData = parseToolResult(getFormResult as any) as any;
  assert(getFormData?.id === formId, 'get_form: ID 일치');
  assert(getFormData?.name === '__MCP_TEST_FORM__', 'get_form: 이름 일치');
  assert(getFormData?.projectId === projectId, 'get_form: projectId 일치');
  assert(typeof getFormData?.version === 'number', 'get_form: version 존재');

  // 5-3. update_form (낙관적 잠금)
  const updateFormResult = await client.callTool({
    name: 'update_form',
    arguments: {
      formId,
      version: getFormData.version,
      name: '__MCP_TEST_FORM_UPDATED__',
    },
  });
  const updateFormData = parseToolResult(updateFormResult as any) as any;
  assert(
    updateFormData?.name === '__MCP_TEST_FORM_UPDATED__',
    'update_form: 이름 변경 확인',
  );
  assert(updateFormData?.version > getFormData.version, 'update_form: 버전 증가');

  // 5-4. list_forms
  const listFormsResult = await client.callTool({
    name: 'list_forms',
    arguments: { projectId },
  });
  const listFormsData = parseToolResult(listFormsResult as any) as any;
  assert(Array.isArray(listFormsData?.forms), 'list_forms: forms 배열 반환');
  assert(
    listFormsData?.forms?.some((f: any) => f.id === formId),
    'list_forms: 생성한 폼이 목록에 포함',
  );

  // 5-5. publish_form
  const publishResult = await client.callTool({
    name: 'publish_form',
    arguments: { formId },
  });
  const publishData = parseToolResult(publishResult as any) as any;
  assert(publishData?.status === 'published', 'publish_form: 상태 published');

  // 5-6. get_form_versions
  const versionsResult = await client.callTool({
    name: 'get_form_versions',
    arguments: { formId },
  });
  const versionsData = parseToolResult(versionsResult as any) as any;
  assert(Array.isArray(versionsData?.versions), 'get_form_versions: versions 배열');

  // 5-7. Resource URI 조회
  console.log();
  console.log('[6] Resource URI 조회 테스트');
  const formResource = await client.readResource({
    uri: `webform://forms/${formId}`,
  });
  assert(
    formResource.contents.length > 0,
    'Resource webform://forms/{formId}: 내용 반환',
  );
  const formResContent = JSON.parse(formResource.contents[0].text as string);
  assert(formResContent?._id === formId, 'Resource: 올바른 폼 데이터');

  const projectResource = await client.readResource({
    uri: `webform://projects/${projectId}`,
  });
  assert(
    projectResource.contents.length > 0,
    'Resource webform://projects/{projectId}: 내용 반환',
  );

  const controlsResource = await client.readResource({
    uri: `webform://forms/${formId}/controls`,
  });
  assert(
    controlsResource.contents.length > 0,
    'Resource webform://forms/{formId}/controls: 내용 반환',
  );

  const eventsResource = await client.readResource({
    uri: `webform://forms/${formId}/events`,
  });
  assert(
    eventsResource.contents.length > 0,
    'Resource webform://forms/{formId}/events: 내용 반환',
  );

  const bindingsResource = await client.readResource({
    uri: `webform://forms/${formId}/bindings`,
  });
  assert(
    bindingsResource.contents.length > 0,
    'Resource webform://forms/{formId}/bindings: 내용 반환',
  );

  console.log();

  // --- 6. 에러 케이스 검증 ---
  console.log('[7] 에러 케이스 검증');

  // 6-1. 잘못된 ObjectId
  const badIdResult = await client.callTool({
    name: 'get_project',
    arguments: { projectId: 'invalid-id' },
  });
  const badIdData = badIdResult as any;
  assert(
    badIdData.isError === true || badIdData.content?.[0]?.text?.includes('유효하지 않은'),
    '잘못된 ID → 에러 응답',
  );

  // 6-2. 존재하지 않는 ID (유효한 형식이지만 없는 문서)
  const notFoundResult = await client.callTool({
    name: 'get_project',
    arguments: { projectId: 'aaaaaaaaaaaaaaaaaaaaaaaa' },
  });
  const notFoundData = notFoundResult as any;
  assert(
    notFoundData.isError === true || notFoundData.content?.[0]?.text?.includes('404') ||
      notFoundData.content?.[0]?.text?.includes('찾을 수 없'),
    '존재하지 않는 ID → 404 에러',
  );

  // 6-3. 잘못된 ID로 get_form
  const badFormIdResult = await client.callTool({
    name: 'get_form',
    arguments: { formId: 'not-a-valid-id' },
  });
  const badFormData = badFormIdResult as any;
  assert(
    badFormData.isError === true || badFormData.content?.[0]?.text?.includes('유효하지 않은'),
    'get_form 잘못된 ID → 에러 응답',
  );

  console.log();

  // --- 7. 정리: 테스트 데이터 삭제 ---
  console.log('[8] 테스트 데이터 정리');

  // 폼 삭제
  const deleteFormResult = await client.callTool({
    name: 'delete_form',
    arguments: { formId },
  });
  const deleteFormData = parseToolResult(deleteFormResult as any) as any;
  assert(deleteFormData?.deleted === true, 'delete_form: 폼 삭제 성공');

  // 프로젝트 삭제
  const deleteResult = await client.callTool({
    name: 'delete_project',
    arguments: { projectId },
  });
  const deleteData = parseToolResult(deleteResult as any) as any;
  assert(deleteData?.deleted === true, 'delete_project: 프로젝트 삭제 성공');

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
