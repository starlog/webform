import type { ControlDefinition } from '@webform/common';
import { CONTROL_PROPERTY_META, type PropertyMeta } from '../PropertyPanel/controlProperties';
import { parseSwaggerSpec } from '../../utils/swaggerParser';

export const FORM_CONTEXT_BASE_TYPES = `
interface ControlProxy {
  [property: string]: any;
}

interface CollectionProxy {
  find(filter?: Record<string, unknown>): Promise<unknown[]>;
  findOne(filter?: Record<string, unknown>): Promise<unknown | null>;
  insertOne(doc: Record<string, unknown>): Promise<{ insertedId: string }>;
  updateOne(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<{ modifiedCount: number }>;
  deleteOne(filter: Record<string, unknown>): Promise<{ deletedCount: number }>;
}

interface DataSourceProxy {
  collection(name: string): CollectionProxy;
}

interface DialogResult {
  dialogResult: 'OK' | 'Cancel';
  data: Record<string, unknown>;
}

interface HttpResponse {
  status: number;
  ok: boolean;
  data: any;
}

interface HttpClient {
  get(url: string): HttpResponse;
  post(url: string, body?: unknown): HttpResponse;
  put(url: string, body?: unknown): HttpResponse;
  patch(url: string, body?: unknown): HttpResponse;
  delete(url: string): HttpResponse;
}

interface Console {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  info(...args: any[]): void;
}

/** JSONPath 표현식으로 JSON 데이터에서 값을 추출합니다.
 * 지원 문법: $.key, [n], [*], ..key, [start:end], [?(@.key==val)]
 */
declare function jsonPath(obj: any, expr: string): any[];
`;

export function metaToTsType(meta: PropertyMeta): string {
  switch (meta.editorType) {
    case 'text': return 'string';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'color': return 'string';
    case 'font': return '{ family: string; size: number; bold: boolean; italic: boolean }';
    case 'dropdown':
      return meta.options?.length
        ? meta.options.map((o) => `'${o}'`).join(' | ')
        : 'string';
    case 'collection': return 'any[]';
    default: return 'any';
  }
}

export function buildControlTypeInterface(controlType: string): { name: string; body: string } {
  const metas = CONTROL_PROPERTY_META[controlType as keyof typeof CONTROL_PROPERTY_META] ?? [];
  const props: string[] = [];

  for (const meta of metas) {
    if (meta.name.startsWith('properties.')) {
      const propName = meta.name.slice('properties.'.length);
      props.push(`  ${propName}: ${metaToTsType(meta)};`);
    }
  }
  props.push('  visible: boolean;');
  props.push('  enabled: boolean;');
  props.push('  [key: string]: any;');

  const ifaceName = `__${controlType}Props`;
  return { name: ifaceName, body: `interface ${ifaceName} {\n${props.join('\n')}\n}` };
}

export function buildSwaggerConnectorInterface(ctrl: ControlDefinition): { name: string; body: string } {
  const ifaceName = `__SwaggerConnector_${ctrl.name}`;
  const props: string[] = [];

  const specYaml = (ctrl.properties.specYaml as string) || '';
  const parsed = specYaml ? parseSwaggerSpec(specYaml) : null;

  if (parsed) {
    for (const op of parsed.operations) {
      const optFields: string[] = [];
      if (op.pathParams.length > 0) {
        const pathFields = op.pathParams.map((p) => `${p}?: string | number`).join('; ');
        optFields.push(`path?: { ${pathFields} }`);
      }
      if (op.queryParams.length > 0) {
        const queryFields = op.queryParams.map((p) => `${p}?: string | number`).join('; ');
        optFields.push(`query?: { ${queryFields} }`);
      } else {
        optFields.push('query?: Record<string, unknown>');
      }
      if (op.hasRequestBody) {
        optFields.push('body?: unknown');
      }
      optFields.push('headers?: Record<string, string>');

      const optsType = `{ ${optFields.join('; ')} }`;
      const doc = op.summary ? `  /** ${op.summary} — ${op.method} ${op.path} */\n` : `  /** ${op.method} ${op.path} */\n`;
      props.push(`${doc}  ${op.operationId}(opts?: ${optsType}): HttpResponse;`);
    }
  }

  props.push('  specYaml: string;');
  props.push('  baseUrl: string;');
  props.push('  defaultHeaders: string;');
  props.push('  timeout: number;');
  props.push('  visible: boolean;');
  props.push('  enabled: boolean;');
  props.push('  [key: string]: any;');

  return { name: ifaceName, body: `interface ${ifaceName} {\n${props.join('\n')}\n}` };
}

export function buildFormContextTypes(controls: ControlDefinition[]): string {
  const typeInterfaces = new Map<string, string>();
  const controlEntries: string[] = [];

  function walk(ctrls: ControlDefinition[]) {
    for (const ctrl of ctrls) {
      if (ctrl.type === 'SwaggerConnector') {
        const { name: ifaceName, body } = buildSwaggerConnectorInterface(ctrl);
        typeInterfaces.set(ifaceName, body);
        controlEntries.push(`  ${ctrl.name}: ${ifaceName};`);
      } else {
        const { name: ifaceName, body } = buildControlTypeInterface(ctrl.type);
        if (!typeInterfaces.has(ifaceName)) {
          typeInterfaces.set(ifaceName, body);
        }
        controlEntries.push(`  ${ctrl.name}: ${ifaceName};`);
      }
      if (ctrl.children) walk(ctrl.children);
    }
  }
  walk(controls);

  const dynamicInterfaces = [...typeInterfaces.values()].join('\n\n');
  const formControlsIface = controlEntries.length
    ? `interface FormControls {\n${controlEntries.join('\n')}\n  [name: string]: ControlProxy;\n}`
    : 'interface FormControls { [name: string]: ControlProxy; }';

  return `${FORM_CONTEXT_BASE_TYPES}
${dynamicInterfaces}

${formControlsIface}

interface AuthContext {
  /** Google OAuth2 로그아웃. 토큰을 삭제하고 로그인 페이지로 이동합니다. */
  logout(): void;
}

interface FormContext {
  formId: string;
  controls: FormControls;
  dataSources: Record<string, DataSourceProxy>;
  http: HttpClient;
  auth: AuthContext;
  showMessage(text: string, title?: string, type?: 'info' | 'warning' | 'error' | 'success'): void;
  showDialog(formId: string, params?: Record<string, unknown>): Promise<DialogResult>;
  navigate(formId: string, params?: Record<string, unknown>): void;
  close(dialogResult?: 'OK' | 'Cancel'): void;
  getRadioGroupValue(groupName: string): string | null;
}

declare const ctx: FormContext;
declare const sender: ControlProxy;
declare const console: Console;
`;
}
