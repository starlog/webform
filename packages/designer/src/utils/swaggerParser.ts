import yaml from 'js-yaml';

export interface SwaggerOperation {
  operationId: string;
  method: string;
  path: string;
  pathParams: string[];
  queryParams: string[];
  hasRequestBody: boolean;
  isMultipart: boolean;
  summary?: string;
}

export interface ParsedSwaggerSpec {
  title: string;
  version: string;
  baseUrl: string;
  operations: SwaggerOperation[];
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

const METHOD_PREFIX: Record<string, string> = {
  get: 'get',
  post: 'create',
  put: 'update',
  delete: 'delete',
  patch: 'patch',
};

function generateOperationId(method: string, path: string): string {
  const segments = path.split('/').filter(Boolean);
  const resourceSegments = segments.filter((s) => !s.startsWith('{'));
  const lastIsParam = segments.length > 0 && segments[segments.length - 1].startsWith('{');
  const lastResource = resourceSegments[resourceSegments.length - 1] ?? '';
  const prefix = METHOD_PREFIX[method] ?? method.toLowerCase();

  const singular = lastResource.endsWith('s') ? lastResource.slice(0, -1) : lastResource;
  const capitalized = singular.charAt(0).toUpperCase() + singular.slice(1);

  if (lastIsParam && singular) {
    if (method === 'get') {
      return `${prefix}${capitalized}ById`;
    }
    return `${prefix}${capitalized}`;
  } else if (lastResource) {
    if (method === 'get') {
      const cap = lastResource.charAt(0).toUpperCase() + lastResource.slice(1);
      return `${prefix}${cap}`;
    }
    return `${prefix}${capitalized}`;
  }

  const camelSegments = resourceSegments
    .map((s, i) => (i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)))
    .join('');
  return `${prefix}${camelSegments.charAt(0).toUpperCase() + camelSegments.slice(1)}`;
}

function extractBaseUrl(spec: Record<string, unknown>): string {
  if (spec.openapi) {
    const servers = spec.servers as Array<{ url: string }> | undefined;
    return servers?.[0]?.url ?? '';
  }

  if (spec.swagger) {
    const scheme = ((spec.schemes as string[]) ?? ['https'])[0];
    const host = (spec.host as string) ?? '';
    const basePath = (spec.basePath as string) ?? '';
    return host ? `${scheme}://${host}${basePath}` : '';
  }

  return '';
}

export function parseSwaggerSpec(specYaml: string): ParsedSwaggerSpec | null {
  let spec: Record<string, unknown>;
  try {
    spec = yaml.load(specYaml) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (!spec || typeof spec !== 'object') return null;

  const info = (spec.info as Record<string, unknown>) ?? {};
  const title = (info.title as string) ?? '';
  const version = (info.version as string) ?? '';
  const baseUrl = extractBaseUrl(spec);

  const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>;
  const operations: SwaggerOperation[] = [];
  const usedIds = new Set<string>();

  function uniqueOperationId(id: string): string {
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
    let counter = 2;
    while (usedIds.has(`${id}${counter}`)) {
      counter++;
    }
    const unique = `${id}${counter}`;
    usedIds.add(unique);
    return unique;
  }

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    const pathLevelParams = (pathItem.parameters as Array<Record<string, unknown>>) ?? [];

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const pathParams = (path.match(/\{(\w+)\}/g) || []).map((p) => p.slice(1, -1));

      const allParams = [
        ...pathLevelParams,
        ...((operation.parameters as Array<Record<string, unknown>>) ?? []),
      ];
      const queryParams = allParams.filter((p) => p.in === 'query').map((p) => p.name as string);

      const hasRequestBody = spec.openapi
        ? !!operation.requestBody
        : allParams.some((p) => p.in === 'body');

      let isMultipart = false;
      if (spec.openapi && operation.requestBody) {
        const rb = operation.requestBody as Record<string, unknown>;
        const content = rb.content as Record<string, unknown> | undefined;
        if (content && content['multipart/form-data']) {
          isMultipart = true;
        }
      } else if (spec.swagger) {
        const consumes =
          (operation.consumes as string[]) ?? (spec.consumes as string[]) ?? [];
        if (consumes.includes('multipart/form-data')) {
          isMultipart = true;
        }
      }

      const rawId = (operation.operationId as string) || generateOperationId(method, path);
      const operationId = uniqueOperationId(rawId);

      const summary = operation.summary as string | undefined;

      operations.push({
        operationId,
        method: method.toUpperCase(),
        path,
        pathParams,
        queryParams,
        hasRequestBody,
        isMultipart,
        ...(summary !== undefined && { summary }),
      });
    }
  }

  return { title, version, baseUrl, operations };
}
