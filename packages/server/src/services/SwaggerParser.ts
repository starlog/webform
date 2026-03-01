import yaml from 'js-yaml';

export interface SwaggerOperation {
  operationId: string;
  method: string;
  path: string;
  pathParams: string[];
  queryParams: string[];
  hasRequestBody: boolean;
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
    // GET /pets/{petId} → getPetById, but PUT/DELETE/PATCH → updatePet, deletePet, patchPet
    if (method === 'get') {
      return `${prefix}${capitalized}ById`;
    }
    return `${prefix}${capitalized}`;
  } else if (lastResource) {
    if (method === 'get') {
      // GET /pets → getPets (복수 유지)
      const cap = lastResource.charAt(0).toUpperCase() + lastResource.slice(1);
      return `${prefix}${cap}`;
    }
    return `${prefix}${capitalized}`;
  }

  // fallback: method + 전체 path를 camelCase
  const camelSegments = resourceSegments
    .map((s, i) => (i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)))
    .join('');
  return `${prefix}${camelSegments.charAt(0).toUpperCase() + camelSegments.slice(1)}`;
}

function extractBaseUrl(spec: Record<string, unknown>): string {
  // OpenAPI 3.x
  if (spec.openapi) {
    const servers = spec.servers as Array<{ url: string }> | undefined;
    return servers?.[0]?.url ?? '';
  }

  // Swagger 2.x
  if (spec.swagger) {
    const scheme = ((spec.schemes as string[]) ?? ['https'])[0];
    const host = (spec.host as string) ?? '';
    const basePath = (spec.basePath as string) ?? '';
    return host ? `${scheme}://${host}${basePath}` : '';
  }

  return '';
}

export function parseSwaggerSpec(specYaml: string): ParsedSwaggerSpec {
  let spec: Record<string, unknown>;
  try {
    spec = yaml.load(specYaml) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`SwaggerParser: YAML 파싱 실패: ${(err as Error).message}`);
  }

  if (!spec || typeof spec !== 'object') {
    throw new Error('SwaggerParser: YAML 파싱 실패: 유효한 객체가 아닙니다');
  }

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

      // hasRequestBody: OpenAPI 3.x uses requestBody, Swagger 2.x uses in=body parameter
      const hasRequestBody = spec.openapi
        ? !!operation.requestBody
        : allParams.some((p) => p.in === 'body');

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
        ...(summary !== undefined && { summary }),
      });
    }
  }

  return { title, version, baseUrl, operations };
}
