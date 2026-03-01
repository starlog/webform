import { describe, it, expect } from 'vitest';
import { parseSwaggerSpec } from '../services/SwaggerParser.js';

describe('SwaggerParser', () => {
  describe('OpenAPI 3.x 파싱', () => {
    const openapi3Spec = `
openapi: '3.0.3'
info:
  title: Petstore API
  version: '1.0.0'
servers:
  - url: https://api.petstore.io/v1
paths:
  /pets:
    get:
      operationId: listPets
      summary: List all pets
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
        - name: offset
          in: query
          schema:
            type: integer
      responses:
        '200':
          description: OK
    post:
      operationId: createPet
      summary: Create a pet
      requestBody:
        content:
          application/json:
            schema:
              type: object
      responses:
        '201':
          description: Created
  /pets/{petId}:
    get:
      operationId: getPetById
      summary: Get a pet by ID
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: OK
    put:
      operationId: updatePet
      requestBody:
        content:
          application/json:
            schema:
              type: object
      responses:
        '200':
          description: OK
    delete:
      operationId: deletePet
      responses:
        '204':
          description: Deleted
`;

    it('메타데이터를 올바르게 추출한다', () => {
      const result = parseSwaggerSpec(openapi3Spec);
      expect(result.title).toBe('Petstore API');
      expect(result.version).toBe('1.0.0');
      expect(result.baseUrl).toBe('https://api.petstore.io/v1');
    });

    it('모든 operations를 추출한다', () => {
      const result = parseSwaggerSpec(openapi3Spec);
      expect(result.operations).toHaveLength(5);
    });

    it('operationId를 올바르게 보존한다', () => {
      const result = parseSwaggerSpec(openapi3Spec);
      const ids = result.operations.map((op) => op.operationId);
      expect(ids).toContain('listPets');
      expect(ids).toContain('createPet');
      expect(ids).toContain('getPetById');
      expect(ids).toContain('updatePet');
      expect(ids).toContain('deletePet');
    });

    it('HTTP method를 대문자로 변환한다', () => {
      const result = parseSwaggerSpec(openapi3Spec);
      const getOp = result.operations.find((op) => op.operationId === 'listPets');
      expect(getOp?.method).toBe('GET');
    });

    it('pathParams를 올바르게 추출한다', () => {
      const result = parseSwaggerSpec(openapi3Spec);
      const getById = result.operations.find((op) => op.operationId === 'getPetById');
      expect(getById?.pathParams).toEqual(['petId']);
    });

    it('queryParams를 올바르게 추출한다', () => {
      const result = parseSwaggerSpec(openapi3Spec);
      const listPets = result.operations.find((op) => op.operationId === 'listPets');
      expect(listPets?.queryParams).toEqual(['limit', 'offset']);
    });

    it('requestBody 존재 여부를 판정한다 (OpenAPI 3.x)', () => {
      const result = parseSwaggerSpec(openapi3Spec);
      const createPet = result.operations.find((op) => op.operationId === 'createPet');
      const listPets = result.operations.find((op) => op.operationId === 'listPets');
      expect(createPet?.hasRequestBody).toBe(true);
      expect(listPets?.hasRequestBody).toBe(false);
    });

    it('summary를 포함한다', () => {
      const result = parseSwaggerSpec(openapi3Spec);
      const listPets = result.operations.find((op) => op.operationId === 'listPets');
      expect(listPets?.summary).toBe('List all pets');
    });
  });

  describe('Swagger 2.x 파싱', () => {
    const swagger2Spec = `
swagger: '2.0'
info:
  title: Legacy API
  version: '2.0.0'
host: api.example.com
basePath: /v2
schemes:
  - https
paths:
  /users:
    get:
      operationId: listUsers
      parameters:
        - name: page
          in: query
          type: integer
      responses:
        '200':
          description: OK
    post:
      operationId: createUser
      parameters:
        - name: body
          in: body
          schema:
            type: object
      responses:
        '201':
          description: Created
`;

    it('Swagger 2.x baseUrl을 올바르게 추출한다', () => {
      const result = parseSwaggerSpec(swagger2Spec);
      expect(result.baseUrl).toBe('https://api.example.com/v2');
    });

    it('Swagger 2.x 메타데이터를 추출한다', () => {
      const result = parseSwaggerSpec(swagger2Spec);
      expect(result.title).toBe('Legacy API');
      expect(result.version).toBe('2.0.0');
    });

    it('Swagger 2.x body 파라미터로 hasRequestBody를 판정한다', () => {
      const result = parseSwaggerSpec(swagger2Spec);
      const createUser = result.operations.find((op) => op.operationId === 'createUser');
      expect(createUser?.hasRequestBody).toBe(true);
    });
  });

  describe('operationId 자동 생성', () => {
    const specWithoutIds = `
openapi: '3.0.0'
info:
  title: Auto ID Test
  version: '1.0.0'
paths:
  /pets:
    get:
      responses:
        '200':
          description: OK
    post:
      responses:
        '201':
          description: Created
  /pets/{petId}:
    get:
      responses:
        '200':
          description: OK
    put:
      responses:
        '200':
          description: OK
    delete:
      responses:
        '204':
          description: Deleted
    patch:
      responses:
        '200':
          description: OK
`;

    it('GET /pets → getPets', () => {
      const result = parseSwaggerSpec(specWithoutIds);
      const op = result.operations.find((o) => o.method === 'GET' && o.path === '/pets');
      expect(op?.operationId).toBe('getPets');
    });

    it('POST /pets → createPet', () => {
      const result = parseSwaggerSpec(specWithoutIds);
      const op = result.operations.find((o) => o.method === 'POST' && o.path === '/pets');
      expect(op?.operationId).toBe('createPet');
    });

    it('GET /pets/{petId} → getPetById', () => {
      const result = parseSwaggerSpec(specWithoutIds);
      const op = result.operations.find((o) => o.method === 'GET' && o.path === '/pets/{petId}');
      expect(op?.operationId).toBe('getPetById');
    });

    it('PUT /pets/{petId} → updatePet', () => {
      const result = parseSwaggerSpec(specWithoutIds);
      const op = result.operations.find((o) => o.method === 'PUT' && o.path === '/pets/{petId}');
      expect(op?.operationId).toBe('updatePet');
    });

    it('DELETE /pets/{petId} → deletePet', () => {
      const result = parseSwaggerSpec(specWithoutIds);
      const op = result.operations.find(
        (o) => o.method === 'DELETE' && o.path === '/pets/{petId}',
      );
      expect(op?.operationId).toBe('deletePet');
    });

    it('PATCH /pets/{petId} → patchPet', () => {
      const result = parseSwaggerSpec(specWithoutIds);
      const op = result.operations.find(
        (o) => o.method === 'PATCH' && o.path === '/pets/{petId}',
      );
      expect(op?.operationId).toBe('patchPet');
    });
  });

  describe('중복 operationId 처리', () => {
    it('중복 operationId에 숫자를 붙인다', () => {
      const spec = `
openapi: '3.0.0'
info:
  title: Dup Test
  version: '1.0.0'
paths:
  /cats:
    get:
      operationId: listItems
      responses:
        '200':
          description: OK
  /dogs:
    get:
      operationId: listItems
      responses:
        '200':
          description: OK
`;
      const result = parseSwaggerSpec(spec);
      const ids = result.operations.map((op) => op.operationId);
      expect(ids).toContain('listItems');
      expect(ids).toContain('listItems2');
    });
  });

  describe('path-level parameters 병합', () => {
    it('pathItem 레벨 파라미터를 operation에 병합한다', () => {
      const spec = `
openapi: '3.0.0'
info:
  title: Path Params Test
  version: '1.0.0'
paths:
  /stores/{storeId}/products:
    parameters:
      - name: storeId
        in: path
        required: true
    get:
      parameters:
        - name: category
          in: query
      responses:
        '200':
          description: OK
`;
      const result = parseSwaggerSpec(spec);
      const op = result.operations[0];
      expect(op.pathParams).toEqual(['storeId']);
      expect(op.queryParams).toEqual(['category']);
    });
  });

  describe('에러 처리', () => {
    it('잘못된 YAML에 대해 명확한 에러를 던진다', () => {
      expect(() => parseSwaggerSpec('{{invalid yaml')).toThrow('SwaggerParser: YAML 파싱 실패');
    });

    it('null/비객체 YAML에 대해 에러를 던진다', () => {
      expect(() => parseSwaggerSpec('hello')).toThrow('유효한 객체가 아닙니다');
    });
  });

  describe('엣지 케이스', () => {
    it('paths가 없으면 빈 operations 반환', () => {
      const spec = `
openapi: '3.0.0'
info:
  title: Empty
  version: '1.0.0'
`;
      const result = parseSwaggerSpec(spec);
      expect(result.operations).toEqual([]);
      expect(result.title).toBe('Empty');
    });

    it('빈 paths 객체면 빈 operations 반환', () => {
      const spec = `
openapi: '3.0.0'
info:
  title: Empty Paths
  version: '1.0.0'
paths: {}
`;
      const result = parseSwaggerSpec(spec);
      expect(result.operations).toEqual([]);
    });

    it('servers 없으면 빈 baseUrl', () => {
      const spec = `
openapi: '3.0.0'
info:
  title: No Servers
  version: '1.0.0'
paths: {}
`;
      const result = parseSwaggerSpec(spec);
      expect(result.baseUrl).toBe('');
    });

    it('Swagger 2.x host 없으면 빈 baseUrl', () => {
      const spec = `
swagger: '2.0'
info:
  title: No Host
  version: '1.0.0'
paths: {}
`;
      const result = parseSwaggerSpec(spec);
      expect(result.baseUrl).toBe('');
    });

    it('summary가 없는 operation은 summary 필드가 없다', () => {
      const spec = `
openapi: '3.0.0'
info:
  title: No Summary
  version: '1.0.0'
paths:
  /items:
    get:
      responses:
        '200':
          description: OK
`;
      const result = parseSwaggerSpec(spec);
      expect(result.operations[0]).not.toHaveProperty('summary');
    });
  });
});
