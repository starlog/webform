#!/usr/bin/env bash
# generate-themes.sh — 프리셋 테마를 API를 통해 MongoDB에 시딩합니다.
#
# 사전 조건:
#   - 서버(localhost:4000)가 실행 중이어야 합니다
#
# 사용법:
#   ./generate-themes.sh
###############################################################################
set -euo pipefail
cd "$(dirname "$0")"

# ─── .env 로드 (현재 디렉토리 우선, packages/server/.env 폴백) ──────────────
load_env_var() {
  local var_name="$1"
  local val=""
  if [ -f .env ]; then
    val=$(grep "^${var_name}=" .env 2>/dev/null | head -1 | cut -d= -f2-)
  fi
  if [ -z "$val" ] && [ -f packages/server/.env ]; then
    val=$(grep "^${var_name}=" packages/server/.env 2>/dev/null | head -1 | cut -d= -f2-)
  fi
  echo "$val"
}

# PORT에서 API_URL 결정
_PORT=$(load_env_var "PORT")
API_URL="http://localhost:${_PORT:-4000}"

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

# ─── 1. JWT 토큰 생성 ─────────────────────────────────────────────────────────
JWT_SECRET=$(load_env_var "JWT_SECRET")
if [ -z "$JWT_SECRET" ]; then
  fail ".env 또는 packages/server/.env 에서 JWT_SECRET을 찾을 수 없습니다. 먼저 ./run.sh를 실행하세요."
fi

TOKEN=$(node -e "
  const jwt = require('${PWD}/packages/server/node_modules/jsonwebtoken/index.js');
  const token = jwt.sign({ sub: 'theme-seeder', role: 'admin' }, '${JWT_SECRET}', { expiresIn: '1h' });
  process.stdout.write(token);
")

if [ -z "$TOKEN" ]; then
  fail "JWT 토큰 생성에 실패했습니다."
fi
ok "JWT 토큰 생성 완료"

# ─── 2. API 서버 상태 확인 ─────────────────────────────────────────────────────
info "API 서버 상태 확인 중..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/themes?limit=1" \
  -H "Authorization: Bearer ${TOKEN}" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "000" ]; then
  fail "API 서버(${API_URL})에 연결할 수 없습니다. 먼저 'pnpm dev' 또는 './run.sh'로 서버를 시작하세요."
fi
ok "API 서버 응답 확인 (HTTP ${HTTP_CODE})"

# ─── 3. 테마 JSON 생성 (임시 파일) ─────────────────────────────────────────────
info "프리셋 테마 JSON을 생성합니다..."
TMP_FILE=$(mktemp /tmp/preset-themes-XXXXXX.json)
trap 'rm -f "$TMP_FILE"' EXIT

node --input-type=module <<NODESCRIPT
import { writeFileSync } from 'fs';

// ─────────────────────────────────────────────────────────────────────────────
// 팔레트 정의 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 표준 라이트 테마를 팔레트에서 생성합니다.
 * 대부분의 테마가 이 패턴을 따릅니다.
 */
function light(p) {
  const r = p.r ?? '0';
  const wr = p.wr ?? r;
  const tr = p.tr ?? (wr === '0' ? '0' : \`\${wr} \${wr} 0 0\`);
  const tabR = p.tabR ?? (r === '0' ? '0' : \`\${r} \${r} 0 0\`);
  const pad = p.pad ?? '3px 10px';
  const ipad = p.ipad ?? '3px 5px';
  const bp = p.bp ?? 'right';
  const sw = p.sw ?? 14;
  const th = p.th ?? 30;
  const fs = p.fs ?? '12px';
  const font = p.font ?? 'Segoe UI, sans-serif';
  const titleFont = p.titleFont ?? \`\${fs} \${font}\`;
  const pf = p.pf ?? '#FFFFFF';
  const ib = p.ib ?? '#FFFFFF';

  return {
    id: p.id, name: p.name,
    window: {
      titleBar: {
        background: p.titleBg,
        foreground: p.titleFg ?? '#FFFFFF',
        height: th,
        font: titleFont,
        borderRadius: tr,
        controlButtonsPosition: bp,
      },
      border: p.wb ?? \`1px solid \${p.b}\`,
      borderRadius: wr,
      shadow: p.ws ?? '0 2px 8px rgba(0,0,0,0.2)',
    },
    form: {
      backgroundColor: p.bg,
      foreground: p.fg,
      fontFamily: font,
      fontSize: fs,
    },
    controls: {
      button: {
        background: p.btnBg ?? p.cb,
        border: p.btnBd ?? \`1px solid \${p.b}\`,
        borderRadius: p.btnR ?? r,
        foreground: p.btnFg ?? p.fg,
        hoverBackground: p.hb,
        padding: pad,
      },
      textInput: {
        background: ib,
        border: p.iBd ?? \`1px solid \${p.b}\`,
        borderRadius: r,
        foreground: p.fg,
        focusBorder: p.fb ?? \`1px solid \${p.primary}\`,
        padding: ipad,
      },
      select: {
        background: ib,
        border: p.iBd ?? \`1px solid \${p.b}\`,
        borderRadius: r,
        foreground: p.fg,
        selectedBackground: p.primary,
        selectedForeground: pf,
      },
      checkRadio: {
        border: p.chBd ?? \`1px solid \${p.b}\`,
        background: p.chBg ?? ib,
        checkedBackground: p.primary,
        borderRadius: p.chR ?? r,
      },
      panel: {
        background: p.panelBg ?? 'transparent',
        border: p.panelBd ?? \`1px solid \${p.lb ?? p.b}\`,
        borderRadius: p.pnR ?? r,
      },
      groupBox: {
        border: p.gbBd ?? \`1px solid \${p.lb ?? p.b}\`,
        borderRadius: p.gbR ?? r,
        foreground: p.gf ?? p.fg,
      },
      tabControl: {
        tabBackground: p.cb,
        tabActiveBackground: p.tabABg ?? ib,
        tabBorder: \`1px solid \${p.b}\`,
        tabBorderRadius: tabR,
        tabForeground: p.tf ?? p.fg,
        tabActiveForeground: p.taf ?? p.fg,
        contentBackground: p.tabCBg ?? ib,
        contentBorder: \`1px solid \${p.b}\`,
      },
      dataGrid: {
        headerBackground: p.gridHBg ?? p.cb,
        headerForeground: p.gridHFg ?? p.fg,
        headerBorder: \`1px solid \${p.b}\`,
        rowBackground: p.gridRowBg ?? ib,
        rowAlternateBackground: p.ab,
        rowForeground: p.fg,
        border: \`1px solid \${p.b}\`,
        borderRadius: p.gridR ?? r,
        selectedRowBackground: p.gridSelBg ?? p.primary,
        selectedRowForeground: p.gridSelFg ?? pf,
      },
      progressBar: {
        background: p.progBg ?? p.cb,
        fillBackground: p.progFill ?? p.primary,
        border: p.progBd ?? \`1px solid \${p.b}\`,
        borderRadius: p.progR ?? r,
      },
      menuStrip: {
        background: p.mBg ?? p.cb,
        foreground: p.mFg ?? p.fg,
        border: p.mBd ?? \`1px solid \${p.lb ?? p.b}\`,
        hoverBackground: p.mHb ?? p.hb,
        hoverForeground: p.mHf ?? p.fg,
        activeBackground: p.mAb ?? p.primary,
      },
      toolStrip: {
        background: p.tsBg ?? p.cb,
        foreground: p.tsFg ?? p.fg,
        border: p.tsBd ?? \`1px solid \${p.lb ?? p.b}\`,
        buttonHoverBackground: p.tsHb ?? p.hb,
        separator: p.tsSep ?? p.b,
      },
      statusStrip: {
        background: p.ssBg ?? p.cb,
        foreground: p.sf ?? p.fg,
        border: p.ssBd ?? \`1px solid \${p.lb ?? p.b}\`,
      },
      scrollbar: {
        trackBackground: p.scTr ?? p.bg,
        thumbBackground: p.scTh ?? p.b,
        thumbHoverBackground: p.scThH,
        width: sw,
      },
    },
    accent: {
      primary: p.primary,
      primaryHover: p.primaryH,
      primaryForeground: pf,
    },
    popup: {
      background: p.popBg ?? ib,
      border: \`1px solid \${p.popBd ?? p.b}\`,
      shadow: p.popSh ?? '0 2px 8px rgba(0,0,0,0.15)',
      borderRadius: p.popR ?? r,
      hoverBackground: p.popHb ?? p.hb,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 24개 프리셋 테마 팔레트 정의
// ─────────────────────────────────────────────────────────────────────────────

const themes = [

  // ── Windows XP ────────────────────────────────────────────────────────────
  light({
    id: 'windows-xp', name: 'Windows XP',
    font: 'Segoe UI, Tahoma, sans-serif', fs: '12px', th: 30, sw: 17,
    titleFont: '12px Segoe UI, sans-serif',
    titleBg: 'linear-gradient(to right, #0078D7, #005A9E)',
    bg: '#F0F0F0', fg: '#000000',
    primary: '#0078D7', primaryH: '#005A9E',
    cb: '#F0F0F0', hb: '#D0D0D0', ab: '#F5F5F5',
    b: '#A0A0A0', lb: '#D0D0D0',
    wb: '1px solid #333333',
    ws: '0 2px 10px rgba(0,0,0,0.2)',
    btnBg: '#E1E1E1', btnBd: '1px outset #D0D0D0',
    iBd: '1px inset #A0A0A0', fb: '1px inset #0078D7',
    chBd: '1px solid #999999',
    pad: '2px 8px', ipad: '2px 4px',
    gridHBg: '#E8E8E8',
    progBg: '#E0E0E0', progFill: '#06B025',
    mHb: '#D0E8FF', mHf: '#000000', mAb: '#CCE4FF',
    tsHb: '#D0E8FF', tsSep: '#C0C0C0',
    sf: '#444444',
    scTr: '#F0F0F0', scTh: '#C0C0C0', scThH: '#A0A0A0',
    popBg: '#FFFFFF', popBd: '#999999',
    popSh: '2px 2px 6px rgba(0,0,0,0.2)', popHb: '#D0E8FF',
  }),

  // ── Ubuntu 20.04 ─────────────────────────────────────────────────────────
  light({
    id: 'ubuntu-2004', name: 'Ubuntu 20.04',
    font: 'Ubuntu, "Noto Sans", sans-serif', fs: '13px', th: 36, r: '5px', sw: 8,
    titleFont: '13px Ubuntu, "Noto Sans", sans-serif',
    titleBg: '#3C3C3C',
    wb: '1px solid #2C2C2C', wr: '10px',
    ws: '0 4px 16px rgba(0,0,0,0.3)',
    bg: '#F6F5F4', fg: '#3D3846',
    primary: '#E95420', primaryH: '#C7431A',
    cb: '#E8E7E5', hb: '#F0EFED', ab: '#F8F7F6',
    b: '#CDCDC9',
    btnBg: '#FFFFFF', btnR: '5px',
    chR: '3px', pnR: '8px', gbR: '8px',
    tabR: '8px 8px 0 0', gridR: '8px',
    progR: '5px',
    pad: '4px 16px', ipad: '4px 8px',
    tf: '#77767B', sf: '#77767B',
    mBg: '#3C3C3C', mFg: '#FFFFFF', mBd: 'none',
    mHb: '#505050', mHf: '#FFFFFF',
    tsHb: '#E8E7E5',
    scTr: 'transparent', scTh: '#C0BFBC', scThH: '#9A9996',
    popSh: '0 4px 12px rgba(0,0,0,0.15)',
    popR: '8px',
  }),

  // ── macOS Tahoe (특수: controlButtonsPosition = 'left', rgba 보더) ─────
  {
    id: 'macos-tahoe', name: 'macOS Tahoe',
    window: {
      titleBar: {
        background: 'linear-gradient(to bottom, #ECECEC, #E0E0E0)',
        foreground: '#333333',
        height: 28,
        font: '13px -apple-system, BlinkMacSystemFont, "SF Pro", "Helvetica Neue", sans-serif',
        borderRadius: '10px 10px 0 0',
        controlButtonsPosition: 'left',
      },
      border: '1px solid rgba(0,0,0,0.12)',
      borderRadius: '10px',
      shadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
    },
    form: {
      backgroundColor: '#FFFFFF',
      foreground: '#1D1D1F',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro", "Helvetica Neue", sans-serif',
      fontSize: '13px',
    },
    controls: {
      button: {
        background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: '6px', foreground: '#1D1D1F',
        hoverBackground: '#F5F5F7', padding: '3px 12px',
      },
      textInput: {
        background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: '6px', foreground: '#1D1D1F',
        focusBorder: '2px solid #007AFF', padding: '3px 8px',
      },
      select: {
        background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: '6px', foreground: '#1D1D1F',
        selectedBackground: '#007AFF', selectedForeground: '#FFFFFF',
      },
      checkRadio: {
        border: '1px solid rgba(0,0,0,0.2)', background: '#FFFFFF',
        checkedBackground: '#007AFF', borderRadius: '4px',
      },
      panel: {
        background: 'transparent', border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '8px',
      },
      groupBox: {
        border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px',
        foreground: '#1D1D1F',
      },
      tabControl: {
        tabBackground: '#F5F5F7', tabActiveBackground: '#FFFFFF',
        tabBorder: '1px solid rgba(0,0,0,0.1)', tabBorderRadius: '6px 6px 0 0',
        tabForeground: '#86868B', tabActiveForeground: '#1D1D1F',
        contentBackground: '#FFFFFF', contentBorder: '1px solid rgba(0,0,0,0.1)',
      },
      dataGrid: {
        headerBackground: '#F5F5F7', headerForeground: '#86868B',
        headerBorder: '1px solid rgba(0,0,0,0.08)',
        rowBackground: '#FFFFFF', rowAlternateBackground: '#FAFAFA',
        rowForeground: '#1D1D1F',
        border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px',
        selectedRowBackground: '#007AFF', selectedRowForeground: '#FFFFFF',
      },
      progressBar: {
        background: '#E5E5EA', fillBackground: '#007AFF',
        border: 'none', borderRadius: '4px',
      },
      menuStrip: {
        background: 'rgba(246,246,246,0.8)', foreground: '#1D1D1F',
        border: '1px solid rgba(0,0,0,0.06)',
        hoverBackground: 'rgba(0,122,255,0.1)', hoverForeground: '#1D1D1F',
        activeBackground: '#007AFF',
      },
      toolStrip: {
        background: '#F5F5F7', foreground: '#1D1D1F',
        border: '1px solid rgba(0,0,0,0.08)',
        buttonHoverBackground: 'rgba(0,0,0,0.05)', separator: 'rgba(0,0,0,0.1)',
      },
      statusStrip: {
        background: '#F5F5F7', foreground: '#86868B',
        border: '1px solid rgba(0,0,0,0.06)',
      },
      scrollbar: {
        trackBackground: 'transparent',
        thumbBackground: 'rgba(0,0,0,0.2)', thumbHoverBackground: 'rgba(0,0,0,0.4)',
        width: 8,
      },
    },
    accent: { primary: '#007AFF', primaryHover: '#005ECB', primaryForeground: '#FFFFFF' },
    popup: {
      background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.1)',
      shadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      borderRadius: '10px', hoverBackground: '#F5F5F7',
    },
  },

  // ── Vibrant Neon (다크 테마) ──────────────────────────────────────────────
  {
    id: 'vibrant-neon', name: 'Vibrant Neon',
    window: {
      titleBar: {
        background: 'linear-gradient(to right, #7C3AED, #DB2777)',
        foreground: '#FFFFFF', height: 34,
        font: '13px "Inter", "Segoe UI", sans-serif',
        borderRadius: '12px 12px 0 0', controlButtonsPosition: 'right',
      },
      border: '1px solid rgba(139, 92, 246, 0.3)',
      borderRadius: '12px',
      shadow: '0 8px 32px rgba(124, 58, 237, 0.25), 0 0 16px rgba(219, 39, 119, 0.15)',
    },
    form: { backgroundColor: '#1A1B2E', foreground: '#E8E8F0', fontFamily: '"Inter", "Segoe UI", sans-serif', fontSize: '13px' },
    controls: {
      button: { background: 'linear-gradient(135deg, #7C3AED, #9333EA)', border: '1px solid rgba(139, 92, 246, 0.4)', borderRadius: '8px', foreground: '#FFFFFF', hoverBackground: 'linear-gradient(135deg, #8B5CF6, #A855F7)', padding: '4px 16px' },
      textInput: { background: '#252640', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', foreground: '#E8E8F0', focusBorder: '2px solid #A855F7', padding: '4px 8px' },
      select: { background: '#252640', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', foreground: '#E8E8F0', selectedBackground: '#7C3AED', selectedForeground: '#FFFFFF' },
      checkRadio: { border: '1px solid rgba(139, 92, 246, 0.4)', background: '#252640', checkedBackground: '#A855F7', borderRadius: '4px' },
      panel: { background: 'rgba(37, 38, 64, 0.6)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '10px' },
      groupBox: { border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '10px', foreground: '#C4B5FD' },
      tabControl: { tabBackground: '#1E1F33', tabActiveBackground: '#2D2E4A', tabBorder: '1px solid rgba(139, 92, 246, 0.2)', tabBorderRadius: '8px 8px 0 0', tabForeground: '#8B8BA3', tabActiveForeground: '#C4B5FD', contentBackground: '#2D2E4A', contentBorder: '1px solid rgba(139, 92, 246, 0.2)' },
      dataGrid: { headerBackground: '#252640', headerForeground: '#C4B5FD', headerBorder: '1px solid rgba(139, 92, 246, 0.2)', rowBackground: '#1E1F33', rowAlternateBackground: '#232442', rowForeground: '#E8E8F0', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '10px', selectedRowBackground: '#7C3AED', selectedRowForeground: '#FFFFFF' },
      progressBar: { background: '#252640', fillBackground: 'linear-gradient(to right, #7C3AED, #EC4899)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '6px' },
      menuStrip: { background: '#16172B', foreground: '#E8E8F0', border: '1px solid rgba(139, 92, 246, 0.15)', hoverBackground: 'rgba(124, 58, 237, 0.2)', hoverForeground: '#FFFFFF', activeBackground: '#7C3AED' },
      toolStrip: { background: '#1E1F33', foreground: '#C4B5FD', border: '1px solid rgba(139, 92, 246, 0.15)', buttonHoverBackground: 'rgba(124, 58, 237, 0.2)', separator: 'rgba(139, 92, 246, 0.2)' },
      statusStrip: { background: '#16172B', foreground: '#8B8BA3', border: '1px solid rgba(139, 92, 246, 0.15)' },
      scrollbar: { trackBackground: 'transparent', thumbBackground: 'rgba(139, 92, 246, 0.3)', thumbHoverBackground: 'rgba(139, 92, 246, 0.5)', width: 8 },
    },
    accent: { primary: '#A855F7', primaryHover: '#7C3AED', primaryForeground: '#FFFFFF' },
    popup: { background: '#252640', border: '1px solid rgba(139, 92, 246, 0.3)', shadow: '0 8px 24px rgba(124, 58, 237, 0.2), 0 0 12px rgba(168, 85, 247, 0.1)', borderRadius: '10px', hoverBackground: 'rgba(124, 58, 237, 0.15)' },
  },

  // ── Arctic Frost ──────────────────────────────────────────────────────────
  light({
    id: 'arctic-frost', name: 'Arctic Frost',
    font: '"Segoe UI", sans-serif', fs: '13px', th: 32, r: '6px', sw: 8,
    titleFont: '13px "Segoe UI", sans-serif',
    titleBg: 'linear-gradient(to right, #B3E5FC, #E1F5FE)',
    titleFg: '#01579B',
    wr: '8px', wb: '1px solid #B3E5FC',
    ws: '0 4px 16px rgba(1, 87, 155, 0.1)',
    bg: '#F8FDFF', fg: '#1A3A4A',
    primary: '#4FC3F7', primaryH: '#039BE5',
    cb: '#E1F5FE', hb: '#B3E5FC', ab: '#F0FAFF',
    b: '#B3E5FC', lb: '#B3E5FC',
    btnBg: '#E1F5FE', btnBd: '1px solid #81D4FA', btnFg: '#01579B',
    fb: '2px solid #4FC3F7', chBd: '1px solid #81D4FA', chR: '4px',
    pnR: '8px', gbR: '8px',
    tabR: '6px 6px 0 0', gridR: '8px',
    progR: '4px',
    pad: '4px 12px', ipad: '4px 8px',
    gf: '#01579B', tf: '#4889A0', taf: '#01579B', sf: '#4889A0',
    gridHFg: '#01579B',
    mFg: '#01579B', tsFg: '#01579B',
    tsHb: '#B3E5FC', tsSep: '#81D4FA',
    scTr: '#F0FAFF', scTh: '#81D4FA', scThH: '#4FC3F7',
    popSh: '0 4px 12px rgba(1, 87, 155, 0.1)', popR: '8px',
  }),

  // ── Autumn Harvest ────────────────────────────────────────────────────────
  light({
    id: 'autumn-harvest', name: 'Autumn Harvest',
    font: '"Segoe UI", Georgia, sans-serif', fs: '13px', th: 32, r: '4px', sw: 10,
    titleFont: '13px "Segoe UI", Georgia, sans-serif',
    titleBg: 'linear-gradient(to right, #BF360C, #E65100)',
    wb: '1px solid #BF360C', wr: '6px',
    ws: '0 4px 16px rgba(191, 54, 12, 0.2)',
    bg: '#FFF8F0', fg: '#3E2723',
    primary: '#E65100', primaryH: '#BF360C',
    cb: '#FFF3E0', hb: '#FFE0B2', ab: '#FFF8F0',
    b: '#FFCC80', lb: '#FFCC80',
    btnBg: '#FFECB3', btnBd: '1px solid #FFB74D',
    chR: '3px', pnR: '6px', gbR: '6px',
    tabR: '6px 6px 0 0', gridR: '6px', progR: '4px', popR: '6px',
    pad: '4px 12px', ipad: '4px 8px',
    fb: '2px solid #E65100',
    gf: '#BF360C', tf: '#8D6E63', sf: '#8D6E63',
    progFill: 'linear-gradient(to right, #E65100, #FF8F00)',
    scTr: '#FFF8F0', scTh: '#FFCC80', scThH: '#FFB74D',
    popSh: '0 4px 12px rgba(191, 54, 12, 0.15)',
  }),

  // ── Cherry Blossom ────────────────────────────────────────────────────────
  light({
    id: 'cherry-blossom', name: 'Cherry Blossom',
    font: '"Segoe UI", sans-serif', fs: '13px', th: 32, r: '8px', sw: 8,
    titleFont: '13px "Segoe UI", sans-serif',
    titleBg: 'linear-gradient(to right, #F48FB1, #F8BBD0)',
    titleFg: '#880E4F',
    wb: '1px solid #F48FB1', wr: '10px',
    ws: '0 4px 16px rgba(236, 64, 122, 0.15)',
    bg: '#FFF0F5', fg: '#4A0E2A',
    primary: '#EC407A', primaryH: '#C2185B',
    cb: '#FCE4EC', hb: '#F8BBD0', ab: '#FFF0F5',
    b: '#F8BBD0', lb: '#F8BBD0',
    btnBg: '#FCE4EC', btnBd: '1px solid #F48FB1', btnFg: '#880E4F',
    fb: '2px solid #EC407A', chBd: '1px solid #F48FB1', chR: '4px',
    pnR: '10px', gbR: '10px',
    tabR: '8px 8px 0 0', gridR: '10px', progR: '6px', popR: '10px',
    pad: '4px 12px', ipad: '4px 8px',
    gf: '#880E4F', tf: '#C2185B', taf: '#880E4F', sf: '#C2185B',
    gridHFg: '#880E4F',
    mFg: '#880E4F', tsFg: '#880E4F',
    progFill: 'linear-gradient(to right, #EC407A, #F48FB1)',
    scTr: '#FFF0F5', scTh: '#F48FB1', scThH: '#EC407A',
    popSh: '0 4px 12px rgba(236, 64, 122, 0.12)',
  }),

  // ── Dark Monokai (다크 테마) ──────────────────────────────────────────────
  {
    id: 'dark-monokai', name: 'Dark Monokai',
    window: {
      titleBar: { background: '#1E1F1C', foreground: '#F8F8F2', height: 32, font: '13px "Consolas", "Courier New", monospace', borderRadius: '4px 4px 0 0', controlButtonsPosition: 'right' },
      border: '1px solid #3E3D32', borderRadius: '4px', shadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
    },
    form: { backgroundColor: '#272822', foreground: '#F8F8F2', fontFamily: '"Consolas", "Courier New", monospace', fontSize: '13px' },
    controls: {
      button: { background: '#3E3D32', border: '1px solid #49483E', borderRadius: '3px', foreground: '#F8F8F2', hoverBackground: '#49483E', padding: '4px 12px' },
      textInput: { background: '#1E1F1C', border: '1px solid #49483E', borderRadius: '3px', foreground: '#F8F8F2', focusBorder: '2px solid #A6E22E', padding: '4px 8px' },
      select: { background: '#1E1F1C', border: '1px solid #49483E', borderRadius: '3px', foreground: '#F8F8F2', selectedBackground: '#49483E', selectedForeground: '#A6E22E' },
      checkRadio: { border: '1px solid #49483E', background: '#1E1F1C', checkedBackground: '#A6E22E', borderRadius: '2px' },
      panel: { background: 'rgba(30, 31, 28, 0.6)', border: '1px solid #3E3D32', borderRadius: '4px' },
      groupBox: { border: '1px solid #3E3D32', borderRadius: '4px', foreground: '#E6DB74' },
      tabControl: { tabBackground: '#1E1F1C', tabActiveBackground: '#272822', tabBorder: '1px solid #3E3D32', tabBorderRadius: '4px 4px 0 0', tabForeground: '#75715E', tabActiveForeground: '#F8F8F2', contentBackground: '#272822', contentBorder: '1px solid #3E3D32' },
      dataGrid: { headerBackground: '#3E3D32', headerForeground: '#E6DB74', headerBorder: '1px solid #49483E', rowBackground: '#272822', rowAlternateBackground: '#2D2E27', rowForeground: '#F8F8F2', border: '1px solid #3E3D32', borderRadius: '4px', selectedRowBackground: '#49483E', selectedRowForeground: '#A6E22E' },
      progressBar: { background: '#3E3D32', fillBackground: '#A6E22E', border: '1px solid #49483E', borderRadius: '2px' },
      menuStrip: { background: '#1E1F1C', foreground: '#F8F8F2', border: '1px solid #3E3D32', hoverBackground: '#3E3D32', hoverForeground: '#F8F8F2', activeBackground: '#49483E' },
      toolStrip: { background: '#1E1F1C', foreground: '#F8F8F2', border: '1px solid #3E3D32', buttonHoverBackground: '#3E3D32', separator: '#49483E' },
      statusStrip: { background: '#1E1F1C', foreground: '#75715E', border: '1px solid #3E3D32' },
      scrollbar: { trackBackground: '#272822', thumbBackground: '#49483E', thumbHoverBackground: '#75715E', width: 10 },
    },
    accent: { primary: '#A6E22E', primaryHover: '#8CC219', primaryForeground: '#272822' },
    popup: { background: '#272822', border: '1px solid #49483E', shadow: '0 4px 12px rgba(0, 0, 0, 0.4)', borderRadius: '4px', hoverBackground: '#3E3D32' },
  },

  // ── Forest Green ──────────────────────────────────────────────────────────
  light({
    id: 'forest-green', name: 'Forest Green',
    font: '"Segoe UI", sans-serif', fs: '13px', th: 32, r: '5px', sw: 10,
    titleFont: '13px "Segoe UI", sans-serif',
    titleBg: 'linear-gradient(to right, #1B5E20, #2E7D32)',
    wb: '1px solid #1B5E20', wr: '6px',
    ws: '0 4px 16px rgba(27, 94, 32, 0.2)',
    bg: '#F1F8E9', fg: '#1B3A1B',
    primary: '#2E7D32', primaryH: '#1B5E20',
    cb: '#DCEDC8', hb: '#C5E1A5', ab: '#F1F8E9',
    b: '#C5E1A5', lb: '#C5E1A5',
    btnBd: '1px solid #A5D6A7', btnFg: '#1B5E20',
    chBd: '1px solid #A5D6A7', chR: '3px',
    pnR: '6px', gbR: '6px',
    tabR: '6px 6px 0 0', gridR: '6px', progR: '4px', popR: '6px',
    pad: '4px 12px', ipad: '4px 8px',
    fb: '2px solid #2E7D32', iBd: '1px solid #A5D6A7',
    gf: '#1B5E20', tf: '#558B2F', sf: '#558B2F',
    gridHFg: '#1B5E20', mFg: '#1B5E20', tsFg: '#1B5E20',
    tsSep: '#A5D6A7',
    scTr: '#F1F8E9', scTh: '#A5D6A7', scThH: '#66BB6A',
    popSh: '0 4px 12px rgba(27, 94, 32, 0.12)',
  }),

  // ── Material Blue ─────────────────────────────────────────────────────────
  light({
    id: 'material-blue', name: 'Material Blue',
    font: '"Roboto", "Segoe UI", sans-serif', fs: '14px', th: 34, r: '4px', sw: 8,
    titleFont: '14px "Roboto", "Segoe UI", sans-serif',
    titleBg: '#1976D2',
    wb: '1px solid #1565C0',
    ws: '0 2px 4px rgba(0,0,0,0.14), 0 4px 8px rgba(0,0,0,0.12)',
    bg: '#FAFAFA', fg: '#212121',
    primary: '#1976D2', primaryH: '#1565C0',
    cb: '#FAFAFA', hb: '#F5F5F5', ab: '#FAFAFA',
    b: '#E0E0E0', lb: '#E0E0E0',
    btnBg: '#1976D2', btnBd: 'none', btnFg: '#FFFFFF',
    iBd: '1px solid #BDBDBD', fb: '2px solid #1976D2',
    chBd: '2px solid #757575', chR: '2px',
    pad: '6px 16px', ipad: '6px 12px',
    tf: '#757575', sf: '#757575',
    gridHBg: '#F5F5F5', gridHFg: '#757575',
    gridSelBg: '#BBDEFB', gridSelFg: '#212121',
    progBg: '#E3F2FD', progFill: '#1976D2', progBd: 'none', progR: '2px',
    mBg: '#1976D2', mFg: '#FFFFFF', mBd: 'none',
    mHb: 'rgba(255,255,255,0.1)', mHf: '#FFFFFF', mAb: '#1565C0',
    tsHb: '#F5F5F5', tsSep: '#E0E0E0',
    ssBg: '#FAFAFA', ssBd: '1px solid #E0E0E0',
    scTr: 'transparent', scTh: '#BDBDBD', scThH: '#9E9E9E',
    popBg: '#FFFFFF', popSh: '0 8px 16px rgba(0,0,0,0.14), 0 2px 4px rgba(0,0,0,0.12)',
    // panel special
    panelBg: '#FFFFFF', panelBd: 'none',
  }),

  // ── Ocean Breeze ──────────────────────────────────────────────────────────
  light({
    id: 'ocean-breeze', name: 'Ocean Breeze',
    font: '"Segoe UI", sans-serif', fs: '13px', th: 32, r: '6px', sw: 8,
    titleFont: '13px "Segoe UI", sans-serif',
    titleBg: 'linear-gradient(to right, #00695C, #00897B)',
    wb: '1px solid #00695C', wr: '8px',
    ws: '0 4px 16px rgba(0, 105, 92, 0.2)',
    bg: '#E0F2F1', fg: '#1A3C38',
    primary: '#00897B', primaryH: '#00695C',
    cb: '#B2DFDB', hb: '#80CBC4', ab: '#E0F2F1',
    b: '#80CBC4', lb: '#B2DFDB',
    btnBd: '1px solid #80CBC4', btnFg: '#00695C',
    fb: '2px solid #00897B', chR: '4px',
    pnR: '8px', gbR: '8px',
    tabR: '6px 6px 0 0', gridR: '8px', progR: '4px', popR: '8px',
    pad: '4px 12px', ipad: '4px 8px',
    gf: '#00695C', tf: '#4DB6AC', taf: '#00695C', sf: '#4DB6AC',
    gridHFg: '#00695C', mFg: '#00695C', tsFg: '#00695C',
    tsSep: '#4DB6AC',
    scTr: '#E0F2F1', scTh: '#80CBC4', scThH: '#4DB6AC',
    popSh: '0 4px 12px rgba(0, 105, 92, 0.12)',
  }),

  // ── Retro Terminal (다크 테마) ────────────────────────────────────────────
  {
    id: 'retro-terminal', name: 'Retro Terminal',
    window: {
      titleBar: { background: '#0A0A0A', foreground: '#00FF41', height: 28, font: '13px "Courier New", "Consolas", monospace', borderRadius: '0', controlButtonsPosition: 'right' },
      border: '1px solid #00FF41', borderRadius: '0', shadow: '0 0 20px rgba(0, 255, 65, 0.15)',
    },
    form: { backgroundColor: '#0D0D0D', foreground: '#00FF41', fontFamily: '"Courier New", "Consolas", monospace', fontSize: '13px' },
    controls: {
      button: { background: '#0A0A0A', border: '1px solid #00FF41', borderRadius: '0', foreground: '#00FF41', hoverBackground: '#1A3A1A', padding: '4px 12px' },
      textInput: { background: '#0A0A0A', border: '1px solid #00CC33', borderRadius: '0', foreground: '#00FF41', focusBorder: '1px solid #00FF41', padding: '4px 8px' },
      select: { background: '#0A0A0A', border: '1px solid #00CC33', borderRadius: '0', foreground: '#00FF41', selectedBackground: '#00CC33', selectedForeground: '#0D0D0D' },
      checkRadio: { border: '1px solid #00CC33', background: '#0A0A0A', checkedBackground: '#00FF41', borderRadius: '0' },
      panel: { background: 'transparent', border: '1px solid #00CC33', borderRadius: '0' },
      groupBox: { border: '1px solid #00CC33', borderRadius: '0', foreground: '#00FF41' },
      tabControl: { tabBackground: '#0A0A0A', tabActiveBackground: '#1A2A1A', tabBorder: '1px solid #00CC33', tabBorderRadius: '0', tabForeground: '#00882A', tabActiveForeground: '#00FF41', contentBackground: '#0D0D0D', contentBorder: '1px solid #00CC33' },
      dataGrid: { headerBackground: '#0A0A0A', headerForeground: '#00FF41', headerBorder: '1px solid #00CC33', rowBackground: '#0D0D0D', rowAlternateBackground: '#111111', rowForeground: '#00FF41', border: '1px solid #00CC33', borderRadius: '0', selectedRowBackground: '#00CC33', selectedRowForeground: '#0D0D0D' },
      progressBar: { background: '#0A0A0A', fillBackground: '#00FF41', border: '1px solid #00CC33', borderRadius: '0' },
      menuStrip: { background: '#0A0A0A', foreground: '#00FF41', border: '1px solid #00CC33', hoverBackground: '#1A3A1A', hoverForeground: '#00FF41', activeBackground: '#00CC33' },
      toolStrip: { background: '#0A0A0A', foreground: '#00FF41', border: '1px solid #00CC33', buttonHoverBackground: '#1A3A1A', separator: '#00882A' },
      statusStrip: { background: '#0A0A0A', foreground: '#00882A', border: '1px solid #00CC33' },
      scrollbar: { trackBackground: '#0D0D0D', thumbBackground: '#00882A', thumbHoverBackground: '#00CC33', width: 10 },
    },
    accent: { primary: '#00FF41', primaryHover: '#00CC33', primaryForeground: '#0D0D0D' },
    popup: { background: '#0D0D0D', border: '1px solid #00FF41', shadow: '0 0 12px rgba(0, 255, 65, 0.2)', borderRadius: '0', hoverBackground: '#1A3A1A' },
  },

  // ── Solarized Light ───────────────────────────────────────────────────────
  light({
    id: 'solarized-light', name: 'Solarized Light',
    font: '"Consolas", "DejaVu Sans Mono", monospace', fs: '13px', th: 30, r: '3px', sw: 10,
    titleFont: '13px "Consolas", "DejaVu Sans Mono", monospace',
    titleBg: '#EEE8D5', titleFg: '#586E75',
    wb: '1px solid #93A1A1', wr: '4px',
    ws: '0 2px 10px rgba(0, 0, 0, 0.1)',
    bg: '#FDF6E3', fg: '#657B83',
    primary: '#268BD2', primaryH: '#2176B5', pf: '#FDF6E3',
    cb: '#EEE8D5', hb: '#DDD6C1', ab: '#EEE8D5',
    b: '#93A1A1', lb: '#EEE8D5',
    ib: '#FDF6E3',
    pad: '4px 12px', ipad: '4px 8px',
    fb: '2px solid #268BD2',
    gf: '#586E75', tf: '#93A1A1', taf: '#586E75', sf: '#93A1A1',
    gridHFg: '#586E75', mFg: '#586E75', tsFg: '#586E75',
    mBd: '1px solid #DDD6C1', tsBd: '1px solid #DDD6C1', ssBd: '1px solid #DDD6C1',
    tsSep: '#93A1A1',
    tabABg: '#FDF6E3', tabCBg: '#FDF6E3',
    gridRowBg: '#FDF6E3',
    chR: '3px', pnR: '4px', gbR: '4px',
    tabR: '4px 4px 0 0', gridR: '4px', progR: '3px', popR: '4px',
    popBg: '#FDF6E3',
    scTr: '#FDF6E3', scTh: '#93A1A1', scThH: '#839496',
    popSh: '0 4px 12px rgba(0, 0, 0, 0.1)',
  }),

  // ── Sunset Glow (다크 테마) ───────────────────────────────────────────────
  {
    id: 'sunset-glow', name: 'Sunset Glow',
    window: {
      titleBar: { background: 'linear-gradient(to right, #E65100, #AD1457)', foreground: '#FFFFFF', height: 34, font: '13px "Segoe UI", sans-serif', borderRadius: '10px 10px 0 0', controlButtonsPosition: 'right' },
      border: '1px solid rgba(230, 81, 0, 0.4)', borderRadius: '10px', shadow: '0 4px 20px rgba(230, 81, 0, 0.2), 0 0 12px rgba(173, 20, 87, 0.1)',
    },
    form: { backgroundColor: '#2A1B30', foreground: '#FFE0B2', fontFamily: '"Segoe UI", sans-serif', fontSize: '13px' },
    controls: {
      button: { background: 'linear-gradient(135deg, #E65100, #F4511E)', border: '1px solid rgba(255, 109, 0, 0.4)', borderRadius: '8px', foreground: '#FFFFFF', hoverBackground: 'linear-gradient(135deg, #F4511E, #FF6D00)', padding: '4px 14px' },
      textInput: { background: '#3A2840', border: '1px solid rgba(255, 109, 0, 0.3)', borderRadius: '6px', foreground: '#FFE0B2', focusBorder: '2px solid #FF6D00', padding: '4px 8px' },
      select: { background: '#3A2840', border: '1px solid rgba(255, 109, 0, 0.3)', borderRadius: '6px', foreground: '#FFE0B2', selectedBackground: '#E65100', selectedForeground: '#FFFFFF' },
      checkRadio: { border: '1px solid rgba(255, 109, 0, 0.4)', background: '#3A2840', checkedBackground: '#FF6D00', borderRadius: '4px' },
      panel: { background: 'rgba(58, 40, 64, 0.6)', border: '1px solid rgba(255, 109, 0, 0.2)', borderRadius: '8px' },
      groupBox: { border: '1px solid rgba(255, 109, 0, 0.25)', borderRadius: '8px', foreground: '#FFAB40' },
      tabControl: { tabBackground: '#2A1B30', tabActiveBackground: '#3A2840', tabBorder: '1px solid rgba(255, 109, 0, 0.2)', tabBorderRadius: '8px 8px 0 0', tabForeground: '#BF8060', tabActiveForeground: '#FFAB40', contentBackground: '#3A2840', contentBorder: '1px solid rgba(255, 109, 0, 0.2)' },
      dataGrid: { headerBackground: '#3A2840', headerForeground: '#FFAB40', headerBorder: '1px solid rgba(255, 109, 0, 0.2)', rowBackground: '#2A1B30', rowAlternateBackground: '#322238', rowForeground: '#FFE0B2', border: '1px solid rgba(255, 109, 0, 0.2)', borderRadius: '8px', selectedRowBackground: '#E65100', selectedRowForeground: '#FFFFFF' },
      progressBar: { background: '#3A2840', fillBackground: 'linear-gradient(to right, #E65100, #FF6D00)', border: '1px solid rgba(255, 109, 0, 0.2)', borderRadius: '4px' },
      menuStrip: { background: '#221828', foreground: '#FFE0B2', border: '1px solid rgba(255, 109, 0, 0.15)', hoverBackground: 'rgba(230, 81, 0, 0.2)', hoverForeground: '#FFFFFF', activeBackground: '#E65100' },
      toolStrip: { background: '#2A1B30', foreground: '#FFAB40', border: '1px solid rgba(255, 109, 0, 0.15)', buttonHoverBackground: 'rgba(230, 81, 0, 0.2)', separator: 'rgba(255, 109, 0, 0.2)' },
      statusStrip: { background: '#221828', foreground: '#BF8060', border: '1px solid rgba(255, 109, 0, 0.15)' },
      scrollbar: { trackBackground: 'transparent', thumbBackground: 'rgba(255, 109, 0, 0.3)', thumbHoverBackground: 'rgba(255, 109, 0, 0.5)', width: 8 },
    },
    accent: { primary: '#FF6D00', primaryHover: '#E65100', primaryForeground: '#FFFFFF' },
    popup: { background: '#3A2840', border: '1px solid rgba(255, 109, 0, 0.3)', shadow: '0 8px 24px rgba(230, 81, 0, 0.2), 0 0 12px rgba(173, 20, 87, 0.1)', borderRadius: '8px', hoverBackground: 'rgba(230, 81, 0, 0.15)' },
  },

  // ── Windows 95 (클래식 3D 스타일) ──────────────────────────────────────────
  {
    id: 'windows-95', name: 'Windows 95',
    window: {
      titleBar: { background: 'linear-gradient(to right, #000080, #1084D0)', foreground: '#FFFFFF', height: 28, font: 'bold 12px MS Sans Serif, Tahoma, sans-serif', borderRadius: '0', controlButtonsPosition: 'right' },
      border: '2px outset #C0C0C0', borderRadius: '0', shadow: '2px 2px 0px rgba(0,0,0,0.5)',
    },
    form: { backgroundColor: '#C0C0C0', foreground: '#000000', fontFamily: 'MS Sans Serif, Tahoma, sans-serif', fontSize: '12px' },
    controls: {
      button: { background: '#C0C0C0', border: '2px outset #DFDFDF', borderRadius: '0', foreground: '#000000', hoverBackground: '#D4D0C8', padding: '2px 8px' },
      textInput: { background: '#FFFFFF', border: '2px inset #808080', borderRadius: '0', foreground: '#000000', focusBorder: '2px inset #000080', padding: '2px 4px' },
      select: { background: '#FFFFFF', border: '2px inset #808080', borderRadius: '0', foreground: '#000000', selectedBackground: '#000080', selectedForeground: '#FFFFFF' },
      checkRadio: { border: '2px inset #808080', background: '#FFFFFF', checkedBackground: '#000080', borderRadius: '0' },
      panel: { background: 'transparent', border: '2px outset #C0C0C0', borderRadius: '0' },
      groupBox: { border: '2px groove #C0C0C0', borderRadius: '0', foreground: '#000000' },
      tabControl: { tabBackground: '#C0C0C0', tabActiveBackground: '#DFDFDF', tabBorder: '2px outset #C0C0C0', tabBorderRadius: '0', tabForeground: '#000000', tabActiveForeground: '#000000', contentBackground: '#DFDFDF', contentBorder: '2px inset #808080' },
      dataGrid: { headerBackground: '#C0C0C0', headerForeground: '#000000', headerBorder: '1px solid #808080', rowBackground: '#FFFFFF', rowAlternateBackground: '#F0F0F0', rowForeground: '#000000', border: '2px inset #808080', borderRadius: '0', selectedRowBackground: '#000080', selectedRowForeground: '#FFFFFF' },
      progressBar: { background: '#C0C0C0', fillBackground: '#000080', border: '2px inset #808080', borderRadius: '0' },
      menuStrip: { background: '#C0C0C0', foreground: '#000000', border: '1px solid #808080', hoverBackground: '#000080', hoverForeground: '#FFFFFF', activeBackground: '#000080' },
      toolStrip: { background: '#C0C0C0', foreground: '#000000', border: '2px outset #C0C0C0', buttonHoverBackground: '#D4D0C8', separator: '#808080' },
      statusStrip: { background: '#C0C0C0', foreground: '#000000', border: '2px inset #808080' },
      scrollbar: { trackBackground: '#C0C0C0', thumbBackground: '#808080', thumbHoverBackground: '#606060', width: 16 },
    },
    accent: { primary: '#000080', primaryHover: '#0000A0', primaryForeground: '#FFFFFF' },
    popup: { background: '#FFFFFF', border: '2px outset #C0C0C0', shadow: '2px 2px 0px rgba(0,0,0,0.5)', borderRadius: '0', hoverBackground: '#000080' },
  },

  // ── Windows 2000 ──────────────────────────────────────────────────────────
  light({
    id: 'windows-2000', name: 'Windows 2000',
    font: 'Tahoma, MS Sans Serif, sans-serif', fs: '12px', th: 28, sw: 16,
    titleFont: 'bold 12px Tahoma, sans-serif',
    titleBg: 'linear-gradient(to right, #0A246A, #3A6EA5)',
    wb: '1px solid #404040',
    ws: '2px 2px 4px rgba(0,0,0,0.3)',
    bg: '#D4D0C8', fg: '#000000',
    primary: '#0A246A', primaryH: '#3A6EA5',
    cb: '#D4D0C8', hb: '#E0DCD4', ab: '#F0EDE8',
    b: '#808080',
    btnBd: '2px outset #D4D0C8',
    iBd: '1px inset #808080', fb: '1px inset #0A246A',
    pad: '2px 8px', ipad: '2px 4px',
    gridHBg: '#D4D0C8', tabABg: '#ECECEC', tabCBg: '#ECECEC',
    mHb: '#3A6EA5', mHf: '#FFFFFF', mAb: '#0A246A',
    scTr: '#D4D0C8', scTh: '#A0A0A0', scThH: '#808080',
    popSh: '2px 2px 4px rgba(0,0,0,0.25)',
  }),

  // ── Windows 7 ─────────────────────────────────────────────────────────────
  light({
    id: 'windows-7', name: 'Windows 7',
    font: 'Segoe UI, sans-serif', fs: '12px', th: 30, r: '2px', sw: 17,
    titleFont: '12px Segoe UI, sans-serif',
    titleBg: 'linear-gradient(to bottom, #4580C4, #1E5799)',
    wr: '4px', tr: '4px 4px 0 0',
    wb: '1px solid #385D7A',
    ws: '0 2px 12px rgba(0,0,0,0.3)',
    bg: '#F0F0F0', fg: '#000000',
    primary: '#3399FF', primaryH: '#1A7FE6',
    cb: '#F0F0F0', hb: 'linear-gradient(to bottom, #ECF4FC, #DCECFC)', ab: '#F7F7F7',
    b: '#ACACAC', lb: '#B8B8B8',
    btnBg: 'linear-gradient(to bottom, #F0F0F0, #E5E5E5)',
    iBd: '1px solid #ABADB3', fb: '1px solid #3399FF',
    chBd: '1px solid #8E8F8F',
    pad: '3px 10px', ipad: '2px 4px',
    tabR: '2px 2px 0 0',
    gf: '#0033A0', tf: '#333333',
    gridHBg: 'linear-gradient(to bottom, #FFFFFF, #E8E8E8)',
    gridHFg: '#000000',
    progBg: '#E6E6E6', progFill: 'linear-gradient(to bottom, #37B44A, #2D9F3E)', progBd: '1px solid #BCBCBC',
    mHb: '#D8EFFC', mAb: '#CCE8FF',
    tsBg: 'linear-gradient(to bottom, #F5F5F5, #E8E8E8)', tsHb: '#D8EFFC',
    sf: '#444444',
    scTr: '#F0F0F0', scTh: '#C1C1C1', scThH: '#A8A8A8',
    popSh: '0 2px 8px rgba(0,0,0,0.2)', popHb: '#D8EFFC',
    gbBd: '1px solid #D5DFE5',
  }),

  // ── Classic Blue ──────────────────────────────────────────────────────────
  light({
    id: 'classic-blue', name: 'Classic Blue',
    font: 'Georgia, Cambria, serif', fs: '13px', th: 30, r: '2px', sw: 14,
    titleFont: '12px Georgia, serif',
    titleBg: 'linear-gradient(to right, #003366, #336699)',
    wb: '1px solid #003366',
    bg: '#FFFFFF', fg: '#1A1A1A',
    primary: '#003366', primaryH: '#004488',
    cb: '#E8F0FE', hb: '#D0E4F7', ab: '#F5F8FC',
    b: '#9DB8D2', lb: '#B8CBE0',
    btnFg: '#003366',
    pad: '3px 10px', ipad: '3px 5px',
    gf: '#003366', tf: '#336699', taf: '#003366', sf: '#336699',
    gridHFg: '#003366', mFg: '#003366', tsFg: '#003366',
    scTr: '#F0F5FA', scTh: '#9DB8D2', scThH: '#7A9EC0',
    popSh: '0 2px 8px rgba(0,51,102,0.15)',
  }),

  // ── Cream Paper ───────────────────────────────────────────────────────────
  light({
    id: 'cream-paper', name: 'Cream Paper',
    font: 'Segoe UI, Cambria, sans-serif', fs: '12px', th: 30, r: '2px', sw: 14,
    titleFont: '12px Segoe UI, sans-serif',
    titleBg: 'linear-gradient(to right, #8B6914, #C49A1A)',
    wb: '1px solid #8B7355',
    bg: '#FDF8F0', fg: '#2C2416',
    primary: '#8B6914', primaryH: '#A07D1C',
    cb: '#F0E8D8', hb: '#E8DCC8', ab: '#FDF5E8',
    b: '#C4A882', lb: '#D4C4A8',
    ib: '#FFFEF8',
    pad: '3px 10px', ipad: '3px 5px',
    gf: '#5C4A2E', tf: '#5C4A2E', sf: '#5C4A2E',
    progFill: '#C49A1A',
    mHf: '#2C2416', mAb: '#D8C8A8',
    scTr: '#F5EDE0', scTh: '#C4A882', scThH: '#A8906C',
    popBg: '#FFFEF8', popSh: '0 2px 8px rgba(139,105,20,0.15)',
  }),

  // ── Soft Lavender ─────────────────────────────────────────────────────────
  light({
    id: 'soft-lavender', name: 'Soft Lavender',
    font: 'Segoe UI, sans-serif', fs: '12px', th: 30, r: '2px', sw: 14,
    titleFont: '12px Segoe UI, sans-serif',
    titleBg: 'linear-gradient(to right, #6B5B95, #8677AD)',
    wb: '1px solid #7B6BA5',
    ws: '0 2px 8px rgba(107,91,149,0.2)',
    bg: '#F5F0FA', fg: '#1A1A2E',
    primary: '#6B5B95', primaryH: '#7E6DAA',
    cb: '#E8E0F0', hb: '#DCD0E8', ab: '#F8F4FC',
    b: '#B8A8D0', lb: '#D0C4E0',
    btnFg: '#2D2348',
    pad: '3px 10px', ipad: '3px 5px',
    gf: '#4A3D6E', tf: '#4A3D6E', sf: '#4A3D6E',
    mBg: '#EDE8F5', tsBg: '#EDE8F5', ssBg: '#EDE8F5',
    mAb: '#C8B8DC',
    scTr: '#F0EAF5', scTh: '#B8A8D0', scThH: '#9888B8',
    popSh: '0 2px 8px rgba(107,91,149,0.15)',
  }),

  // ── Mint Fresh ────────────────────────────────────────────────────────────
  light({
    id: 'mint-fresh', name: 'Mint Fresh',
    font: 'Segoe UI, sans-serif', fs: '12px', th: 30, r: '2px', sw: 14,
    titleFont: '12px Segoe UI, sans-serif',
    titleBg: 'linear-gradient(to right, #2E8B57, #3CB371)',
    wb: '1px solid #2E8B57',
    ws: '0 2px 8px rgba(46,139,87,0.2)',
    bg: '#F0FAF5', fg: '#1A2E24',
    primary: '#2E8B57', primaryH: '#3CB371',
    cb: '#E0F0E8', hb: '#D0E8D8', ab: '#F5FAF8',
    b: '#A0CCB4', lb: '#B8D8C8',
    btnFg: '#1A3D2A',
    pad: '3px 10px', ipad: '3px 5px',
    gf: '#2E6B47', tf: '#2E6B47', sf: '#2E6B47',
    mBg: '#E8F5EE', tsBg: '#E8F5EE', ssBg: '#E8F5EE',
    mAb: '#B8D8C8',
    scTr: '#ECF5F0', scTh: '#A0CCB4', scThH: '#80B89A',
    popSh: '0 2px 8px rgba(46,139,87,0.15)',
  }),

  // ── Sand Dune ─────────────────────────────────────────────────────────────
  light({
    id: 'sand-dune', name: 'Sand Dune',
    font: 'Segoe UI, sans-serif', fs: '12px', th: 30, r: '2px', sw: 14,
    titleFont: '12px Segoe UI, sans-serif',
    titleBg: 'linear-gradient(to right, #8B7042, #A68858)',
    wb: '1px solid #8B7042',
    ws: '0 2px 8px rgba(139,112,66,0.2)',
    bg: '#F8F4EC', fg: '#2E2518',
    primary: '#8B7042', primaryH: '#A08050',
    cb: '#EDE4D4', hb: '#E4D8C4', ab: '#F8F0E4',
    b: '#C4B090', lb: '#D4C4A4',
    ib: '#FFFDF8',
    btnFg: '#3E3020',
    pad: '3px 10px', ipad: '3px 5px',
    gf: '#5C4A30', tf: '#5C4A30', sf: '#5C4A30',
    mBg: '#F0E8D8', tsBg: '#F0E8D8', ssBg: '#F0E8D8',
    mHf: '#3E3020', mAb: '#D4C4A4',
    progFill: '#A68858',
    scTr: '#F4EDE0', scTh: '#C4B090', scThH: '#A89878',
    popBg: '#FFFDF8', popSh: '0 2px 8px rgba(139,112,66,0.15)',
  }),

  // ── Sky Blue ──────────────────────────────────────────────────────────────
  light({
    id: 'sky-blue', name: 'Sky Blue',
    font: 'Segoe UI, sans-serif', fs: '12px', th: 30, r: '2px', sw: 14,
    titleFont: '12px Segoe UI, sans-serif',
    titleBg: 'linear-gradient(to right, #2980B9, #3498DB)',
    wb: '1px solid #2471A3',
    ws: '0 2px 8px rgba(41,128,185,0.2)',
    bg: '#EBF5FB', fg: '#1B2631',
    primary: '#2980B9', primaryH: '#3498DB',
    cb: '#D6EAF8', hb: '#C4DFF0', ab: '#F0F8FE',
    b: '#85C1E9', lb: '#AED6F1',
    btnFg: '#1B4F72',
    pad: '3px 10px', ipad: '3px 5px',
    gf: '#1B4F72', tf: '#2471A3', taf: '#1B4F72', sf: '#2471A3',
    gridHFg: '#1B4F72', mFg: '#1B4F72', tsFg: '#1B4F72',
    mBg: '#DFF0FA', tsBg: '#DFF0FA', ssBg: '#DFF0FA',
    mAb: '#AED6F1',
    progFill: '#3498DB',
    scTr: '#E8F4FC', scTh: '#85C1E9', scThH: '#5DADE2',
    popSh: '0 2px 8px rgba(41,128,185,0.15)',
  }),

  // ── Rose Quartz ───────────────────────────────────────────────────────────
  light({
    id: 'rose-quartz', name: 'Rose Quartz',
    font: 'Segoe UI, sans-serif', fs: '12px', th: 30, r: '2px', sw: 14,
    titleFont: '12px Segoe UI, sans-serif',
    titleBg: 'linear-gradient(to right, #B5485A, #C96B7E)',
    wb: '1px solid #A04050',
    ws: '0 2px 8px rgba(181,72,90,0.2)',
    bg: '#FDF2F4', fg: '#2E1A1E',
    primary: '#B5485A', primaryH: '#C96B7E',
    cb: '#F0DDE0', hb: '#E8D0D4', ab: '#FCF5F6',
    b: '#D4A0AA', lb: '#E0BCC2',
    btnFg: '#4A2030',
    pad: '3px 10px', ipad: '3px 5px',
    gf: '#6E3040', tf: '#6E3040', sf: '#6E3040',
    mBg: '#F5E4E8', tsBg: '#F5E4E8', ssBg: '#F5E4E8',
    mAb: '#D8B0B8',
    progFill: '#C96B7E',
    scTr: '#F8EAED', scTh: '#D4A0AA', scThH: '#C08090',
    popSh: '0 2px 8px rgba(181,72,90,0.15)',
  }),

];

// ─────────────────────────────────────────────────────────────────────────────
// API seed 요청 JSON 생성
// ─────────────────────────────────────────────────────────────────────────────

const result = {
  themes: themes.map(t => ({
    presetId: t.id,
    name: t.name,
    tokens: t,
  })),
};

const outPath = '${TMP_FILE}';
writeFileSync(outPath, JSON.stringify(result));
console.log(themes.length);
NODESCRIPT

THEME_COUNT=$(node --input-type=module <<NODESCRIPT
import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('${TMP_FILE}', 'utf8'));
console.log(data.themes.length);
NODESCRIPT
)
ok "${THEME_COUNT}개 프리셋 테마 JSON 생성 완료"

# ─── 4. API 호출: 테마 시딩 ─────────────────────────────────────────────────
info "프리셋 테마를 API를 통해 시딩합니다..."

SEED_RESULT=$(curl -s -X POST "${API_URL}/api/themes/seed" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d @"${TMP_FILE}")

# 결과 파싱
UPSERTED=$(echo "$SEED_RESULT" | node -e "
  let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
    try{const r=JSON.parse(d);console.log(r.upserted??'error')}catch{console.log('error')}
  });
")
UNCHANGED=$(echo "$SEED_RESULT" | node -e "
  let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
    try{const r=JSON.parse(d);console.log(r.unchanged??'error')}catch{console.log('error')}
  });
")
TOTAL=$(echo "$SEED_RESULT" | node -e "
  let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
    try{const r=JSON.parse(d);console.log(r.total??'error')}catch{console.log('error')}
  });
")

if [ "$UPSERTED" = "error" ] || [ "$TOTAL" = "error" ]; then
  fail "테마 시딩 API 호출 실패: ${SEED_RESULT}"
fi

echo ""
ok "프리셋 테마 시딩 완료!"
info "  upserted: ${UPSERTED}, unchanged: ${UNCHANGED}, total: ${TOTAL}"
