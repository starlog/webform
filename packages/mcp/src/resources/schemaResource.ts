import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CONTROL_TYPES, COMMON_EVENTS, CONTROL_EVENTS, FORM_EVENTS } from '@webform/common';
import { CONTROL_DEFAULTS } from '../utils/controlDefaults.js';

// --- 정적 스키마 캐시 (서버 시작 시 1회 생성, 이후 재사용) ---

function buildControlTypesJson(): string {
  const categories: Record<string, string[]> = {};
  const defaultProperties: Record<string, Record<string, unknown>> = {};

  for (const type of CONTROL_TYPES) {
    const def = CONTROL_DEFAULTS[type];
    const cat = def.category;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(type);
    defaultProperties[type] = {
      ...def.properties,
      defaultSize: def.size,
    };
  }

  return JSON.stringify(
    {
      controlTypes: [...CONTROL_TYPES],
      count: CONTROL_TYPES.length,
      categories,
      defaultProperties,
      commonProperties: {
        layout: ['position.x', 'position.y', 'size.width', 'size.height', 'anchor', 'dock'],
        behavior: ['name', 'enabled', 'visible', 'tabIndex'],
      },
    },
    null,
    2,
  );
}

function buildEventsJson(): string {
  const allEventsPerControl: Record<string, string[]> = {};
  for (const type of CONTROL_TYPES) {
    const specific = CONTROL_EVENTS[type] ?? [];
    allEventsPerControl[type] = [...COMMON_EVENTS, ...specific];
  }

  return JSON.stringify(
    {
      commonEvents: [...COMMON_EVENTS],
      formEvents: [...FORM_EVENTS],
      controlSpecificEvents: { ...CONTROL_EVENTS },
      allEventsPerControl,
    },
    null,
    2,
  );
}

function buildFormPropertiesJson(): string {
  return JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'FormProperties',
      description: '폼 레벨 속성 정의',
      type: 'object',
      properties: {
        title: { type: 'string', description: '폼 제목 (타이틀바 표시)' },
        width: { type: 'number', description: '폼 너비 (px)', minimum: 200 },
        height: { type: 'number', description: '폼 높이 (px)', minimum: 150 },
        backgroundColor: {
          type: 'string',
          description: '배경색 (HEX)',
          pattern: '^#[0-9a-fA-F]{6}$',
        },
        font: {
          type: 'object',
          description: '폼 기본 폰트',
          properties: {
            family: { type: 'string' },
            size: { type: 'number' },
            bold: { type: 'boolean' },
            italic: { type: 'boolean' },
            underline: { type: 'boolean' },
            strikethrough: { type: 'boolean' },
          },
          required: ['family', 'size', 'bold', 'italic', 'underline', 'strikethrough'],
        },
        startPosition: {
          type: 'string',
          enum: ['CenterScreen', 'Manual', 'CenterParent'],
        },
        formBorderStyle: {
          type: 'string',
          enum: ['None', 'FixedSingle', 'Fixed3D', 'Sizable'],
        },
        maximizeBox: { type: 'boolean' },
        minimizeBox: { type: 'boolean' },
        windowState: { type: 'string', enum: ['Normal', 'Maximized'] },
        theme: { type: 'string', description: 'ThemeId' },
        themeColorMode: {
          type: 'string',
          enum: ['theme', 'control'],
          description: '테마 색상 적용 모드',
        },
      },
      required: [
        'title',
        'width',
        'height',
        'backgroundColor',
        'font',
        'startPosition',
        'formBorderStyle',
        'maximizeBox',
        'minimizeBox',
      ],
    },
    null,
    2,
  );
}

function buildShellPropertiesJson(): string {
  return JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'ShellProperties',
      description:
        'Application Shell 속성. FormProperties와 유사하지만 startPosition 없고 showTitleBar 추가',
      type: 'object',
      properties: {
        title: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        backgroundColor: {
          type: 'string',
          pattern: '^#[0-9a-fA-F]{6}$',
        },
        font: {
          type: 'object',
          description: '폼 기본 폰트 (FontDefinition)',
          properties: {
            family: { type: 'string' },
            size: { type: 'number' },
            bold: { type: 'boolean' },
            italic: { type: 'boolean' },
            underline: { type: 'boolean' },
            strikethrough: { type: 'boolean' },
          },
          required: ['family', 'size', 'bold', 'italic', 'underline', 'strikethrough'],
        },
        showTitleBar: { type: 'boolean', description: '타이틀바 표시 여부' },
        formBorderStyle: {
          type: 'string',
          enum: ['None', 'FixedSingle', 'Fixed3D', 'Sizable'],
        },
        maximizeBox: { type: 'boolean' },
        minimizeBox: { type: 'boolean' },
        windowState: { type: 'string', enum: ['Normal', 'Maximized'] },
        theme: { type: 'string', description: 'ThemeId' },
      },
      required: [
        'title',
        'width',
        'height',
        'backgroundColor',
        'font',
        'showTitleBar',
        'formBorderStyle',
        'maximizeBox',
        'minimizeBox',
      ],
    },
    null,
    2,
  );
}

function buildThemeTokensJson(): string {
  return JSON.stringify(
    {
      title: 'ThemeTokens',
      description:
        '테마 토큰 구조. 각 테마는 이 구조를 구현하여 UI 전체에 일관된 스타일을 적용한다.',
      structure: {
        id: { type: 'string', description: 'ThemeId' },
        name: { type: 'string', description: '테마 이름' },
        window: {
          description: '윈도우 프레임 토큰',
          fields: {
            titleBar: {
              fields: {
                background: 'string',
                foreground: 'string',
                height: 'number',
                font: 'string',
                borderRadius: 'string',
                controlButtonsPosition: "'left' | 'right'",
              },
            },
            border: 'string',
            borderRadius: 'string',
            shadow: 'string',
          },
        },
        form: {
          description: '폼 영역 토큰',
          fields: {
            backgroundColor: 'string',
            foreground: 'string',
            fontFamily: 'string',
            fontSize: 'string',
          },
        },
        controls: {
          description: '컨트롤별 토큰 (13종)',
          fields: {
            button: {
              fields: {
                background: 'string',
                border: 'string',
                borderRadius: 'string',
                foreground: 'string',
                hoverBackground: 'string',
                padding: 'string',
              },
            },
            textInput: {
              fields: {
                background: 'string',
                border: 'string',
                borderRadius: 'string',
                foreground: 'string',
                focusBorder: 'string',
                padding: 'string',
              },
            },
            select: {
              fields: {
                background: 'string',
                border: 'string',
                borderRadius: 'string',
                foreground: 'string',
                selectedBackground: 'string',
                selectedForeground: 'string',
              },
            },
            checkRadio: {
              fields: {
                border: 'string',
                background: 'string',
                checkedBackground: 'string',
                borderRadius: 'string',
              },
            },
            panel: {
              fields: {
                background: 'string',
                border: 'string',
                borderRadius: 'string',
              },
            },
            groupBox: {
              fields: {
                border: 'string',
                borderRadius: 'string',
                foreground: 'string',
              },
            },
            tabControl: {
              fields: {
                tabBackground: 'string',
                tabActiveBackground: 'string',
                tabBorder: 'string',
                tabBorderRadius: 'string',
                tabForeground: 'string',
                tabActiveForeground: 'string',
                contentBackground: 'string',
                contentBorder: 'string',
              },
            },
            dataGrid: {
              fields: {
                headerBackground: 'string',
                headerForeground: 'string',
                headerBorder: 'string',
                rowBackground: 'string',
                rowAlternateBackground: 'string',
                rowForeground: 'string',
                border: 'string',
                borderRadius: 'string',
                selectedRowBackground: 'string',
                selectedRowForeground: 'string',
              },
            },
            progressBar: {
              fields: {
                background: 'string',
                fillBackground: 'string',
                border: 'string',
                borderRadius: 'string',
              },
            },
            menuStrip: {
              fields: {
                background: 'string',
                foreground: 'string',
                border: 'string',
                hoverBackground: 'string',
                hoverForeground: 'string',
                activeBackground: 'string',
              },
            },
            toolStrip: {
              fields: {
                background: 'string',
                foreground: 'string',
                border: 'string',
                buttonHoverBackground: 'string',
                separator: 'string',
              },
            },
            statusStrip: {
              fields: {
                background: 'string',
                foreground: 'string',
                border: 'string',
              },
            },
            scrollbar: {
              fields: {
                trackBackground: 'string',
                thumbBackground: 'string',
                thumbHoverBackground: 'string',
                width: 'number',
              },
            },
          },
        },
        accent: {
          description: '강조 색상 토큰',
          fields: {
            primary: 'string',
            primaryHover: 'string',
            primaryForeground: 'string',
          },
        },
        popup: {
          description: '팝업/대화상자 토큰',
          fields: {
            background: 'string',
            border: 'string',
            shadow: 'string',
            borderRadius: 'string',
            hoverBackground: 'string',
          },
        },
      },
    },
    null,
    2,
  );
}

// 정적 스키마 데이터를 모듈 로드 시 1회 생성
const CACHED_CONTROL_TYPES = buildControlTypesJson();
const CACHED_EVENTS = buildEventsJson();
const CACHED_FORM_PROPERTIES = buildFormPropertiesJson();
const CACHED_SHELL_PROPERTIES = buildShellPropertiesJson();
const CACHED_THEME_TOKENS = buildThemeTokensJson();

export function registerSchemaResources(server: McpServer): void {
  // ── 1. webform://schema/control-types ──
  server.resource(
    'control-types-schema',
    'webform://schema/control-types',
    { description: '전체 컨트롤 타입 목록 + 카테고리 그룹핑 + 기본 속성', mimeType: 'application/json' },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: CACHED_CONTROL_TYPES }],
    }),
  );

  // ── 2. webform://schema/events ──
  server.resource(
    'events-schema',
    'webform://schema/events',
    { description: '공통/컨트롤별/폼 이벤트 목록', mimeType: 'application/json' },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: CACHED_EVENTS }],
    }),
  );

  // ── 3. webform://schema/form-properties ──
  server.resource(
    'form-properties-schema',
    'webform://schema/form-properties',
    { description: 'FormProperties JSON Schema', mimeType: 'application/json' },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: CACHED_FORM_PROPERTIES }],
    }),
  );

  // ── 4. webform://schema/shell-properties ──
  server.resource(
    'shell-properties-schema',
    'webform://schema/shell-properties',
    {
      description: 'ShellProperties JSON Schema',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: CACHED_SHELL_PROPERTIES }],
    }),
  );

  // ── 5. webform://schema/theme-tokens ──
  server.resource(
    'theme-tokens-schema',
    'webform://schema/theme-tokens',
    { description: 'ThemeTokens 계층 구조', mimeType: 'application/json' },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: CACHED_THEME_TOKENS }],
    }),
  );
}
