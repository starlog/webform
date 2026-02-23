#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# generate-sample.sh
# "demo" 프로젝트 생성 + MongoDB 샘플 주문 데이터 적재 + 데모 폼 임포트
#
# 사전 조건:
#   - Docker가 실행 중이어야 합니다 (MongoDB 컨테이너)
#   - 서버(localhost:4000)가 실행 중이어야 합니다
#
# 사용법:
#   ./generate-sample.sh
###############################################################################

cd "$(dirname "$0")"

API_URL="http://localhost:4000"
MONGO_CONTAINER="mongodb"
MONGO_PORT=27017
DEMO_DB="demo"
DEMO_COLLECTION="orders"

# ─── 색상 ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# ─── 1. Docker MongoDB 컨테이너 확인/생성 ─────────────────────────────────────
info "MongoDB Docker 컨테이너(${MONGO_CONTAINER}) 확인 중..."
if ! docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
  if docker ps -a --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
    info "MongoDB 컨테이너를 시작합니다..."
    docker start "$MONGO_CONTAINER"
    sleep 2
  else
    fail "MongoDB 컨테이너(${MONGO_CONTAINER})를 찾을 수 없습니다. 먼저 컨테이너를 생성하세요."
  fi
fi
ok "MongoDB 컨테이너 실행 중: localhost:${MONGO_PORT}"

# ─── 2. 샘플 주문 데이터 적재 ──────────────────────────────────────────────────
info "MongoDB '${DEMO_DB}.${DEMO_COLLECTION}' 컬렉션에 샘플 주문 데이터를 적재합니다..."

docker exec -i "$MONGO_CONTAINER" mongosh --quiet --eval "
  use('${DEMO_DB}');
  db.${DEMO_COLLECTION}.drop();

  db.${DEMO_COLLECTION}.insertMany([
    {
      주문번호: 'ORD-2026-0001',
      고객명: '김민수',
      상품명: '노트북 (삼성 갤럭시북4 프로)',
      수량: 1,
      단가: 1890000,
      합계: 1890000,
      상태: '배송완료',
      주문일: new Date('2026-01-05'),
      배송지: '서울특별시 강남구 테헤란로 123'
    },
    {
      주문번호: 'ORD-2026-0002',
      고객명: '이서연',
      상품명: '무선 이어폰 (에어팟 프로 3)',
      수량: 2,
      단가: 359000,
      합계: 718000,
      상태: '배송중',
      주문일: new Date('2026-01-12'),
      배송지: '부산광역시 해운대구 센텀중앙로 45'
    },
    {
      주문번호: 'ORD-2026-0003',
      고객명: '박지훈',
      상품명: '기계식 키보드 (레오폴드 FC660M)',
      수량: 1,
      단가: 145000,
      합계: 145000,
      상태: '배송완료',
      주문일: new Date('2026-01-18'),
      배송지: '대전광역시 유성구 대학로 99'
    },
    {
      주문번호: 'ORD-2026-0004',
      고객명: '최유진',
      상품명: '27인치 모니터 (LG 울트라기어)',
      수량: 1,
      단가: 489000,
      합계: 489000,
      상태: '결제확인',
      주문일: new Date('2026-02-01'),
      배송지: '인천광역시 연수구 송도대로 200'
    },
    {
      주문번호: 'ORD-2026-0005',
      고객명: '정하나',
      상품명: 'USB-C 허브 (앤커 8-in-1)',
      수량: 3,
      단가: 65000,
      합계: 195000,
      상태: '배송완료',
      주문일: new Date('2026-02-05'),
      배송지: '광주광역시 서구 상무중앙로 33'
    },
    {
      주문번호: 'ORD-2026-0006',
      고객명: '강도윤',
      상품명: '태블릿 (아이패드 에어 M3)',
      수량: 1,
      단가: 899000,
      합계: 899000,
      상태: '배송중',
      주문일: new Date('2026-02-08'),
      배송지: '대구광역시 수성구 달구벌대로 567'
    },
    {
      주문번호: 'ORD-2026-0007',
      고객명: '윤서현',
      상품명: '마우스 (로지텍 MX Master 3S)',
      수량: 2,
      단가: 129000,
      합계: 258000,
      상태: '배송완료',
      주문일: new Date('2026-02-10'),
      배송지: '경기도 성남시 분당구 판교로 256'
    },
    {
      주문번호: 'ORD-2026-0008',
      고객명: '임준호',
      상품명: '외장 SSD (삼성 T9 2TB)',
      수량: 1,
      단가: 279000,
      합계: 279000,
      상태: '결제확인',
      주문일: new Date('2026-02-14'),
      배송지: '세종특별자치시 한누리대로 123'
    },
    {
      주문번호: 'ORD-2026-0009',
      고객명: '한소희',
      상품명: '웹캠 (로지텍 Brio 4K)',
      수량: 1,
      단가: 219000,
      합계: 219000,
      상태: '취소',
      주문일: new Date('2026-02-16'),
      배송지: '울산광역시 남구 삼산로 77'
    },
    {
      주문번호: 'ORD-2026-0010',
      고객명: '오지민',
      상품명: '스마트워치 (갤럭시 워치7 울트라)',
      수량: 1,
      단가: 699000,
      합계: 699000,
      상태: '배송완료',
      주문일: new Date('2026-02-20'),
      배송지: '제주특별자치도 제주시 연동 312'
    },
    {
      주문번호: 'ORD-2026-0011',
      고객명: '신예은',
      상품명: '데스크탑 PC (커스텀 조립)',
      수량: 1,
      단가: 2350000,
      합계: 2350000,
      상태: '배송중',
      주문일: new Date('2026-02-21'),
      배송지: '경기도 수원시 영통구 광교로 150'
    },
    {
      주문번호: 'ORD-2026-0012',
      고객명: '김민수',
      상품명: '충전기 (삼성 65W 3포트)',
      수량: 2,
      단가: 49000,
      합계: 98000,
      상태: '배송완료',
      주문일: new Date('2026-02-22'),
      배송지: '서울특별시 강남구 테헤란로 123'
    }
  ]);

  print('주문 데이터 ' + db.${DEMO_COLLECTION}.countDocuments() + '건 적재 완료');
"
ok "샘플 주문 데이터 적재 완료"

# ─── 3. JWT 토큰 생성 ─────────────────────────────────────────────────────────
info "API 인증 토큰 생성 중..."

# .env에서 JWT_SECRET 읽기
JWT_SECRET=$(grep '^JWT_SECRET=' packages/server/.env | cut -d= -f2-)
if [ -z "$JWT_SECRET" ]; then
  fail "packages/server/.env 에서 JWT_SECRET을 찾을 수 없습니다. 먼저 ./run.sh를 실행하세요."
fi

# Node.js로 JWT 토큰 생성
TOKEN=$(node -e "
  const jwt = require('${PWD}/packages/server/node_modules/jsonwebtoken/index.js');
  const token = jwt.sign({ sub: 'demo-admin', role: 'admin' }, '${JWT_SECRET}', { expiresIn: '1h' });
  process.stdout.write(token);
")

if [ -z "$TOKEN" ]; then
  fail "JWT 토큰 생성에 실패했습니다."
fi
ok "JWT 토큰 생성 완료"

# ─── 4. API 서버 상태 확인 ─────────────────────────────────────────────────────
info "API 서버 상태 확인 중..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/forms?limit=1" \
  -H "Authorization: Bearer ${TOKEN}" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "000" ]; then
  fail "API 서버(${API_URL})에 연결할 수 없습니다. 먼저 'pnpm dev' 또는 './run.sh'로 서버를 시작하세요."
fi
ok "API 서버 응답 확인 (HTTP ${HTTP_CODE})"

# ─── 5. 프로젝트 + 폼 임포트 ──────────────────────────────────────────────────
info "'demo' 프로젝트 및 데모 폼을 임포트합니다..."

IMPORT_RESULT=$(curl -s -X POST "${API_URL}/api/projects/import" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d @- <<'ENDJSON'
{
  "project": {
    "name": "데모 프로젝트",
    "description": "WebForm의 모든 컨트롤과 스크립트 기능을 시연하는 데모 프로젝트입니다."
  },
  "forms": [
    {
      "name": "1. 기본 컨트롤 데모",
      "properties": {
        "title": "기본 컨트롤 데모",
        "width": 750,
        "height": 720,
        "backgroundColor": "#F5F5F5",
        "font": { "family": "Pretendard", "size": 10, "bold": false, "italic": false, "underline": false, "strikethrough": false },
        "startPosition": "CenterScreen",
        "formBorderStyle": "Sizable",
        "maximizeBox": true,
        "minimizeBox": true
      },
      "controls": [
        {
          "id": "lblTitle",
          "type": "Label",
          "name": "lblTitle",
          "position": { "x": 20, "y": 10 },
          "size": { "width": 700, "height": 35 },
          "properties": {
            "text": "기본 컨트롤 데모",
            "foreColor": "#1565C0",
            "font": { "family": "Pretendard", "size": 18, "bold": true, "italic": false, "underline": false, "strikethrough": false },
            "textAlign": "MiddleLeft"
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
        },
        {
          "id": "grpInput",
          "type": "GroupBox",
          "name": "grpInput",
          "position": { "x": 20, "y": 55 },
          "size": { "width": 700, "height": 255 },
          "properties": { "text": "입력 컨트롤" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 1, "visible": true, "enabled": true,
          "children": [
            {
              "id": "lblName",
              "type": "Label",
              "name": "lblName",
              "position": { "x": 20, "y": 30 },
              "size": { "width": 80, "height": 23 },
              "properties": { "text": "이름" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
            },
            {
              "id": "txtName",
              "type": "TextBox",
              "name": "txtName",
              "position": { "x": 110, "y": 27 },
              "size": { "width": 220, "height": 26 },
              "properties": { "text": "", "placeholderText": "이름을 입력하세요" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
            },
            {
              "id": "lblEmail",
              "type": "Label",
              "name": "lblEmail",
              "position": { "x": 360, "y": 30 },
              "size": { "width": 80, "height": 23 },
              "properties": { "text": "이메일" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
            },
            {
              "id": "txtEmail",
              "type": "TextBox",
              "name": "txtEmail",
              "position": { "x": 450, "y": 27 },
              "size": { "width": 230, "height": 26 },
              "properties": { "text": "", "placeholderText": "user@example.com" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
            },
            {
              "id": "lblCategory",
              "type": "Label",
              "name": "lblCategory",
              "position": { "x": 20, "y": 68 },
              "size": { "width": 80, "height": 23 },
              "properties": { "text": "분류" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 4, "visible": true, "enabled": true
            },
            {
              "id": "cmbCategory",
              "type": "ComboBox",
              "name": "cmbCategory",
              "position": { "x": 110, "y": 65 },
              "size": { "width": 220, "height": 26 },
              "properties": {
                "items": ["전자제품", "의류/패션", "식품/음료", "도서/문구", "가구/인테리어"],
                "selectedIndex": -1,
                "dropDownStyle": "DropDownList"
              },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 5, "visible": true, "enabled": true
            },
            {
              "id": "lblQuantity",
              "type": "Label",
              "name": "lblQuantity",
              "position": { "x": 360, "y": 68 },
              "size": { "width": 80, "height": 23 },
              "properties": { "text": "수량" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 6, "visible": true, "enabled": true
            },
            {
              "id": "nudQuantity",
              "type": "NumericUpDown",
              "name": "nudQuantity",
              "position": { "x": 450, "y": 65 },
              "size": { "width": 120, "height": 26 },
              "properties": { "value": 1, "minimum": 1, "maximum": 999, "increment": 1 },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 7, "visible": true, "enabled": true
            },
            {
              "id": "lblDate",
              "type": "Label",
              "name": "lblDate",
              "position": { "x": 20, "y": 108 },
              "size": { "width": 80, "height": 23 },
              "properties": { "text": "주문일" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 8, "visible": true, "enabled": true
            },
            {
              "id": "dtpDate",
              "type": "DateTimePicker",
              "name": "dtpDate",
              "position": { "x": 110, "y": 105 },
              "size": { "width": 220, "height": 26 },
              "properties": { "format": "Short" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 9, "visible": true, "enabled": true
            },
            {
              "id": "chkUrgent",
              "type": "CheckBox",
              "name": "chkUrgent",
              "position": { "x": 360, "y": 108 },
              "size": { "width": 130, "height": 23 },
              "properties": { "text": "긴급 배송", "checked": false },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 10, "visible": true, "enabled": true
            },
            {
              "id": "chkGift",
              "type": "CheckBox",
              "name": "chkGift",
              "position": { "x": 500, "y": 108 },
              "size": { "width": 130, "height": 23 },
              "properties": { "text": "선물 포장", "checked": false },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 11, "visible": true, "enabled": true
            },
            {
              "id": "lblPayment",
              "type": "Label",
              "name": "lblPayment",
              "position": { "x": 20, "y": 148 },
              "size": { "width": 80, "height": 23 },
              "properties": { "text": "결제방법" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 12, "visible": true, "enabled": true
            },
            {
              "id": "rdoCard",
              "type": "RadioButton",
              "name": "rdoCard",
              "position": { "x": 110, "y": 148 },
              "size": { "width": 100, "height": 23 },
              "properties": { "text": "카드결제", "checked": true, "groupName": "payment" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 13, "visible": true, "enabled": true
            },
            {
              "id": "rdoBank",
              "type": "RadioButton",
              "name": "rdoBank",
              "position": { "x": 220, "y": 148 },
              "size": { "width": 110, "height": 23 },
              "properties": { "text": "계좌이체", "checked": false, "groupName": "payment" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 14, "visible": true, "enabled": true
            },
            {
              "id": "rdoMobile",
              "type": "RadioButton",
              "name": "rdoMobile",
              "position": { "x": 340, "y": 148 },
              "size": { "width": 120, "height": 23 },
              "properties": { "text": "휴대폰결제", "checked": false, "groupName": "payment" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 15, "visible": true, "enabled": true
            },
            {
              "id": "lblMemo",
              "type": "Label",
              "name": "lblMemo",
              "position": { "x": 20, "y": 188 },
              "size": { "width": 80, "height": 23 },
              "properties": { "text": "배송메모" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 16, "visible": true, "enabled": true
            },
            {
              "id": "lstMemo",
              "type": "ListBox",
              "name": "lstMemo",
              "position": { "x": 110, "y": 185 },
              "size": { "width": 300, "height": 55 },
              "properties": {
                "items": ["문 앞에 놓아주세요", "부재 시 경비실에 맡겨주세요", "배송 전 연락 바랍니다", "직접 수령하겠습니다"],
                "selectedIndex": -1
              },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 17, "visible": true, "enabled": true
            }
          ]
        },
        {
          "id": "btnSubmit",
          "type": "Button",
          "name": "btnSubmit",
          "position": { "x": 20, "y": 320 },
          "size": { "width": 120, "height": 32 },
          "properties": { "text": "주문 접수", "backgroundColor": "#1565C0", "foreColor": "#FFFFFF" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
        },
        {
          "id": "btnClear",
          "type": "Button",
          "name": "btnClear",
          "position": { "x": 150, "y": 320 },
          "size": { "width": 100, "height": 32 },
          "properties": { "text": "초기화" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
        },
        {
          "id": "btnToggle",
          "type": "Button",
          "name": "btnToggle",
          "position": { "x": 260, "y": 320 },
          "size": { "width": 140, "height": 32 },
          "properties": { "text": "메모 표시/숨기기" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 4, "visible": true, "enabled": true
        },
        {
          "id": "prgLoading",
          "type": "ProgressBar",
          "name": "prgLoading",
          "position": { "x": 420, "y": 324 },
          "size": { "width": 300, "height": 22 },
          "properties": { "value": 0, "minimum": 0, "maximum": 100, "style": "Continuous" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 5, "visible": true, "enabled": true
        },
        {
          "id": "lblStatus",
          "type": "Label",
          "name": "lblStatus",
          "position": { "x": 20, "y": 360 },
          "size": { "width": 700, "height": 23 },
          "properties": { "text": "주문 정보를 입력하세요.", "foreColor": "#616161" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 6, "visible": true, "enabled": true
        },
        {
          "id": "grpResult",
          "type": "GroupBox",
          "name": "grpResult",
          "position": { "x": 20, "y": 390 },
          "size": { "width": 700, "height": 290 },
          "properties": { "text": "주문 내역 (DataGridView)" },
          "anchor": { "top": true, "bottom": true, "left": true, "right": true },
          "dock": "None", "tabIndex": 7, "visible": true, "enabled": true,
          "children": [
            {
              "id": "dgvOrders",
              "type": "DataGridView",
              "name": "dgvOrders",
              "position": { "x": 10, "y": 22 },
              "size": { "width": 680, "height": 258 },
              "properties": {
                "columns": [
                  { "headerText": "번호", "field": "no", "width": 60 },
                  { "headerText": "고객명", "field": "name", "width": 100 },
                  { "headerText": "분류", "field": "category", "width": 100 },
                  { "headerText": "수량", "field": "qty", "width": 60 },
                  { "headerText": "결제방법", "field": "payment", "width": 90 },
                  { "headerText": "긴급", "field": "urgent", "width": 60 },
                  { "headerText": "상태", "field": "status", "width": 80 }
                ],
                "rows": [
                  { "no": 1, "name": "김민수", "category": "전자제품", "qty": 1, "payment": "카드결제", "urgent": "", "status": "접수완료" },
                  { "no": 2, "name": "이서연", "category": "의류/패션", "qty": 3, "payment": "계좌이체", "urgent": "✓", "status": "접수완료" },
                  { "no": 3, "name": "박지훈", "category": "식품/음료", "qty": 5, "payment": "휴대폰결제", "urgent": "", "status": "접수완료" }
                ],
                "readOnly": true,
                "alternatingRowColor": "#F5F5F5"
              },
              "anchor": { "top": true, "bottom": true, "left": true, "right": true },
              "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
            }
          ]
        }
      ],
      "eventHandlers": [
        {
          "controlId": "btnSubmit",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "// 입력값 검증\nvar name = ctx.controls.txtName.text;\nvar email = ctx.controls.txtEmail.text;\nvar category = ctx.controls.cmbCategory.selectedIndex;\n\nif (!name) {\n  ctx.controls.lblStatus.text = '이름을 입력하세요.';\n  ctx.controls.lblStatus.foreColor = '#E65100';\n  return;\n}\nif (!email) {\n  ctx.controls.lblStatus.text = '이메일을 입력하세요.';\n  ctx.controls.lblStatus.foreColor = '#E65100';\n  return;\n}\nif (category < 0) {\n  ctx.controls.lblStatus.text = '분류를 선택하세요.';\n  ctx.controls.lblStatus.foreColor = '#E65100';\n  return;\n}\n\n// 프로그레스바 업데이트\nctx.controls.prgLoading.value = 50;\n\n// DataGridView에 행 추가 (새 배열 생성)\nvar oldRows = ctx.controls.dgvOrders.rows || [];\nvar newRows = [];\nfor (var i = 0; i < oldRows.length; i++) { newRows.push(oldRows[i]); }\nvar no = newRows.length + 1;\nvar categories = ['전자제품', '의류/패션', '식품/음료', '도서/문구', '가구/인테리어'];\nvar payment = ctx.getRadioGroupValue('payment');\nvar urgent = ctx.controls.chkUrgent.checked ? '✓' : '';\n\nnewRows.push({\n  no: no,\n  name: name,\n  category: categories[category],\n  qty: ctx.controls.nudQuantity.value,\n  payment: payment,\n  urgent: urgent,\n  status: '접수완료'\n});\nctx.controls.dgvOrders.rows = newRows;\n\n// 완료 상태 표시\nctx.controls.prgLoading.value = 100;\nctx.controls.lblStatus.text = '주문 #' + no + ' 접수 완료! (고객: ' + name + ', 결제: ' + payment + ')';\nctx.controls.lblStatus.foreColor = '#2E7D32';\n\nctx.showMessage('주문이 성공적으로 접수되었습니다.\\n\\n고객명: ' + name + '\\n분류: ' + categories[category] + '\\n수량: ' + ctx.controls.nudQuantity.value + '\\n결제: ' + payment, '주문 접수 완료', 'info');"
        },
        {
          "controlId": "btnClear",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "// 모든 입력 필드 초기화\nctx.controls.txtName.text = '';\nctx.controls.txtEmail.text = '';\nctx.controls.cmbCategory.selectedIndex = -1;\nctx.controls.nudQuantity.value = 1;\nctx.controls.chkUrgent.checked = false;\nctx.controls.chkGift.checked = false;\nctx.controls.rdoCard.checked = true;\nctx.controls.rdoBank.checked = false;\nctx.controls.rdoMobile.checked = false;\nctx.controls.lstMemo.selectedIndex = -1;\nctx.controls.prgLoading.value = 0;\nctx.controls.lblStatus.text = '주문 정보를 입력하세요.';\nctx.controls.lblStatus.foreColor = '#616161';\n\nctx.showMessage('모든 입력값이 초기화되었습니다.', '초기화', 'info');"
        },
        {
          "controlId": "btnToggle",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "// 배송메모 ListBox 표시/숨기기 토글\nvar current = ctx.controls.lstMemo.visible;\nctx.controls.lstMemo.visible = !current;\nctx.controls.lblMemo.visible = !current;\nctx.controls.lblStatus.text = current ? '배송메모 숨김' : '배송메모 표시';\nctx.controls.lblStatus.foreColor = '#616161';"
        },
        {
          "controlId": "cmbCategory",
          "eventName": "SelectedIndexChanged",
          "handlerType": "server",
          "handlerCode": "var idx = ctx.controls.cmbCategory.selectedIndex;\nvar categories = ['전자제품', '의류/패션', '식품/음료', '도서/문구', '가구/인테리어'];\nif (idx >= 0) {\n  ctx.controls.lblStatus.text = '선택된 분류: ' + categories[idx];\n  ctx.controls.lblStatus.foreColor = '#1565C0';\n}"
        },
        {
          "controlId": "txtName",
          "eventName": "TextChanged",
          "handlerType": "server",
          "handlerCode": "var name = ctx.controls.txtName.text;\nif (name.length > 0) {\n  ctx.controls.lblStatus.text = '입력 중: ' + name;\n  ctx.controls.lblStatus.foreColor = '#616161';\n}"
        }
      ],
      "dataBindings": []
    },

    {
      "name": "2. 컨테이너/레이아웃 데모",
      "properties": {
        "title": "컨테이너/레이아웃 데모",
        "width": 800,
        "height": 650,
        "backgroundColor": "#FAFAFA",
        "font": { "family": "Pretendard", "size": 10, "bold": false, "italic": false, "underline": false, "strikethrough": false },
        "startPosition": "CenterScreen",
        "formBorderStyle": "Sizable",
        "maximizeBox": true,
        "minimizeBox": true
      },
      "controls": [
        {
          "id": "lblTitle",
          "type": "Label",
          "name": "lblTitle",
          "position": { "x": 20, "y": 10 },
          "size": { "width": 750, "height": 35 },
          "properties": {
            "text": "컨테이너 & 레이아웃 데모",
            "foreColor": "#6A1B9A",
            "font": { "family": "Pretendard", "size": 18, "bold": true, "italic": false, "underline": false, "strikethrough": false }
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
        },
        {
          "id": "tabMain",
          "type": "TabControl",
          "name": "tabMain",
          "position": { "x": 20, "y": 55 },
          "size": { "width": 750, "height": 540 },
          "properties": {
            "tabs": [
              { "title": "개인정보", "id": "tabPersonal" },
              { "title": "회사정보", "id": "tabCompany" },
              { "title": "기타설정", "id": "tabSettings" }
            ],
            "selectedIndex": 0
          },
          "anchor": { "top": true, "bottom": true, "left": true, "right": true },
          "dock": "None", "tabIndex": 1, "visible": true, "enabled": true,
          "children": [
            {
              "id": "pnlPersonal",
              "type": "Panel",
              "name": "pnlPersonal",
              "position": { "x": 10, "y": 40 },
              "size": { "width": 720, "height": 480 },
              "properties": { "tabId": "tabPersonal", "backgroundColor": "#FFFFFF", "borderStyle": "FixedSingle" },
              "anchor": { "top": true, "bottom": true, "left": true, "right": true },
              "dock": "None", "tabIndex": 0, "visible": true, "enabled": true,
              "children": [
                {
                  "id": "picProfile",
                  "type": "PictureBox",
                  "name": "picProfile",
                  "position": { "x": 20, "y": 20 },
                  "size": { "width": 120, "height": 120 },
                  "properties": { "sizeMode": "Zoom", "backColor": "#E0E0E0", "borderStyle": "FixedSingle" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
                },
                {
                  "id": "lblProfileName",
                  "type": "Label",
                  "name": "lblProfileName",
                  "position": { "x": 160, "y": 20 },
                  "size": { "width": 100, "height": 23 },
                  "properties": { "text": "이름" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
                },
                {
                  "id": "txtProfileName",
                  "type": "TextBox",
                  "name": "txtProfileName",
                  "position": { "x": 260, "y": 17 },
                  "size": { "width": 250, "height": 26 },
                  "properties": { "text": "홍길동", "placeholderText": "이름" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
                },
                {
                  "id": "lblProfilePhone",
                  "type": "Label",
                  "name": "lblProfilePhone",
                  "position": { "x": 160, "y": 55 },
                  "size": { "width": 100, "height": 23 },
                  "properties": { "text": "전화번호" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
                },
                {
                  "id": "txtProfilePhone",
                  "type": "TextBox",
                  "name": "txtProfilePhone",
                  "position": { "x": 260, "y": 52 },
                  "size": { "width": 250, "height": 26 },
                  "properties": { "text": "010-1234-5678", "placeholderText": "010-0000-0000" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 4, "visible": true, "enabled": true
                },
                {
                  "id": "lblProfileBirth",
                  "type": "Label",
                  "name": "lblProfileBirth",
                  "position": { "x": 160, "y": 90 },
                  "size": { "width": 100, "height": 23 },
                  "properties": { "text": "생년월일" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 5, "visible": true, "enabled": true
                },
                {
                  "id": "dtpProfileBirth",
                  "type": "DateTimePicker",
                  "name": "dtpProfileBirth",
                  "position": { "x": 260, "y": 87 },
                  "size": { "width": 200, "height": 26 },
                  "properties": { "format": "Short" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 6, "visible": true, "enabled": true
                },
                {
                  "id": "grpAddress",
                  "type": "GroupBox",
                  "name": "grpAddress",
                  "position": { "x": 20, "y": 160 },
                  "size": { "width": 680, "height": 130 },
                  "properties": { "text": "주소 정보" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": true },
                  "dock": "None", "tabIndex": 7, "visible": true, "enabled": true,
                  "children": [
                    {
                      "id": "lblZip",
                      "type": "Label",
                      "name": "lblZip",
                      "position": { "x": 20, "y": 30 },
                      "size": { "width": 80, "height": 23 },
                      "properties": { "text": "우편번호" },
                      "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                      "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
                    },
                    {
                      "id": "txtZip",
                      "type": "TextBox",
                      "name": "txtZip",
                      "position": { "x": 110, "y": 27 },
                      "size": { "width": 120, "height": 26 },
                      "properties": { "text": "06234", "placeholderText": "우편번호" },
                      "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                      "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
                    },
                    {
                      "id": "lblAddr",
                      "type": "Label",
                      "name": "lblAddr",
                      "position": { "x": 20, "y": 65 },
                      "size": { "width": 80, "height": 23 },
                      "properties": { "text": "주소" },
                      "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                      "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
                    },
                    {
                      "id": "txtAddr",
                      "type": "TextBox",
                      "name": "txtAddr",
                      "position": { "x": 110, "y": 62 },
                      "size": { "width": 450, "height": 26 },
                      "properties": { "text": "서울특별시 강남구 테헤란로 123", "placeholderText": "상세 주소를 입력하세요" },
                      "anchor": { "top": true, "bottom": false, "left": true, "right": true },
                      "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
                    }
                  ]
                },
                {
                  "id": "btnSaveProfile",
                  "type": "Button",
                  "name": "btnSaveProfile",
                  "position": { "x": 20, "y": 310 },
                  "size": { "width": 130, "height": 32 },
                  "properties": { "text": "프로필 저장", "backgroundColor": "#6A1B9A", "foreColor": "#FFFFFF" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 8, "visible": true, "enabled": true
                },
                {
                  "id": "lblProfileStatus",
                  "type": "Label",
                  "name": "lblProfileStatus",
                  "position": { "x": 160, "y": 315 },
                  "size": { "width": 400, "height": 23 },
                  "properties": { "text": "", "foreColor": "#2E7D32" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": true },
                  "dock": "None", "tabIndex": 9, "visible": true, "enabled": true
                }
              ]
            },
            {
              "id": "pnlCompany",
              "type": "Panel",
              "name": "pnlCompany",
              "position": { "x": 10, "y": 40 },
              "size": { "width": 720, "height": 480 },
              "properties": { "tabId": "tabCompany", "backgroundColor": "#FFFFFF", "borderStyle": "FixedSingle" },
              "anchor": { "top": true, "bottom": true, "left": true, "right": true },
              "dock": "None", "tabIndex": 1, "visible": true, "enabled": true,
              "children": [
                {
                  "id": "lblCompanyName",
                  "type": "Label",
                  "name": "lblCompanyName",
                  "position": { "x": 20, "y": 25 },
                  "size": { "width": 100, "height": 23 },
                  "properties": { "text": "회사명" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
                },
                {
                  "id": "txtCompanyName",
                  "type": "TextBox",
                  "name": "txtCompanyName",
                  "position": { "x": 130, "y": 22 },
                  "size": { "width": 300, "height": 26 },
                  "properties": { "text": "", "placeholderText": "(주)회사명" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
                },
                {
                  "id": "lblDept",
                  "type": "Label",
                  "name": "lblDept",
                  "position": { "x": 20, "y": 65 },
                  "size": { "width": 100, "height": 23 },
                  "properties": { "text": "부서" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
                },
                {
                  "id": "cmbDept",
                  "type": "ComboBox",
                  "name": "cmbDept",
                  "position": { "x": 130, "y": 62 },
                  "size": { "width": 200, "height": 26 },
                  "properties": {
                    "items": ["개발팀", "디자인팀", "마케팅팀", "인사팀", "재무팀", "경영지원팀"],
                    "selectedIndex": -1,
                    "dropDownStyle": "DropDownList"
                  },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
                },
                {
                  "id": "lblPosition",
                  "type": "Label",
                  "name": "lblPosition",
                  "position": { "x": 20, "y": 105 },
                  "size": { "width": 100, "height": 23 },
                  "properties": { "text": "직급" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 4, "visible": true, "enabled": true
                },
                {
                  "id": "cmbPosition",
                  "type": "ComboBox",
                  "name": "cmbPosition",
                  "position": { "x": 130, "y": 102 },
                  "size": { "width": 200, "height": 26 },
                  "properties": {
                    "items": ["사원", "대리", "과장", "차장", "부장", "이사", "상무"],
                    "selectedIndex": -1,
                    "dropDownStyle": "DropDownList"
                  },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 5, "visible": true, "enabled": true
                }
              ]
            },
            {
              "id": "pnlSettings",
              "type": "Panel",
              "name": "pnlSettings",
              "position": { "x": 10, "y": 40 },
              "size": { "width": 720, "height": 480 },
              "properties": { "tabId": "tabSettings", "backgroundColor": "#FFFFFF", "borderStyle": "FixedSingle" },
              "anchor": { "top": true, "bottom": true, "left": true, "right": true },
              "dock": "None", "tabIndex": 2, "visible": true, "enabled": true,
              "children": [
                {
                  "id": "chkNotifyEmail",
                  "type": "CheckBox",
                  "name": "chkNotifyEmail",
                  "position": { "x": 20, "y": 20 },
                  "size": { "width": 250, "height": 23 },
                  "properties": { "text": "이메일 알림 수신", "checked": true },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
                },
                {
                  "id": "chkNotifySMS",
                  "type": "CheckBox",
                  "name": "chkNotifySMS",
                  "position": { "x": 20, "y": 50 },
                  "size": { "width": 250, "height": 23 },
                  "properties": { "text": "SMS 알림 수신", "checked": false },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
                },
                {
                  "id": "chkNotifyPush",
                  "type": "CheckBox",
                  "name": "chkNotifyPush",
                  "position": { "x": 20, "y": 80 },
                  "size": { "width": 250, "height": 23 },
                  "properties": { "text": "푸시 알림 수신", "checked": true },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
                },
                {
                  "id": "lblFontSize",
                  "type": "Label",
                  "name": "lblFontSize",
                  "position": { "x": 20, "y": 125 },
                  "size": { "width": 100, "height": 23 },
                  "properties": { "text": "글꼴 크기" },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
                },
                {
                  "id": "nudFontSize",
                  "type": "NumericUpDown",
                  "name": "nudFontSize",
                  "position": { "x": 130, "y": 122 },
                  "size": { "width": 100, "height": 26 },
                  "properties": { "value": 10, "minimum": 8, "maximum": 24, "increment": 1 },
                  "anchor": { "top": true, "bottom": false, "left": true, "right": false },
                  "dock": "None", "tabIndex": 4, "visible": true, "enabled": true
                }
              ]
            }
          ]
        },
        {
          "id": "lblInfo",
          "type": "Label",
          "name": "lblInfo",
          "position": { "x": 20, "y": 605 },
          "size": { "width": 750, "height": 23 },
          "properties": { "text": "TabControl, Panel, GroupBox, PictureBox 등 컨테이너 컨트롤 시연", "foreColor": "#9E9E9E" },
          "anchor": { "top": false, "bottom": true, "left": true, "right": true },
          "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
        }
      ],
      "eventHandlers": [
        {
          "controlId": "btnSaveProfile",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "var name = ctx.controls.txtProfileName.text;\nvar phone = ctx.controls.txtProfilePhone.text;\nvar addr = ctx.controls.txtAddr.text;\n\nif (!name) {\n  ctx.showMessage('이름을 입력해 주세요.', '입력 오류', 'warning');\n  return;\n}\n\nctx.controls.lblProfileStatus.text = '✓ 프로필이 저장되었습니다. (' + name + ', ' + phone + ')';\nctx.controls.lblProfileStatus.foreColor = '#2E7D32';\nctx.showMessage('프로필 정보가 저장되었습니다.\\n\\n이름: ' + name + '\\n전화: ' + phone + '\\n주소: ' + addr, '저장 완료', 'info');"
        }
      ],
      "dataBindings": []
    },

    {
      "name": "3. 데이터 뷰어 데모",
      "properties": {
        "title": "데이터 뷰어 데모",
        "width": 850,
        "height": 650,
        "backgroundColor": "#F5F5F5",
        "font": { "family": "Pretendard", "size": 10, "bold": false, "italic": false, "underline": false, "strikethrough": false },
        "startPosition": "CenterScreen",
        "formBorderStyle": "Sizable",
        "maximizeBox": true,
        "minimizeBox": true
      },
      "controls": [
        {
          "id": "lblTitle",
          "type": "Label",
          "name": "lblTitle",
          "position": { "x": 20, "y": 10 },
          "size": { "width": 800, "height": 35 },
          "properties": {
            "text": "데이터 뷰어 (TreeView + ListView + DataGridView)",
            "foreColor": "#00695C",
            "font": { "family": "Pretendard", "size": 16, "bold": true, "italic": false, "underline": false, "strikethrough": false }
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
        },
        {
          "id": "tvCategory",
          "type": "TreeView",
          "name": "tvCategory",
          "position": { "x": 20, "y": 55 },
          "size": { "width": 220, "height": 350 },
          "properties": {
            "nodes": [
              {
                "text": "전자제품",
                "children": [
                  { "text": "노트북" },
                  { "text": "태블릿" },
                  { "text": "스마트폰" }
                ]
              },
              {
                "text": "주변기기",
                "children": [
                  { "text": "키보드" },
                  { "text": "마우스" },
                  { "text": "모니터" },
                  { "text": "웹캠" }
                ]
              },
              {
                "text": "액세서리",
                "children": [
                  { "text": "이어폰" },
                  { "text": "충전기" },
                  { "text": "케이스" }
                ]
              }
            ],
            "showLines": true,
            "showPlusMinus": true
          },
          "anchor": { "top": true, "bottom": true, "left": true, "right": false },
          "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
        },
        {
          "id": "lvProducts",
          "type": "ListView",
          "name": "lvProducts",
          "position": { "x": 250, "y": 55 },
          "size": { "width": 580, "height": 350 },
          "properties": {
            "view": "Details",
            "columns": [
              { "text": "상품명", "width": 180 },
              { "text": "가격", "width": 100 },
              { "text": "재고", "width": 60 },
              { "text": "평점", "width": 60 },
              { "text": "상태", "width": 80 }
            ],
            "items": [
              { "text": "갤럭시북4 프로", "subItems": ["1,890,000원", "25", "4.7", "판매중"] },
              { "text": "아이패드 에어 M3", "subItems": ["899,000원", "18", "4.8", "판매중"] },
              { "text": "맥북 프로 16", "subItems": ["3,490,000원", "5", "4.9", "품절임박"] },
              { "text": "레오폴드 FC660M", "subItems": ["145,000원", "42", "4.6", "판매중"] },
              { "text": "로지텍 MX Master 3S", "subItems": ["129,000원", "67", "4.7", "판매중"] },
              { "text": "LG 울트라기어 27", "subItems": ["489,000원", "12", "4.5", "판매중"] },
              { "text": "에어팟 프로 3", "subItems": ["359,000원", "0", "4.8", "품절"] },
              { "text": "삼성 T9 2TB", "subItems": ["279,000원", "30", "4.6", "판매중"] }
            ],
            "fullRowSelect": true,
            "gridLines": true
          },
          "anchor": { "top": true, "bottom": true, "left": true, "right": true },
          "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
        },
        {
          "id": "grpSummary",
          "type": "GroupBox",
          "name": "grpSummary",
          "position": { "x": 20, "y": 415 },
          "size": { "width": 810, "height": 190 },
          "properties": { "text": "판매 데이터 (DataGridView)" },
          "anchor": { "top": false, "bottom": true, "left": true, "right": true },
          "dock": "None", "tabIndex": 3, "visible": true, "enabled": true,
          "children": [
            {
              "id": "dgvSales",
              "type": "DataGridView",
              "name": "dgvSales",
              "position": { "x": 10, "y": 25 },
              "size": { "width": 790, "height": 155 },
              "properties": {
                "columns": [
                  { "headerText": "월", "field": "month", "width": 80 },
                  { "headerText": "매출액", "field": "revenue", "width": 120 },
                  { "headerText": "주문수", "field": "orders", "width": 80 },
                  { "headerText": "신규고객", "field": "newCustomers", "width": 90 },
                  { "headerText": "반품률", "field": "returnRate", "width": 80 },
                  { "headerText": "만족도", "field": "satisfaction", "width": 80 }
                ],
                "rows": [
                  { "month": "2026-01", "revenue": "45,230,000원", "orders": 128, "newCustomers": 34, "returnRate": "2.3%", "satisfaction": "4.6" },
                  { "month": "2026-02", "revenue": "52,180,000원", "orders": 156, "newCustomers": 45, "returnRate": "1.8%", "satisfaction": "4.7" }
                ],
                "readOnly": true,
                "alternatingRowColor": "#E8F5E9"
              },
              "anchor": { "top": true, "bottom": true, "left": true, "right": true },
              "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
            }
          ]
        }
      ],
      "eventHandlers": [],
      "dataBindings": []
    },

    {
      "name": "4. 스크립트 고급 데모",
      "properties": {
        "title": "스크립트 고급 데모",
        "width": 700,
        "height": 600,
        "backgroundColor": "#F5F5F5",
        "font": { "family": "Pretendard", "size": 10, "bold": false, "italic": false, "underline": false, "strikethrough": false },
        "startPosition": "CenterScreen",
        "formBorderStyle": "Sizable",
        "maximizeBox": true,
        "minimizeBox": true
      },
      "controls": [
        {
          "id": "lblTitle",
          "type": "Label",
          "name": "lblTitle",
          "position": { "x": 20, "y": 10 },
          "size": { "width": 650, "height": 35 },
          "properties": {
            "text": "스크립트 고급 기능 데모",
            "foreColor": "#BF360C",
            "font": { "family": "Pretendard", "size": 18, "bold": true, "italic": false, "underline": false, "strikethrough": false }
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
        },
        {
          "id": "grpCalc",
          "type": "GroupBox",
          "name": "grpCalc",
          "position": { "x": 20, "y": 55 },
          "size": { "width": 650, "height": 130 },
          "properties": { "text": "계산기 (ctx.controls 속성 읽기/쓰기)" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 1, "visible": true, "enabled": true,
          "children": [
            {
              "id": "lblNum1",
              "type": "Label",
              "name": "lblNum1",
              "position": { "x": 20, "y": 30 },
              "size": { "width": 50, "height": 23 },
              "properties": { "text": "숫자1" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
            },
            {
              "id": "nudNum1",
              "type": "NumericUpDown",
              "name": "nudNum1",
              "position": { "x": 80, "y": 27 },
              "size": { "width": 120, "height": 26 },
              "properties": { "value": 100, "minimum": -99999, "maximum": 99999, "increment": 1 },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
            },
            {
              "id": "cmbOp",
              "type": "ComboBox",
              "name": "cmbOp",
              "position": { "x": 215, "y": 27 },
              "size": { "width": 70, "height": 26 },
              "properties": {
                "items": ["+", "-", "×", "÷"],
                "selectedIndex": 0,
                "dropDownStyle": "DropDownList"
              },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
            },
            {
              "id": "lblNum2",
              "type": "Label",
              "name": "lblNum2",
              "position": { "x": 300, "y": 30 },
              "size": { "width": 50, "height": 23 },
              "properties": { "text": "숫자2" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
            },
            {
              "id": "nudNum2",
              "type": "NumericUpDown",
              "name": "nudNum2",
              "position": { "x": 360, "y": 27 },
              "size": { "width": 120, "height": 26 },
              "properties": { "value": 25, "minimum": -99999, "maximum": 99999, "increment": 1 },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 4, "visible": true, "enabled": true
            },
            {
              "id": "btnCalc",
              "type": "Button",
              "name": "btnCalc",
              "position": { "x": 500, "y": 25 },
              "size": { "width": 60, "height": 30 },
              "properties": { "text": "계산", "backgroundColor": "#BF360C", "foreColor": "#FFFFFF" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 5, "visible": true, "enabled": true
            },
            {
              "id": "lblResult",
              "type": "Label",
              "name": "lblResult",
              "position": { "x": 20, "y": 70 },
              "size": { "width": 610, "height": 40 },
              "properties": {
                "text": "결과: (계산 버튼을 클릭하세요)",
                "foreColor": "#333333",
                "font": { "family": "Pretendard", "size": 14, "bold": true, "italic": false, "underline": false, "strikethrough": false }
              },
              "anchor": { "top": true, "bottom": false, "left": true, "right": true },
              "dock": "None", "tabIndex": 6, "visible": true, "enabled": true
            }
          ]
        },
        {
          "id": "grpHttp",
          "type": "GroupBox",
          "name": "grpHttp",
          "position": { "x": 20, "y": 195 },
          "size": { "width": 650, "height": 130 },
          "properties": { "text": "HTTP 호출 (ctx.http)" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 2, "visible": true, "enabled": true,
          "children": [
            {
              "id": "txtUrl",
              "type": "TextBox",
              "name": "txtUrl",
              "position": { "x": 20, "y": 30 },
              "size": { "width": 480, "height": 26 },
              "properties": { "text": "https://jsonplaceholder.typicode.com/todos/1", "placeholderText": "URL을 입력하세요" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": true },
              "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
            },
            {
              "id": "btnFetch",
              "type": "Button",
              "name": "btnFetch",
              "position": { "x": 510, "y": 28 },
              "size": { "width": 120, "height": 30 },
              "properties": { "text": "GET 요청", "backgroundColor": "#1565C0", "foreColor": "#FFFFFF" },
              "anchor": { "top": true, "bottom": false, "left": false, "right": true },
              "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
            },
            {
              "id": "lblHttpResult",
              "type": "Label",
              "name": "lblHttpResult",
              "position": { "x": 20, "y": 70 },
              "size": { "width": 610, "height": 45 },
              "properties": { "text": "HTTP 응답이 여기에 표시됩니다.", "foreColor": "#616161" },
              "anchor": { "top": true, "bottom": true, "left": true, "right": true },
              "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
            }
          ]
        },
        {
          "id": "grpDialog",
          "type": "GroupBox",
          "name": "grpDialog",
          "position": { "x": 20, "y": 335 },
          "size": { "width": 650, "height": 100 },
          "properties": { "text": "다이얼로그 (ctx.showMessage)" },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 3, "visible": true, "enabled": true,
          "children": [
            {
              "id": "btnInfo",
              "type": "Button",
              "name": "btnInfo",
              "position": { "x": 20, "y": 30 },
              "size": { "width": 130, "height": 32 },
              "properties": { "text": "정보 다이얼로그", "backgroundColor": "#1565C0", "foreColor": "#FFFFFF" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
            },
            {
              "id": "btnWarn",
              "type": "Button",
              "name": "btnWarn",
              "position": { "x": 170, "y": 30 },
              "size": { "width": 130, "height": 32 },
              "properties": { "text": "경고 다이얼로그", "backgroundColor": "#E65100", "foreColor": "#FFFFFF" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
            },
            {
              "id": "btnError",
              "type": "Button",
              "name": "btnError",
              "position": { "x": 320, "y": 30 },
              "size": { "width": 130, "height": 32 },
              "properties": { "text": "에러 다이얼로그", "backgroundColor": "#C62828", "foreColor": "#FFFFFF" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
            }
          ]
        },
        {
          "id": "grpConsole",
          "type": "GroupBox",
          "name": "grpConsole",
          "position": { "x": 20, "y": 445 },
          "size": { "width": 650, "height": 110 },
          "properties": { "text": "콘솔 로그 & 동적 제어 (console.log, enabled/visible)" },
          "anchor": { "top": true, "bottom": true, "left": true, "right": true },
          "dock": "None", "tabIndex": 4, "visible": true, "enabled": true,
          "children": [
            {
              "id": "btnLogTest",
              "type": "Button",
              "name": "btnLogTest",
              "position": { "x": 20, "y": 28 },
              "size": { "width": 150, "height": 30 },
              "properties": { "text": "콘솔 로그 테스트" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
            },
            {
              "id": "btnDisableCalc",
              "type": "Button",
              "name": "btnDisableCalc",
              "position": { "x": 180, "y": 28 },
              "size": { "width": 170, "height": 30 },
              "properties": { "text": "계산기 비활성화 토글" },
              "anchor": { "top": true, "bottom": false, "left": true, "right": false },
              "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
            },
            {
              "id": "lblConsole",
              "type": "Label",
              "name": "lblConsole",
              "position": { "x": 20, "y": 68 },
              "size": { "width": 610, "height": 30 },
              "properties": { "text": "", "foreColor": "#616161" },
              "anchor": { "top": true, "bottom": true, "left": true, "right": true },
              "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
            }
          ]
        }
      ],
      "eventHandlers": [
        {
          "controlId": "btnCalc",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "var n1 = ctx.controls.nudNum1.value;\nvar n2 = ctx.controls.nudNum2.value;\nvar opIdx = ctx.controls.cmbOp.selectedIndex;\nvar ops = ['+', '-', '×', '÷'];\nvar op = ops[opIdx];\nvar result;\n\nif (op === '+') result = n1 + n2;\nelse if (op === '-') result = n1 - n2;\nelse if (op === '×') result = n1 * n2;\nelse if (op === '÷') {\n  if (n2 === 0) {\n    ctx.controls.lblResult.text = '오류: 0으로 나눌 수 없습니다!';\n    ctx.controls.lblResult.foreColor = '#C62828';\n    return;\n  }\n  result = Math.round((n1 / n2) * 100) / 100;\n}\n\nctx.controls.lblResult.text = '결과: ' + n1 + ' ' + op + ' ' + n2 + ' = ' + result;\nctx.controls.lblResult.foreColor = '#1B5E20';\nconsole.log('계산 실행: ' + n1 + ' ' + op + ' ' + n2 + ' = ' + result);"
        },
        {
          "controlId": "btnFetch",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "var url = ctx.controls.txtUrl.text;\nif (!url) {\n  ctx.controls.lblHttpResult.text = 'URL을 입력하세요.';\n  ctx.controls.lblHttpResult.foreColor = '#C62828';\n  return;\n}\n\ntry {\n  var response = ctx.http.get(url);\n  if (response.ok) {\n    var data = response.data;\n    ctx.controls.lblHttpResult.text = '✓ HTTP ' + response.status + ' | 응답: ' + JSON.stringify(data).substring(0, 200);\n    ctx.controls.lblHttpResult.foreColor = '#2E7D32';\n  } else {\n    ctx.controls.lblHttpResult.text = '✗ HTTP ' + response.status + ' 요청 실패';\n    ctx.controls.lblHttpResult.foreColor = '#C62828';\n  }\n} catch(e) {\n  ctx.controls.lblHttpResult.text = '✗ 오류: ' + e.message;\n  ctx.controls.lblHttpResult.foreColor = '#C62828';\n}"
        },
        {
          "controlId": "btnInfo",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "ctx.showMessage('WebForm 데모 프로젝트입니다.\\n\\nServer-Driven UI 기반으로\\n서버에서 이벤트 핸들러를 실행합니다.', '정보', 'info');"
        },
        {
          "controlId": "btnWarn",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "ctx.showMessage('이 작업은 되돌릴 수 없습니다.\\n계속하시겠습니까?', '경고', 'warning');"
        },
        {
          "controlId": "btnError",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "ctx.showMessage('데이터베이스 연결에 실패했습니다.\\n관리자에게 문의하세요.\\n\\n오류코드: ERR_DB_CONN_001', '오류', 'error');"
        },
        {
          "controlId": "btnLogTest",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "console.log('일반 로그 메시지');\nconsole.info('정보 메시지: 현재 시각 확인');\nconsole.warn('경고 메시지: 메모리 사용량 80% 초과');\nconsole.error('에러 메시지: 네트워크 타임아웃');\n\nvar controls = Object.keys(ctx.controls);\nconsole.log('현재 폼 컨트롤 수: ' + controls.length);\nconsole.log('컨트롤 목록: ' + controls.join(', '));\n\nctx.controls.lblConsole.text = '콘솔에 6개 로그가 출력되었습니다. (디버거에서 확인)';\nctx.controls.lblConsole.foreColor = '#1565C0';"
        },
        {
          "controlId": "btnDisableCalc",
          "eventName": "Click",
          "handlerType": "server",
          "handlerCode": "var current = ctx.controls.nudNum1.enabled;\nctx.controls.nudNum1.enabled = !current;\nctx.controls.nudNum2.enabled = !current;\nctx.controls.cmbOp.enabled = !current;\nctx.controls.btnCalc.enabled = !current;\n\nif (current) {\n  ctx.controls.lblConsole.text = '계산기가 비활성화되었습니다.';\n  ctx.controls.lblConsole.foreColor = '#C62828';\n} else {\n  ctx.controls.lblConsole.text = '계산기가 다시 활성화되었습니다.';\n  ctx.controls.lblConsole.foreColor = '#2E7D32';\n}"
        }
      ],
      "dataBindings": []
    },

    {
      "name": "5. MongoDB 주문 관리",
      "properties": {
        "title": "MongoDB 주문 관리",
        "width": 900,
        "height": 650,
        "backgroundColor": "#F5F5F5",
        "font": { "family": "Pretendard", "size": 10, "bold": false, "italic": false, "underline": false, "strikethrough": false },
        "startPosition": "CenterScreen",
        "formBorderStyle": "Sizable",
        "maximizeBox": true,
        "minimizeBox": true
      },
      "controls": [
        {
          "id": "lblTitle",
          "type": "Label",
          "name": "lblTitle",
          "position": { "x": 20, "y": 10 },
          "size": { "width": 850, "height": 35 },
          "properties": {
            "text": "MongoDB 주문 관리 (MongoDBView 컨트롤)",
            "foreColor": "#2E7D32",
            "font": { "family": "Pretendard", "size": 18, "bold": true, "italic": false, "underline": false, "strikethrough": false }
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
        },
        {
          "id": "lblDesc",
          "type": "Label",
          "name": "lblDesc",
          "position": { "x": 20, "y": 45 },
          "size": { "width": 850, "height": 20 },
          "properties": {
            "text": "로컬 MongoDB의 demo.orders 컬렉션에 연결하여 주문 데이터를 조회/편집합니다.",
            "foreColor": "#757575"
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
        },
        {
          "id": "mongoOrders",
          "type": "MongoDBView",
          "name": "mongoOrders",
          "position": { "x": 20, "y": 75 },
          "size": { "width": 860, "height": 520 },
          "properties": {
            "title": "주문 목록",
            "connectionString": "mongodb://localhost:27017",
            "database": "demo",
            "collection": "orders",
            "columns": [
              { "field": "주문번호", "header": "주문번호", "width": 140 },
              { "field": "고객명", "header": "고객명", "width": 80 },
              { "field": "상품명", "header": "상품명", "width": 200 },
              { "field": "수량", "header": "수량", "width": 50, "type": "number" },
              { "field": "단가", "header": "단가", "width": 100, "type": "number" },
              { "field": "합계", "header": "합계", "width": 100, "type": "number" },
              { "field": "상태", "header": "상태", "width": 80 },
              { "field": "배송지", "header": "배송지", "width": 200 }
            ],
            "pageSize": 50,
            "readOnly": false,
            "showToolbar": true
          },
          "anchor": { "top": true, "bottom": true, "left": true, "right": true },
          "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
        },
        {
          "id": "lblMongoStatus",
          "type": "Label",
          "name": "lblMongoStatus",
          "position": { "x": 20, "y": 605 },
          "size": { "width": 860, "height": 23 },
          "properties": {
            "text": "MongoDBView: mongodb://localhost:27017 → demo.orders",
            "foreColor": "#9E9E9E"
          },
          "anchor": { "top": false, "bottom": true, "left": true, "right": true },
          "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
        }
      ],
      "eventHandlers": [],
      "dataBindings": []
    },

    {
      "name": "6. 그래프/차트 데모",
      "properties": {
        "title": "다양한 그래프 데모",
        "width": 900,
        "height": 700,
        "backgroundColor": "#F5F5F5",
        "font": { "family": "Pretendard", "size": 10, "bold": false, "italic": false, "underline": false, "strikethrough": false },
        "startPosition": "CenterScreen",
        "formBorderStyle": "Sizable",
        "maximizeBox": true,
        "minimizeBox": true
      },
      "controls": [
        {
          "id": "lblTitle",
          "type": "Label",
          "name": "lblTitle",
          "position": { "x": 20, "y": 10 },
          "size": { "width": 860, "height": 35 },
          "properties": {
            "text": "다양한 그래프 데모 (GraphView)",
            "foreColor": "#AD1457",
            "font": { "family": "Pretendard", "size": 18, "bold": true, "italic": false, "underline": false, "strikethrough": false }
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
        },
        {
          "id": "gvBarChart",
          "type": "GraphView",
          "name": "gvBarChart",
          "position": { "x": 20, "y": 55 },
          "size": { "width": 420, "height": 300 },
          "properties": {
            "graphType": "Bar",
            "title": "분기별 매출/이익",
            "xAxisTitle": "분기",
            "yAxisTitle": "금액 (백만원)",
            "showLegend": true,
            "showGrid": true,
            "colors": "#1565C0,#43A047",
            "data": [
              { "x": "1분기", "매출": 4520, "이익": 1350 },
              { "x": "2분기", "매출": 5180, "이익": 1620 },
              { "x": "3분기", "매출": 4890, "이익": 1480 },
              { "x": "4분기", "매출": 6230, "이익": 2010 }
            ]
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
        },
        {
          "id": "gvLineChart",
          "type": "GraphView",
          "name": "gvLineChart",
          "position": { "x": 460, "y": 55 },
          "size": { "width": 420, "height": 300 },
          "properties": {
            "graphType": "Line",
            "title": "월별 웹사이트 트래픽 추이",
            "xAxisTitle": "월",
            "yAxisTitle": "방문자 수 (천명)",
            "showLegend": true,
            "showGrid": true,
            "colors": "#E65100,#6A1B9A,#00695C",
            "data": [
              { "x": "1월", "PC": 120, "모바일": 230, "태블릿": 45 },
              { "x": "2월", "PC": 135, "모바일": 250, "태블릿": 48 },
              { "x": "3월", "PC": 148, "모바일": 285, "태블릿": 52 },
              { "x": "4월", "PC": 142, "모바일": 310, "태블릿": 55 },
              { "x": "5월", "PC": 155, "모바일": 340, "태블릿": 60 },
              { "x": "6월", "PC": 168, "모바일": 375, "태블릿": 58 }
            ]
          },
          "anchor": { "top": true, "bottom": false, "left": false, "right": true },
          "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
        },
        {
          "id": "gvPieChart",
          "type": "GraphView",
          "name": "gvPieChart",
          "position": { "x": 20, "y": 365 },
          "size": { "width": 420, "height": 300 },
          "properties": {
            "graphType": "Donut",
            "title": "브라우저 점유율",
            "showLegend": true,
            "showGrid": false,
            "colors": "#1565C0,#E65100,#F9A825,#43A047,#6A1B9A",
            "data": [
              { "name": "Chrome", "value": 64 },
              { "name": "Safari", "value": 19 },
              { "name": "Edge", "value": 5 },
              { "name": "Firefox", "value": 3 },
              { "name": "기타", "value": 9 }
            ]
          },
          "anchor": { "top": false, "bottom": true, "left": true, "right": false },
          "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
        },
        {
          "id": "gvRadarChart",
          "type": "GraphView",
          "name": "gvRadarChart",
          "position": { "x": 460, "y": 365 },
          "size": { "width": 420, "height": 300 },
          "properties": {
            "graphType": "Radar",
            "title": "팀 역량 비교",
            "showLegend": true,
            "showGrid": true,
            "colors": "#1565C0,#E65100",
            "data": [
              { "subject": "기획력", "프론트엔드팀": 90, "백엔드팀": 75 },
              { "subject": "개발속도", "프론트엔드팀": 85, "백엔드팀": 92 },
              { "subject": "코드품질", "프론트엔드팀": 78, "백엔드팀": 88 },
              { "subject": "커뮤니케이션", "프론트엔드팀": 92, "백엔드팀": 70 },
              { "subject": "문서화", "프론트엔드팀": 65, "백엔드팀": 82 },
              { "subject": "테스트", "프론트엔드팀": 72, "백엔드팀": 95 }
            ]
          },
          "anchor": { "top": false, "bottom": true, "left": false, "right": true },
          "dock": "None", "tabIndex": 4, "visible": true, "enabled": true
        }
      ],
      "eventHandlers": [],
      "dataBindings": []
    },

    {
      "name": "7. JSON 편집기 데모",
      "properties": {
        "title": "JSON 편집기 데모",
        "width": 800,
        "height": 650,
        "backgroundColor": "#F5F5F5",
        "font": { "family": "Pretendard", "size": 10, "bold": false, "italic": false, "underline": false, "strikethrough": false },
        "startPosition": "CenterScreen",
        "formBorderStyle": "Sizable",
        "maximizeBox": true,
        "minimizeBox": true
      },
      "controls": [
        {
          "id": "lblTitle",
          "type": "Label",
          "name": "lblTitle",
          "position": { "x": 20, "y": 10 },
          "size": { "width": 760, "height": 35 },
          "properties": {
            "text": "JSON 편집기 데모 (JsonEditor)",
            "foreColor": "#00695C",
            "font": { "family": "Pretendard", "size": 18, "bold": true, "italic": false, "underline": false, "strikethrough": false }
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
        },
        {
          "id": "lblEditableHeader",
          "type": "Label",
          "name": "lblEditableHeader",
          "position": { "x": 20, "y": 50 },
          "size": { "width": 370, "height": 23 },
          "properties": {
            "text": "서버 설정 (편집 가능)",
            "foreColor": "#1565C0",
            "font": { "family": "Pretendard", "size": 12, "bold": true, "italic": false, "underline": false, "strikethrough": false }
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
        },
        {
          "id": "jsonConfig",
          "type": "JsonEditor",
          "name": "jsonConfig",
          "position": { "x": 20, "y": 78 },
          "size": { "width": 370, "height": 480 },
          "properties": {
            "readOnly": false,
            "expandDepth": 2,
            "value": {
              "server": {
                "host": "0.0.0.0",
                "port": 4000,
                "cors": {
                  "enabled": true,
                  "origins": ["http://localhost:3000", "http://localhost:3001"]
                }
              },
              "database": {
                "type": "mongodb",
                "host": "localhost",
                "port": 27017,
                "name": "webform",
                "options": {
                  "maxPoolSize": 10,
                  "retryWrites": true
                }
              },
              "auth": {
                "jwtSecret": "my-secret-key",
                "tokenExpiry": "24h",
                "refreshEnabled": true
              },
              "logging": {
                "level": "info",
                "format": "json",
                "file": "/var/log/webform.log"
              }
            }
          },
          "anchor": { "top": true, "bottom": true, "left": true, "right": false },
          "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
        },
        {
          "id": "lblReadOnlyHeader",
          "type": "Label",
          "name": "lblReadOnlyHeader",
          "position": { "x": 410, "y": 50 },
          "size": { "width": 370, "height": 23 },
          "properties": {
            "text": "API 응답 (읽기 전용)",
            "foreColor": "#E65100",
            "font": { "family": "Pretendard", "size": 12, "bold": true, "italic": false, "underline": false, "strikethrough": false }
          },
          "anchor": { "top": true, "bottom": false, "left": false, "right": true },
          "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
        },
        {
          "id": "jsonApiResponse",
          "type": "JsonEditor",
          "name": "jsonApiResponse",
          "position": { "x": 410, "y": 78 },
          "size": { "width": 370, "height": 480 },
          "properties": {
            "readOnly": true,
            "expandDepth": 1,
            "value": {
              "status": 200,
              "message": "요청이 성공적으로 처리되었습니다.",
              "data": {
                "users": [
                  { "id": 1, "name": "김민수", "email": "minsu@example.com", "role": "admin" },
                  { "id": 2, "name": "이서연", "email": "seoyeon@example.com", "role": "editor" },
                  { "id": 3, "name": "박지훈", "email": "jihun@example.com", "role": "viewer" }
                ],
                "pagination": {
                  "page": 1,
                  "perPage": 20,
                  "total": 3,
                  "totalPages": 1
                }
              },
              "meta": {
                "requestId": "req-2026-0223-abc",
                "responseTime": "42ms",
                "apiVersion": "v2"
              }
            }
          },
          "anchor": { "top": true, "bottom": true, "left": false, "right": true },
          "dock": "None", "tabIndex": 4, "visible": true, "enabled": true
        },
        {
          "id": "lblJsonInfo",
          "type": "Label",
          "name": "lblJsonInfo",
          "position": { "x": 20, "y": 570 },
          "size": { "width": 760, "height": 40 },
          "properties": {
            "text": "좌측은 편집 가능한 JsonEditor (expandDepth=2), 우측은 읽기 전용 JsonEditor (expandDepth=1)입니다. 값을 클릭하여 직접 편집해 보세요.",
            "foreColor": "#9E9E9E"
          },
          "anchor": { "top": false, "bottom": true, "left": true, "right": true },
          "dock": "None", "tabIndex": 5, "visible": true, "enabled": true
        }
      ],
      "eventHandlers": [],
      "dataBindings": []
    },

    {
      "name": "8. 스프레드시트 데모",
      "properties": {
        "title": "스프레드시트 데모",
        "width": 900,
        "height": 650,
        "backgroundColor": "#F5F5F5",
        "font": { "family": "Pretendard", "size": 10, "bold": false, "italic": false, "underline": false, "strikethrough": false },
        "startPosition": "CenterScreen",
        "formBorderStyle": "Sizable",
        "maximizeBox": true,
        "minimizeBox": true
      },
      "controls": [
        {
          "id": "lblTitle",
          "type": "Label",
          "name": "lblTitle",
          "position": { "x": 20, "y": 10 },
          "size": { "width": 860, "height": 35 },
          "properties": {
            "text": "스프레드시트 데모 (SpreadsheetView)",
            "foreColor": "#4527A0",
            "font": { "family": "Pretendard", "size": 18, "bold": true, "italic": false, "underline": false, "strikethrough": false }
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 0, "visible": true, "enabled": true
        },
        {
          "id": "lblEditableHeader",
          "type": "Label",
          "name": "lblEditableHeader",
          "position": { "x": 20, "y": 48 },
          "size": { "width": 400, "height": 23 },
          "properties": {
            "text": "직원 정보 (편집 가능, 행 추가/삭제 가능)",
            "foreColor": "#1565C0",
            "font": { "family": "Pretendard", "size": 11, "bold": true, "italic": false, "underline": false, "strikethrough": false }
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 1, "visible": true, "enabled": true
        },
        {
          "id": "ssEmployees",
          "type": "SpreadsheetView",
          "name": "ssEmployees",
          "position": { "x": 20, "y": 75 },
          "size": { "width": 860, "height": 240 },
          "properties": {
            "readOnly": false,
            "showToolbar": true,
            "showFormulaBar": true,
            "showRowNumbers": true,
            "allowAddRows": true,
            "allowDeleteRows": true,
            "allowSort": true,
            "columns": [
              { "field": "name", "headerText": "이름", "width": 100 },
              { "field": "dept", "headerText": "부서", "width": 100 },
              { "field": "position", "headerText": "직급", "width": 80 },
              { "field": "salary", "headerText": "급여(만원)", "width": 100 },
              { "field": "joinDate", "headerText": "입사일", "width": 110 },
              { "field": "email", "headerText": "이메일", "width": 180 },
              { "field": "phone", "headerText": "연락처", "width": 140 }
            ],
            "data": [
              { "name": "김민수", "dept": "개발팀", "position": "과장", "salary": 5800, "joinDate": "2019-03-02", "email": "minsu@company.com", "phone": "010-1234-5678" },
              { "name": "이서연", "dept": "디자인팀", "position": "대리", "salary": 4200, "joinDate": "2021-07-15", "email": "seoyeon@company.com", "phone": "010-2345-6789" },
              { "name": "박지훈", "dept": "개발팀", "position": "부장", "salary": 7200, "joinDate": "2015-01-10", "email": "jihun@company.com", "phone": "010-3456-7890" },
              { "name": "최유진", "dept": "마케팅팀", "position": "사원", "salary": 3500, "joinDate": "2024-02-20", "email": "yujin@company.com", "phone": "010-4567-8901" },
              { "name": "정하나", "dept": "인사팀", "position": "차장", "salary": 6500, "joinDate": "2017-09-01", "email": "hana@company.com", "phone": "010-5678-9012" },
              { "name": "강도윤", "dept": "개발팀", "position": "대리", "salary": 4500, "joinDate": "2022-04-11", "email": "doyun@company.com", "phone": "010-6789-0123" }
            ]
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": true },
          "dock": "None", "tabIndex": 2, "visible": true, "enabled": true
        },
        {
          "id": "lblReadOnlyHeader",
          "type": "Label",
          "name": "lblReadOnlyHeader",
          "position": { "x": 20, "y": 325 },
          "size": { "width": 400, "height": 23 },
          "properties": {
            "text": "2026년 월별 재무 요약 (읽기 전용)",
            "foreColor": "#E65100",
            "font": { "family": "Pretendard", "size": 11, "bold": true, "italic": false, "underline": false, "strikethrough": false }
          },
          "anchor": { "top": true, "bottom": false, "left": true, "right": false },
          "dock": "None", "tabIndex": 3, "visible": true, "enabled": true
        },
        {
          "id": "ssFinancial",
          "type": "SpreadsheetView",
          "name": "ssFinancial",
          "position": { "x": 20, "y": 352 },
          "size": { "width": 860, "height": 230 },
          "properties": {
            "readOnly": true,
            "showToolbar": false,
            "showFormulaBar": false,
            "showRowNumbers": true,
            "allowAddRows": false,
            "allowDeleteRows": false,
            "allowSort": true,
            "columns": [
              { "field": "month", "headerText": "월", "width": 70 },
              { "field": "revenue", "headerText": "매출(백만)", "width": 110 },
              { "field": "cost", "headerText": "원가(백만)", "width": 110 },
              { "field": "profit", "headerText": "이익(백만)", "width": 110 },
              { "field": "margin", "headerText": "이익률", "width": 80 },
              { "field": "orders", "headerText": "주문수", "width": 80 },
              { "field": "customers", "headerText": "고객수", "width": 80 },
              { "field": "avgOrder", "headerText": "객단가(만)", "width": 100 }
            ],
            "data": [
              { "month": "1월", "revenue": 452, "cost": 317, "profit": 135, "margin": "29.9%", "orders": 1280, "customers": 845, "avgOrder": 35.3 },
              { "month": "2월", "revenue": 518, "cost": 356, "profit": 162, "margin": "31.3%", "orders": 1560, "customers": 1020, "avgOrder": 33.2 },
              { "month": "3월", "revenue": 489, "cost": 341, "profit": 148, "margin": "30.3%", "orders": 1420, "customers": 930, "avgOrder": 34.4 },
              { "month": "4월", "revenue": 534, "cost": 364, "profit": 170, "margin": "31.8%", "orders": 1650, "customers": 1100, "avgOrder": 32.4 },
              { "month": "5월", "revenue": 578, "cost": 387, "profit": 191, "margin": "33.0%", "orders": 1780, "customers": 1180, "avgOrder": 32.5 },
              { "month": "6월", "revenue": 623, "cost": 412, "profit": 211, "margin": "33.9%", "orders": 1920, "customers": 1260, "avgOrder": 32.4 }
            ]
          },
          "anchor": { "top": true, "bottom": true, "left": true, "right": true },
          "dock": "None", "tabIndex": 4, "visible": true, "enabled": true
        },
        {
          "id": "lblSpreadsheetInfo",
          "type": "Label",
          "name": "lblSpreadsheetInfo",
          "position": { "x": 20, "y": 592 },
          "size": { "width": 860, "height": 35 },
          "properties": {
            "text": "상단 시트는 편집/행 추가/삭제가 가능하고, 하단 시트는 읽기 전용입니다. 셀을 더블클릭하거나 F2를 눌러 편집하세요.",
            "foreColor": "#9E9E9E"
          },
          "anchor": { "top": false, "bottom": true, "left": true, "right": true },
          "dock": "None", "tabIndex": 5, "visible": true, "enabled": true
        }
      ],
      "eventHandlers": [],
      "dataBindings": []
    }
  ]
}
ENDJSON
)

# 결과 확인
PROJECT_ID=$(echo "$IMPORT_RESULT" | node -e "
  const data = require('fs').readFileSync('/dev/stdin', 'utf-8');
  try {
    const json = JSON.parse(data);
    if (json.data && json.data._id) {
      process.stdout.write(json.data._id);
    } else {
      process.stderr.write('응답: ' + data.substring(0, 300));
      process.exit(1);
    }
  } catch(e) {
    process.stderr.write('JSON 파싱 실패: ' + data.substring(0, 300));
    process.exit(1);
  }
" 2>&1)

if [ $? -ne 0 ]; then
  fail "프로젝트 임포트 실패: ${PROJECT_ID}"
fi

ok "프로젝트 임포트 완료 (ID: ${PROJECT_ID})"

# ─── 6. 폼 목록 조회 ──────────────────────────────────────────────────────────
info "생성된 폼 목록을 조회합니다..."

FORMS_RESULT=$(curl -s "${API_URL}/api/forms?projectId=${PROJECT_ID}&limit=10" \
  -H "Authorization: Bearer ${TOKEN}")

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  데모 프로젝트 생성 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  프로젝트 ID : ${CYAN}${PROJECT_ID}${NC}"
echo -e "  프로젝트명  : 데모 프로젝트"
echo ""
echo -e "  ${YELLOW}[생성된 폼]${NC}"
echo -e "    1. 기본 컨트롤 데모     - Label, TextBox, ComboBox, NumericUpDown,"
echo -e "                              DateTimePicker, CheckBox, RadioButton,"
echo -e "                              ListBox, Button, ProgressBar, DataGridView"
echo -e "    2. 컨테이너/레이아웃 데모 - TabControl, Panel, GroupBox, PictureBox"
echo -e "    3. 데이터 뷰어 데모      - TreeView, ListView, DataGridView"
echo -e "    4. 스크립트 고급 데모    - 계산기, HTTP 호출, 다이얼로그, 콘솔 로그"
echo -e "    5. MongoDB 주문 관리    - MongoDBView (demo.orders 컬렉션)"
echo -e "    6. 그래프/차트 데모      - GraphView (Bar, Line, Donut, Radar)"
echo -e "    7. JSON 편집기 데모     - JsonEditor (편집/읽기 전용)"
echo -e "    8. 스프레드시트 데모     - SpreadsheetView (편집/읽기 전용)"
echo ""
echo -e "  ${YELLOW}[MongoDB 샘플 데이터]${NC}"
echo -e "    데이터베이스 : demo"
echo -e "    컬렉션       : orders (12건의 주문 데이터)"
echo ""
echo -e "  ${YELLOW}[접속 방법]${NC}"
echo -e "    Designer : ${CYAN}http://localhost:3000${NC}"
echo -e "    Runtime  : ${CYAN}http://localhost:3001${NC}"
echo ""
echo -e "  ${YELLOW}[스크립트 기능 시연 항목]${NC}"
echo -e "    - ctx.controls 읽기/쓰기 (속성 변경)"
echo -e "    - ctx.showMessage() (다이얼로그 표시)"
echo -e "    - ctx.http.get() (HTTP 외부 호출)"
echo -e "    - ctx.getRadioGroupValue() (라디오 그룹)"
echo -e "    - console.log/info/warn/error (디버그 로그)"
echo -e "    - enabled/visible 동적 토글"
echo -e "    - DataGridView 동적 행 추가"
echo -e "${GREEN}========================================${NC}"
echo ""
