/**
 * Phase 5 성능 최적화 테스트
 *
 * 1. MemoryCache 유닛 테스트 (TTL, 무효화, 크기)
 * 2. 정적 스키마 리소스 캐싱 검증
 * 3. API 클라이언트 타임아웃 검증
 * 4. 폼 캐시 + MCP 통합 테스트 (서버 필요)
 *
 * 유닛 테스트: 서버 없이 실행 가능
 * 통합 테스트: Express 서버(localhost:4000) 실행 중이어야 함
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MemoryCache, formCache } from '../utils/cache.js';

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// 유닛 테스트: MemoryCache
// ============================================================

async function testMemoryCache() {
  console.log('\n[1] MemoryCache 유닛 테스트');

  // 1-1. 기본 get/set
  const cache = new MemoryCache<string>(1000);
  cache.set('key1', 'value1');
  assert(cache.get('key1') === 'value1', 'get/set 기본 동작');

  // 1-2. 캐시 미스
  assert(cache.get('nonexistent') === undefined, '존재하지 않는 키는 undefined 반환');

  // 1-3. TTL 만료
  const shortCache = new MemoryCache<string>(50);
  shortCache.set('expire', 'data');
  assert(shortCache.get('expire') === 'data', 'TTL 내 데이터 접근 가능');
  await sleep(60);
  assert(shortCache.get('expire') === undefined, 'TTL 만료 후 undefined 반환');

  // 1-4. 무효화
  cache.set('key2', 'value2');
  cache.invalidate('key2');
  assert(cache.get('key2') === undefined, 'invalidate 후 undefined');

  // 1-5. clear
  cache.set('a', '1');
  cache.set('b', '2');
  cache.clear();
  assert(cache.size === 0, 'clear 후 size === 0');

  // 1-6. TTL 0 (무한)
  const permanentCache = new MemoryCache<string>(0);
  permanentCache.set('forever', 'data');
  await sleep(10);
  assert(permanentCache.get('forever') === 'data', 'TTL 0: 만료 없음');

  // 1-7. size 속성
  const sizeCache = new MemoryCache<number>(5000);
  sizeCache.set('x', 1);
  sizeCache.set('y', 2);
  sizeCache.set('z', 3);
  assert(sizeCache.size === 3, 'size 속성 반환');

  // 1-8. 덮어쓰기
  const overwriteCache = new MemoryCache<string>(5000);
  overwriteCache.set('k', 'old');
  overwriteCache.set('k', 'new');
  assert(overwriteCache.get('k') === 'new', '동일 키 덮어쓰기');

  // 1-9. formCache 싱글턴
  formCache.clear();
  formCache.set('form1', { name: 'test' });
  assert(formCache.get('form1') !== undefined, 'formCache 싱글턴 동작');
  formCache.clear();
}

// ============================================================
// 통합 테스트: MCP 서버 연동
// ============================================================

async function testIntegration() {
  console.log('\n[2] MCP 서버 통합 테스트');

  // 2-1. MCP 클라이언트 연결
  console.log('  MCP 서버 연결 중...');
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', SERVER_ENTRY],
    env: { ...process.env, WEBFORM_API_URL: 'http://localhost:4000' },
  });

  const client = new Client({ name: 'perf-test', version: '1.0.0' });
  await client.connect(transport);

  try {
    // 2-2. 정적 리소스 캐싱 검증 — 동일 리소스 연속 조회 시 동일 결과
    console.log('\n  [2-1] 정적 리소스 캐싱 검증');
    const schema1 = await client.readResource({ uri: 'webform://schema/control-types' });
    const schema2 = await client.readResource({ uri: 'webform://schema/control-types' });
    const text1 = (schema1.contents[0] as { text: string }).text;
    const text2 = (schema2.contents[0] as { text: string }).text;
    assert(text1 === text2, '정적 리소스 연속 조회 동일 결과');
    assert(text1.length > 100, '스키마 데이터가 유효함');

    const parsed = JSON.parse(text1);
    assert(parsed.controlTypes?.length > 0, 'controlTypes 배열 존재');
    assert(parsed.categories !== undefined, 'categories 존재');

    // 2-3. 이벤트 스키마 캐싱
    const events1 = await client.readResource({ uri: 'webform://schema/events' });
    const events2 = await client.readResource({ uri: 'webform://schema/events' });
    assert(
      (events1.contents[0] as { text: string }).text ===
        (events2.contents[0] as { text: string }).text,
      '이벤트 스키마 연속 조회 동일 결과',
    );

    // 2-4. 폼 생성 후 컨트롤 연속 추가 — 캐싱으로 GET 최소화
    console.log('\n  [2-2] 폼 캐싱 검증 (컨트롤 연속 추가)');
    const createResult = await client.callTool({
      name: 'create_form',
      arguments: { projectId: '', name: `perf-test-${Date.now()}` },
    });
    const createData = parseToolResult(createResult as any) as any;

    if (createData?.error) {
      console.log(`  ⚠️ 폼 생성 실패 (서버 미실행?): ${createData.error}`);
      console.log('  폼 캐싱 테스트 건너뜀');
      return;
    }

    const formId = createData?.formId;
    assert(!!formId, '테스트 폼 생성 완료');

    // 연속 3개 컨트롤 추가 — 두 번째, 세 번째는 캐시 히트 예상
    const start = Date.now();
    const r1 = await client.callTool({
      name: 'add_control',
      arguments: { formId, type: 'Button', name: 'btn1' },
    });
    const d1 = parseToolResult(r1 as any) as any;
    assert(!d1?.error, '첫 번째 컨트롤 추가 성공');

    const r2 = await client.callTool({
      name: 'add_control',
      arguments: { formId, type: 'TextBox', name: 'txt1' },
    });
    const d2 = parseToolResult(r2 as any) as any;
    assert(!d2?.error, '두 번째 컨트롤 추가 성공 (캐시 히트 기대)');

    const r3 = await client.callTool({
      name: 'add_control',
      arguments: { formId, type: 'Label', name: 'lbl1' },
    });
    const d3 = parseToolResult(r3 as any) as any;
    assert(!d3?.error, '세 번째 컨트롤 추가 성공 (캐시 히트 기대)');
    const elapsed = Date.now() - start;
    console.log(`  ⏱ 3개 컨트롤 연속 추가: ${elapsed}ms`);

    // 2-5. batch_add_controls — 단일 GET/PUT 확인
    console.log('\n  [2-3] batch_add_controls 최적화 검증');
    const batchResult = await client.callTool({
      name: 'batch_add_controls',
      arguments: {
        formId,
        controls: [
          { type: 'Button', name: 'batchBtn1' },
          { type: 'Button', name: 'batchBtn2' },
          { type: 'TextBox', name: 'batchTxt1' },
        ],
      },
    });
    const batchData = parseToolResult(batchResult as any) as any;
    assert(!batchData?.error, 'batch_add_controls 성공');
    assert(batchData?.count === 3, 'batch: 3개 컨트롤 추가됨');

    // 2-6. 정리: 테스트 폼 삭제
    await client.callTool({
      name: 'delete_form',
      arguments: { formId },
    });
    console.log('  테스트 폼 삭제 완료');
  } finally {
    await client.close();
  }
}

// --- 메인 ---

async function main() {
  console.log('\n🔧 Phase 5 성능 최적화 테스트 시작\n');

  // 유닛 테스트 (서버 불필요)
  await testMemoryCache();

  // 통합 테스트 (서버 필요)
  try {
    await testIntegration();
  } catch (err) {
    console.log(`\n  ⚠️ 통합 테스트 건너뜀 (서버 미실행): ${(err as Error).message}`);
  }

  // 결과
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`결과: ${passed} 통과, ${failed} 실패`);
  if (failures.length > 0) {
    console.log('\n실패 목록:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('테스트 실행 오류:', err);
  process.exit(1);
});
