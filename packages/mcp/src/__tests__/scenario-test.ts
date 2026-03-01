import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let client: Client;

async function callTool(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as Array<{ type: string; text: string }>)[0]?.text || '';
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  if (result.isError) {
    console.error(`  ❌ ${name} 실패:`, typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));
    return null;
  }
  console.log(`  ✅ ${name} 성공`);
  return parsed;
}

async function scenario1() {
  console.log('\n========================================');
  console.log('시나리오 1: 프로젝트 생성 → 폼 생성 → 컨트롤 추가 → 이벤트 등록 → 퍼블리시');
  console.log('========================================');

  // 1. 프로젝트 생성
  const project = await callTool('create_project', {
    name: 'MCP 통합 테스트 프로젝트 ' + Date.now(),
    description: 'MCP 시나리오 테스트용',
  });
  if (!project) return null;
  const projectId = project.project?.id;
  console.log(`    projectId: ${projectId}`);

  // 2. 폼 생성 — 응답이 최상위 { id, name, ... }
  const form = await callTool('create_form', {
    name: '사용자 등록 폼',
    projectId,
    properties: { width: 600, height: 500 },
  });
  if (!form) return { projectId };
  const formId = form.id;
  console.log(`    formId: ${formId}`);

  // 3. 컨트롤 일괄 추가
  const batchResult = await callTool('batch_add_controls', {
    formId,
    controls: [
      { type: 'Label', name: 'lblTitle', properties: { text: '사용자 등록' }, position: { x: 200, y: 16 } },
      { type: 'Label', name: 'lblName', properties: { text: '이름' }, position: { x: 32, y: 64 } },
      { type: 'TextBox', name: 'txtName', position: { x: 120, y: 60 }, size: { width: 300, height: 28 } },
      { type: 'Label', name: 'lblEmail', properties: { text: '이메일' }, position: { x: 32, y: 104 } },
      { type: 'TextBox', name: 'txtEmail', position: { x: 120, y: 100 }, size: { width: 300, height: 28 } },
      { type: 'Button', name: 'btnRegister', properties: { text: '등록' }, position: { x: 200, y: 200 } },
      { type: 'Button', name: 'btnCancel', properties: { text: '취소' }, position: { x: 320, y: 200 } },
    ],
  });
  if (!batchResult) return { projectId, formId };
  console.log(`    ${batchResult.count}개 컨트롤 추가됨`);

  // 4. 이벤트 핸들러 등록
  const btnRegister = batchResult.addedControls?.find((c: any) => c.name === 'btnRegister');
  if (btnRegister) {
    const controlId = btnRegister.controlId || btnRegister.id;
    console.log(`    btnRegister controlId: ${controlId}`);
    await callTool('add_event_handler', {
      formId,
      controlId,
      eventName: 'Click',
      handlerCode: `
        const name = ctx.controls.txtName.text;
        const email = ctx.controls.txtEmail.text;
        if (!name || !email) {
          ctx.showMessage('이름과 이메일을 입력해주세요.', '입력 오류', 'warning');
          return;
        }
        ctx.showMessage('등록되었습니다.', '성공', 'info');
      `,
    });
  } else {
    console.log('  ⚠️ btnRegister를 찾지 못함');
  }

  // 5. 퍼블리시
  await callTool('publish_form', { formId });

  console.log('  📋 시나리오 1 완료!');
  return { projectId, formId };
}

async function scenario2(formId: string | undefined, projectId: string | undefined) {
  console.log('\n========================================');
  console.log('시나리오 2: 기존 폼에 DataGridView + 데이터 바인딩');
  console.log('========================================');

  if (!formId && projectId) {
    const formResult = await callTool('create_form', {
      name: '데이터 그리드 테스트 폼',
      projectId,
      properties: { width: 800, height: 600 },
    });
    if (!formResult) return;
    formId = formResult.id;
  }
  if (!formId) {
    console.log('  ⚠️ formId가 없어 건너뜁니다.');
    return;
  }

  // 1. DataGridView 추가
  const dgvResult = await callTool('add_control', {
    formId,
    type: 'DataGridView',
    name: 'dgvUsers',
    position: { x: 32, y: 250 },
    size: { width: 540, height: 200 },
  });
  if (!dgvResult) return;
  const dgvId = dgvResult.control?.id || dgvResult.controlId || dgvResult.id;
  console.log(`    dgvId: ${dgvId}`);

  // 2. 조회 버튼 추가
  await callTool('add_control', {
    formId,
    type: 'Button',
    name: 'btnLoad',
    properties: { text: '데이터 조회' },
    position: { x: 32, y: 460 },
  });

  // 3. 데이터소스 생성
  const dsResult = await callTool('create_datasource', {
    name: 'users_api_' + Date.now(),
    projectId: projectId!,
    type: 'restApi',
    config: {
      url: 'https://jsonplaceholder.typicode.com/users',
      method: 'GET',
    },
  });

  if (dsResult && dgvId) {
    const dsId = dsResult.id || dsResult.datasource?.id || dsResult.dataSource?.id;
    console.log(`    dsId: ${dsId}`);

    // 4. 데이터 바인딩
    if (dsId) {
      await callTool('add_data_binding', {
        formId,
        controlId: dgvId,
        controlProperty: 'dataSource',
        dataSourceId: dsId,
        dataField: 'users',
      });
    }
  }

  console.log('  📋 시나리오 2 완료!');
}

async function scenario3(projectId?: string) {
  console.log('\n========================================');
  console.log('시나리오 3: 테마 생성 → 적용');
  console.log('========================================');

  // 1. 테마 생성 — 응답이 최상위 { id, name, ... }
  const themeResult = await callTool('create_theme', {
    name: 'MCP 다크 테마 ' + Date.now(),
    tokens: {
      window: { background: '#1E1E1E' },
      form: { background: '#252526', foreground: '#CCCCCC' },
      control: { background: '#3C3C3C', foreground: '#CCCCCC', border: '#555555' },
      button: { background: '#0E639C', foreground: '#FFFFFF' },
    },
  });
  if (!themeResult) return;
  const themeId = themeResult.id;
  console.log(`    themeId: ${themeId}`);

  // 2. 폼 목록 조회
  const formsResult = await callTool('list_forms', projectId ? { projectId } : {});
  if (!formsResult || !formsResult.forms?.length) {
    console.log('  ⚠️  적용할 폼이 없습니다.');
    return;
  }

  // 3. 첫 번째 폼에 테마 적용
  const firstFormId = formsResult.forms[0].id;
  if (themeId && firstFormId) {
    console.log(`    폼 "${formsResult.forms[0].name}" (${firstFormId})에 테마 적용 중...`);
    await callTool('apply_theme_to_form', { formId: firstFormId, themeId });
  }

  console.log('  📋 시나리오 3 완료!');
}

async function main() {
  console.log('MCP 시나리오 테스트 시작...\n');

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'packages/mcp/src/index.ts'],
    cwd: '/home/felix/src/webform',
    env: { ...process.env, WEBFORM_API_URL: 'http://localhost:4000' },
  });

  client = new Client({ name: 'scenario-test', version: '1.0.0' });
  await client.connect(transport);
  console.log('MCP 서버 연결 완료');

  // 서버 헬스 체크
  const health = await callTool('get_server_health', {});
  if (!health) {
    console.error('Express 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
    await client.close();
    process.exit(1);
  }
  console.log('Express 서버 연결 확인');

  // 시나리오 실행
  const s1Result = await scenario1();
  await scenario2(s1Result?.formId, s1Result?.projectId);
  await scenario3(s1Result?.projectId);

  // 정리: validate_form 확인
  if (s1Result?.formId) {
    console.log('\n========================================');
    console.log('추가 검증: 폼 유효성 검사');
    console.log('========================================');
    // get_form으로 폼 정의를 가져와서 validate_form에 전달
    const formDef = await callTool('get_form', { formId: s1Result.formId });
    if (formDef) {
      await callTool('validate_form', { formDefinition: formDef });
    }
  }

  console.log('\n========================================');
  console.log('✅ 모든 시나리오 테스트 완료!');
  console.log('========================================');

  await client.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
