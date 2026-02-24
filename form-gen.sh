#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# form-gen.sh
# JSON 파일을 읽어 POST /api/projects/import 로 폼을 생성하는 스크립트
#
# 사전 조건:
#   - 서버(localhost:4000)가 실행 중이어야 합니다
#   - .env 또는 packages/server/.env 에 JWT_SECRET이 설정되어 있어야 합니다
#
# 사용법:
#   ./form-gen.sh <json-file>          # JSON 파일로 임포트
#   ./form-gen.sh -                    # stdin으로 JSON 입력 (AI 파이프라인용)
#   echo '{ ... }' | ./form-gen.sh -   # 파이프로 전달
#   ./form-gen.sh --help               # 도움말
#
# JSON 형식 (FORM.md 참조):
#   {
#     "project": { "name": "프로젝트명", "description": "설명" },
#     "forms": [
#       {
#         "name": "폼 이름",
#         "properties": { ... },
#         "controls": [ ... ],
#         "eventHandlers": [ ... ],
#         "dataBindings": [ ... ]
#       }
#     ]
#   }
###############################################################################

cd "$(dirname "$0")"

API_URL="${WEBFORM_API_URL:-http://localhost:4000}"

# ─── 색상 ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*" >&2; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*" >&2; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*" >&2; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*" >&2; exit 1; }

# ─── 도움말 ────────────────────────────────────────────────────────────────
show_help() {
  cat <<'HELP'
form-gen.sh — WebForm 폼 임포트 스크립트

사용법:
  ./form-gen.sh <json-file>          JSON 파일로 폼 임포트
  ./form-gen.sh -                    stdin으로 JSON 입력 (AI 파이프라인용)
  echo '{ ... }' | ./form-gen.sh -   파이프로 JSON 전달

환경 변수:
  WEBFORM_API_URL                    API 서버 URL (기본값: http://localhost:4000)

JSON 형식 (상세: FORM.md 참조):
  {
    "project": {
      "name": "프로젝트명",
      "description": "프로젝트 설명"
    },
    "forms": [
      {
        "name": "폼 이름",
        "properties": {
          "title": "폼 제목",
          "width": 800,
          "height": 600,
          "backgroundColor": "#F5F5F5",
          "font": {
            "family": "Pretendard",
            "size": 10,
            "bold": false,
            "italic": false,
            "underline": false,
            "strikethrough": false
          },
          "startPosition": "CenterScreen",
          "formBorderStyle": "Sizable",
          "maximizeBox": true,
          "minimizeBox": true
        },
        "controls": [ ... ],
        "eventHandlers": [ ... ],
        "dataBindings": []
      }
    ]
  }

예제:
  # 파일에서 임포트
  ./form-gen.sh my-form.json

  # AI 출력을 파이프로 전달
  claude -p "FORM.md를 참조하여 로그인 폼 JSON을 만들어줘" | ./form-gen.sh -

  # 결과 JSON만 stdout으로 출력 (로그는 stderr)
  ./form-gen.sh my-form.json > result.json
HELP
  exit 0
}

# ─── 인자 파싱 ─────────────────────────────────────────────────────────────
if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  show_help
fi

INPUT_SOURCE="$1"

# ─── JSON 읽기 ─────────────────────────────────────────────────────────────
if [ "$INPUT_SOURCE" = "-" ]; then
  info "stdin에서 JSON 읽는 중..."
  JSON_DATA=$(cat)
else
  if [ ! -f "$INPUT_SOURCE" ]; then
    fail "파일을 찾을 수 없습니다: ${INPUT_SOURCE}"
  fi
  info "파일에서 JSON 읽는 중: ${INPUT_SOURCE}"
  JSON_DATA=$(cat "$INPUT_SOURCE")
fi

if [ -z "$JSON_DATA" ]; then
  fail "JSON 데이터가 비어있습니다."
fi

# ─── JSON 유효성 검사 ──────────────────────────────────────────────────────
info "JSON 유효성 검사 중..."

VALIDATE_RESULT=$(node -e "
  const data = process.argv[1];
  try {
    const json = JSON.parse(data);

    // 필수 필드 검사
    if (!json.project || !json.project.name) {
      console.error('project.name이 필요합니다.');
      process.exit(1);
    }
    if (!Array.isArray(json.forms) || json.forms.length === 0) {
      console.error('forms 배열이 비어있습니다.');
      process.exit(1);
    }
    for (let i = 0; i < json.forms.length; i++) {
      if (!json.forms[i].name) {
        console.error('forms[' + i + '].name이 필요합니다.');
        process.exit(1);
      }
    }

    // 폼 수, 컨트롤 수 요약
    let totalControls = 0;
    let totalEvents = 0;
    function countControls(controls) {
      if (!Array.isArray(controls)) return;
      for (const c of controls) {
        totalControls++;
        if (c.children) countControls(c.children);
      }
    }
    for (const f of json.forms) {
      countControls(f.controls);
      totalEvents += (f.eventHandlers || []).length;
    }

    console.log(JSON.stringify({
      projectName: json.project.name,
      formCount: json.forms.length,
      formNames: json.forms.map(f => f.name),
      totalControls,
      totalEvents,
    }));
  } catch(e) {
    console.error('JSON 파싱 실패: ' + e.message);
    process.exit(1);
  }
" "$JSON_DATA" 2>&1) || fail "JSON 유효성 검사 실패: ${VALIDATE_RESULT}"

# 요약 정보 출력
PROJECT_NAME=$(echo "$VALIDATE_RESULT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); process.stdout.write(d.projectName)")
FORM_COUNT=$(echo "$VALIDATE_RESULT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); process.stdout.write(String(d.formCount))")
TOTAL_CONTROLS=$(echo "$VALIDATE_RESULT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); process.stdout.write(String(d.totalControls))")
TOTAL_EVENTS=$(echo "$VALIDATE_RESULT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); process.stdout.write(String(d.totalEvents))")
FORM_NAMES=$(echo "$VALIDATE_RESULT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); process.stdout.write(d.formNames.join(', '))")

ok "JSON 유효 — 프로젝트: \"${PROJECT_NAME}\", 폼 ${FORM_COUNT}개, 컨트롤 ${TOTAL_CONTROLS}개, 이벤트 ${TOTAL_EVENTS}개"
info "폼 목록: ${FORM_NAMES}"

# ─── .env 로드 (현재 디렉토리 우선, packages/server/.env 폴백) ────────────
load_env_var() {
  local var_name="$1"
  local value=""

  # 1) 현재 디렉토리의 .env 에서 먼저 시도
  if [ -f .env ]; then
    value=$(grep "^${var_name}=" .env | cut -d= -f2-) || true
  fi

  # 2) 없으면 packages/server/.env 에서 폴백
  if [ -z "$value" ] && [ -f packages/server/.env ]; then
    value=$(grep "^${var_name}=" packages/server/.env | cut -d= -f2-) || true
  fi

  echo "$value"
}

# ─── JWT 토큰 생성 ─────────────────────────────────────────────────────────
info "API 인증 토큰 생성 중..."

JWT_SECRET=$(load_env_var JWT_SECRET)
if [ -z "${JWT_SECRET:-}" ]; then
  fail ".env 또는 packages/server/.env 에서 JWT_SECRET을 찾을 수 없습니다. 먼저 ./run.sh를 실행하세요."
fi

TOKEN=$(node -e "
  const crypto = require('crypto');
  function base64url(buf) {
    return buf.toString('base64').replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
  }
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(Buffer.from(JSON.stringify({ sub: 'form-gen', role: 'admin', iat: now, exp: now + 3600 })));
  const sig = base64url(crypto.createHmac('sha256', '${JWT_SECRET}').update(header + '.' + payload).digest());
  process.stdout.write(header + '.' + payload + '.' + sig);
")

if [ -z "$TOKEN" ]; then
  fail "JWT 토큰 생성에 실패했습니다."
fi
ok "JWT 토큰 생성 완료"

# ─── API 서버 상태 확인 ────────────────────────────────────────────────────
info "API 서버 상태 확인 중 (${API_URL})..."

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/forms?limit=1" \
  -H "Authorization: Bearer ${TOKEN}" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "000" ]; then
  fail "API 서버(${API_URL})에 연결할 수 없습니다. 먼저 'pnpm dev' 또는 './run.sh'로 서버를 시작하세요."
fi
ok "API 서버 응답 확인 (HTTP ${HTTP_CODE})"

# ─── 기존 프로젝트 검색 ───────────────────────────────────────────────────
info "기존 프로젝트 검색 중: \"${PROJECT_NAME}\"..."

ENCODED_NAME=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$PROJECT_NAME")
SEARCH_RESULT=$(curl -s -w "\n%{http_code}" \
  "${API_URL}/api/projects?search=${ENCODED_NAME}&limit=100" \
  -H "Authorization: Bearer ${TOKEN}")
SEARCH_BODY=$(echo "$SEARCH_RESULT" | sed '$d')
SEARCH_STATUS=$(echo "$SEARCH_RESULT" | tail -1)

EXISTING_PROJECT_ID=""
if [ "$SEARCH_STATUS" = "200" ]; then
  EXISTING_PROJECT_ID=$(echo "$SEARCH_BODY" | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
    const target = process.argv[1];
    const match = (data.data || []).find(p => p.name === target);
    if (match) process.stdout.write(match._id);
  " "$PROJECT_NAME")
fi

# ─── 폼 임포트 ─────────────────────────────────────────────────────────────
if [ -n "$EXISTING_PROJECT_ID" ]; then
  ok "기존 프로젝트 발견 (ID: ${EXISTING_PROJECT_ID})"
  info "기존 프로젝트에 폼 ${FORM_COUNT}개 추가 중..."

  PROJECT_ID="$EXISTING_PROJECT_ID"
  CREATED_FORMS=0

  # 각 폼을 POST /api/forms 로 개별 생성
  FORMS_JSON=$(echo "$JSON_DATA" | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
    console.log(JSON.stringify(data.forms));
  ")

  FORM_INDEX=0
  while [ "$FORM_INDEX" -lt "$FORM_COUNT" ]; do
    FORM_PAYLOAD=$(echo "$FORMS_JSON" | node -e "
      const forms = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
      const f = forms[${FORM_INDEX}];
      console.log(JSON.stringify({
        name: f.name,
        projectId: '${PROJECT_ID}',
        properties: f.properties || {},
        controls: f.controls || [],
        eventHandlers: f.eventHandlers || [],
        dataBindings: f.dataBindings || [],
      }));
    ")

    FORM_RESULT=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/forms" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$FORM_PAYLOAD")

    FORM_BODY=$(echo "$FORM_RESULT" | sed '$d')
    FORM_STATUS=$(echo "$FORM_RESULT" | tail -1)

    FORM_NAME_I=$(echo "$FORM_PAYLOAD" | node -e "
      const d = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
      process.stdout.write(d.name);
    ")

    if [ "$FORM_STATUS" = "201" ] || [ "$FORM_STATUS" = "200" ]; then
      ok "폼 생성 완료: \"${FORM_NAME_I}\""
      CREATED_FORMS=$((CREATED_FORMS + 1))
    else
      warn "폼 생성 실패: \"${FORM_NAME_I}\" (HTTP ${FORM_STATUS}): $(echo "$FORM_BODY" | head -c 300)"
    fi

    FORM_INDEX=$((FORM_INDEX + 1))
  done

  if [ "$CREATED_FORMS" -eq 0 ]; then
    fail "모든 폼 생성에 실패했습니다."
  fi

  HTTP_BODY="{\"data\":{\"_id\":\"${PROJECT_ID}\",\"name\":\"${PROJECT_NAME}\"}}"
else
  info "기존 프로젝트 없음. 새 프로젝트 생성 중..."

  IMPORT_RESULT=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/projects/import" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$JSON_DATA")

  # HTTP 상태 코드 분리
  HTTP_BODY=$(echo "$IMPORT_RESULT" | sed '$d')
  HTTP_STATUS=$(echo "$IMPORT_RESULT" | tail -1)

  if [ "$HTTP_STATUS" != "201" ] && [ "$HTTP_STATUS" != "200" ]; then
    fail "임포트 실패 (HTTP ${HTTP_STATUS}): $(echo "$HTTP_BODY" | head -c 500)"
  fi

  # 결과에서 프로젝트 ID 추출
  PROJECT_ID=$(echo "$HTTP_BODY" | node -e "
    const data = require('fs').readFileSync('/dev/stdin', 'utf-8');
    try {
      const json = JSON.parse(data);
      if (json.data && json.data._id) {
        process.stdout.write(json.data._id);
      } else {
        process.stderr.write('응답에서 _id를 찾을 수 없습니다: ' + data.substring(0, 300));
        process.exit(1);
      }
    } catch(e) {
      process.stderr.write('JSON 파싱 실패: ' + data.substring(0, 300));
      process.exit(1);
    }
  " 2>&1)

  if [ $? -ne 0 ]; then
    fail "프로젝트 ID 추출 실패: ${PROJECT_ID}"
  fi

  ok "새 프로젝트 생성 완료"
fi

# ─── 결과 출력 ─────────────────────────────────────────────────────────────
echo ""  >&2
echo -e "${GREEN}========================================${NC}" >&2
echo -e "${GREEN}  폼 임포트 완료!${NC}" >&2
echo -e "${GREEN}========================================${NC}" >&2
echo ""  >&2
echo -e "  프로젝트 ID : ${CYAN}${PROJECT_ID}${NC}" >&2
echo -e "  프로젝트명  : ${PROJECT_NAME}" >&2
echo -e "  폼 ${FORM_COUNT}개, 컨트롤 ${TOTAL_CONTROLS}개, 이벤트 핸들러 ${TOTAL_EVENTS}개" >&2
echo ""  >&2
echo -e "  ${YELLOW}[접속]${NC}" >&2
echo -e "    Designer : ${CYAN}http://localhost:3000${NC}" >&2
echo -e "    Runtime  : ${CYAN}http://localhost:3001${NC}" >&2
echo ""  >&2

# stdout으로 결과 JSON 출력 (파이프라인 연동용)
echo "$HTTP_BODY"
