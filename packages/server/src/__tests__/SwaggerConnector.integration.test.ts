import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SandboxRunner } from '../services/SandboxRunner.js';
import type { SwaggerConnectorInfo } from '../services/SandboxRunner.js';

// validateSandboxUrl을 mock하여 DNS 조회 방지
vi.mock('../services/validateSandboxUrl.js', () => ({
  validateSandboxUrl: vi.fn().mockResolvedValue(undefined),
}));

// global fetch mock
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const runner = new SandboxRunner();

const petStoreConnector: SwaggerConnectorInfo = {
  controlName: 'petApi',
  operations: [
    {
      operationId: 'listPets',
      method: 'GET',
      path: '/pets',
      pathParams: [],
      queryParams: ['limit'],
      hasRequestBody: false,
      isMultipart: false,
      summary: 'List all pets',
    },
    {
      operationId: 'getPetById',
      method: 'GET',
      path: '/pets/{petId}',
      pathParams: ['petId'],
      queryParams: [],
      hasRequestBody: false,
      isMultipart: false,
    },
    {
      operationId: 'createPet',
      method: 'POST',
      path: '/pets',
      pathParams: [],
      queryParams: [],
      hasRequestBody: true,
      isMultipart: false,
    },
  ],
  baseUrl: 'https://petstore.example.com/v1',
  defaultHeaders: { 'X-Api-Key': 'test-key' },
  timeout: 5000,
};

function makeFetchResponse(status: number, body: unknown) {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe('SwaggerConnector SandboxRunner 통합', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('ctx.controls에 operationId 메서드가 주입되어야 한다', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(200, []));

    const code = `
      var types = [];
      types.push(typeof ctx.controls.petApi.listPets);
      types.push(typeof ctx.controls.petApi.getPetById);
      types.push(typeof ctx.controls.petApi.createPet);
      ctx.controls.result = { text: types.join(',') };
    `;

    const ctx = { controls: { result: { text: '' } } };
    const result = await runner.runCode(code, ctx, {
      swaggerConnectors: [petStoreConnector],
    });

    expect(result.success).toBe(true);
    const ops = (result.value as Record<string, unknown>).operations as Array<{
      type: string;
      target: string;
      payload: Record<string, unknown>;
    }>;
    const updateOp = ops.find((o) => o.target === 'result');
    expect(updateOp?.payload.text).toBe('function,function,function');
  });

  it('GET 요청을 올바른 URL로 수행해야 한다', async () => {
    const responseData = [{ id: 1, name: 'doggie' }];
    mockFetch.mockReturnValue(makeFetchResponse(200, responseData));

    const code = `
      var res = ctx.controls.petApi.listPets({ query: { limit: 10 } });
      ctx.controls.result = { text: JSON.stringify(res) };
    `;

    const ctx = { controls: { result: { text: '' } } };
    const result = await runner.runCode(code, ctx, {
      swaggerConnectors: [petStoreConnector],
    });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://petstore.example.com/v1/pets?limit=10');
    expect(options.method).toBe('GET');
    expect(options.headers['X-Api-Key']).toBe('test-key');
  });

  it('path 파라미터가 올바르게 치환되어야 한다', async () => {
    const responseData = { id: 123, name: 'doggie' };
    mockFetch.mockReturnValue(makeFetchResponse(200, responseData));

    const code = `
      var res = ctx.controls.petApi.getPetById({ path: { petId: 123 } });
      ctx.controls.result = { text: JSON.stringify(res) };
    `;

    const ctx = { controls: { result: { text: '' } } };
    const result = await runner.runCode(code, ctx, {
      swaggerConnectors: [petStoreConnector],
    });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://petstore.example.com/v1/pets/123');
  });

  it('응답이 { status, ok, data } 구조를 반환해야 한다', async () => {
    const responseData = [{ id: 1, name: 'doggie' }];
    mockFetch.mockReturnValue(makeFetchResponse(200, responseData));

    const code = `
      var res = ctx.controls.petApi.listPets({});
      ctx.controls.result = {
        text: String(res.status),
        visible: res.ok,
        items: res.data
      };
    `;

    const ctx = {
      controls: {
        result: { text: '', visible: false, items: [] as unknown[] },
      },
    };
    const result = await runner.runCode(code, ctx, {
      swaggerConnectors: [petStoreConnector],
    });

    expect(result.success).toBe(true);
    const ops = (result.value as Record<string, unknown>).operations as Array<{
      type: string;
      target: string;
      payload: Record<string, unknown>;
    }>;
    const updateOp = ops.find((o) => o.target === 'result');
    expect(updateOp?.payload.text).toBe('200');
    expect(updateOp?.payload.visible).toBe(true);
    expect(updateOp?.payload.items).toEqual([{ id: 1, name: 'doggie' }]);
  });

  it('HTTP 에러 응답(4xx)도 throw하지 않고 { status, ok, data } 반환해야 한다', async () => {
    const errorBody = { message: 'Pet not found' };
    mockFetch.mockReturnValue(makeFetchResponse(404, errorBody));

    const code = `
      var res = ctx.controls.petApi.getPetById({ path: { petId: 999 } });
      ctx.controls.result = {
        text: String(res.status),
        visible: res.ok,
        items: res.data
      };
    `;

    const ctx = {
      controls: {
        result: { text: '', visible: true, items: null as unknown },
      },
    };
    const result = await runner.runCode(code, ctx, {
      swaggerConnectors: [petStoreConnector],
    });

    expect(result.success).toBe(true);
    const ops = (result.value as Record<string, unknown>).operations as Array<{
      type: string;
      target: string;
      payload: Record<string, unknown>;
    }>;
    const updateOp = ops.find((o) => o.target === 'result');
    expect(updateOp?.payload.text).toBe('404');
    expect(updateOp?.payload.visible).toBe(false);
    expect(updateOp?.payload.items).toEqual({ message: 'Pet not found' });
  });

  it('swaggerConnectors가 빈 배열이면 정상 동작해야 한다', async () => {
    const code = `
      ctx.controls.result = { text: 'no connectors' };
    `;

    const ctx = { controls: { result: { text: '' } } };
    const result = await runner.runCode(code, ctx, {
      swaggerConnectors: [],
    });

    expect(result.success).toBe(true);
    const ops = (result.value as Record<string, unknown>).operations as Array<{
      type: string;
      target: string;
      payload: Record<string, unknown>;
    }>;
    const updateOp = ops.find((o) => o.target === 'result');
    expect(updateOp?.payload.text).toBe('no connectors');
  });

  it('POST 요청 시 body와 Content-Type 헤더가 설정되어야 한다', async () => {
    const responseData = { id: 42, name: 'fluffy' };
    mockFetch.mockReturnValue(makeFetchResponse(201, responseData));

    const code = `
      var res = ctx.controls.petApi.createPet({ body: { name: 'fluffy' } });
      ctx.controls.result = { text: String(res.status) };
    `;

    const ctx = { controls: { result: { text: '' } } };
    const result = await runner.runCode(code, ctx, {
      swaggerConnectors: [petStoreConnector],
    });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://petstore.example.com/v1/pets');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['X-Api-Key']).toBe('test-key');
    expect(JSON.parse(options.body)).toEqual({ name: 'fluffy' });
  });
});
