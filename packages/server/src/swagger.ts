import type { JsonObject } from 'swagger-ui-express';

export const swaggerDocument: JsonObject = {
  openapi: '3.0.0',
  info: {
    title: 'WebForm API',
    version: '1.0.0',
    description: 'WebForm SDUI 플랫폼 REST API',
  },
  servers: [{ url: 'http://localhost:4000', description: 'Local development' }],
  tags: [
    { name: 'System', description: '헬스체크, 인증' },
    { name: 'Projects', description: '프로젝트 CRUD' },
    { name: 'Forms', description: '폼 CRUD' },
    { name: 'DataSources', description: '데이터소스 CRUD' },
    { name: 'Shells', description: 'Shell CRUD' },
    { name: 'Runtime', description: '런타임 폼/Shell/App 실행' },
    { name: 'MongoDB', description: 'MongoDB 직접 조작 (MongoDBView 컨트롤용)' },
    { name: 'Debug', description: '코드 테스트 실행 (development 전용)' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              code: { type: 'string' },
            },
          },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
    },
  },
  paths: {
    // ─── System ──────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['System'],
        summary: '헬스체크',
        responses: {
          200: {
            description: '정상',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'degraded'] },
                    timestamp: { type: 'string', format: 'date-time' },
                    services: {
                      type: 'object',
                      properties: {
                        mongo: { type: 'string' },
                        redis: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          503: { description: '서비스 일부 장애' },
        },
      },
    },
    '/auth/dev-token': {
      post: {
        tags: ['System'],
        summary: '개발용 JWT 토큰 발급',
        description: 'NODE_ENV=development 환경에서만 동작',
        responses: {
          200: {
            description: '토큰 발급 성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { token: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },

    // ─── Projects ────────────────────────────────────────────────────────
    '/api/projects': {
      get: {
        tags: ['Projects'],
        summary: '프로젝트 목록',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: '프로젝트 목록',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { type: 'object' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Projects'],
        summary: '프로젝트 생성',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: '생성됨' },
        },
      },
    },
    '/api/projects/import': {
      post: {
        tags: ['Projects'],
        summary: '프로젝트 가져오기',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  project: { type: 'object' },
                  forms: { type: 'array', items: { type: 'object' } },
                  dataSources: { type: 'array', items: { type: 'object' } },
                  shell: { type: 'object', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: '가져오기 완료' },
        },
      },
    },
    '/api/projects/{id}': {
      get: {
        tags: ['Projects'],
        summary: '프로젝트 상세',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: '프로젝트 상세 정보' },
          404: { description: '프로젝트 없음' },
        },
      },
      put: {
        tags: ['Projects'],
        summary: '프로젝트 업데이트',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '업데이트 완료' },
        },
      },
      delete: {
        tags: ['Projects'],
        summary: '프로젝트 삭제',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          204: { description: '삭제 완료' },
        },
      },
    },
    '/api/projects/{id}/font': {
      put: {
        tags: ['Projects'],
        summary: '프로젝트 전체 폼 폰트 일괄 적용',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['font'],
                properties: {
                  font: {
                    type: 'object',
                    required: ['family', 'size'],
                    properties: {
                      family: { type: 'string' },
                      size: { type: 'number' },
                      bold: { type: 'boolean' },
                      italic: { type: 'boolean' },
                      underline: { type: 'boolean' },
                      strikethrough: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: '적용 완료',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    modifiedCount: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/projects/{id}/export': {
      get: {
        tags: ['Projects'],
        summary: '프로젝트 내보내기',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: '프로젝트 JSON 내보내기',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/api/projects/{id}/publish-all': {
      post: {
        tags: ['Projects'],
        summary: '프로젝트 전체 퍼블리시',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: '퍼블리시 결과' },
        },
      },
    },

    // ─── Forms ───────────────────────────────────────────────────────────
    '/api/forms': {
      get: {
        tags: ['Forms'],
        summary: '폼 목록 조회',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'projectId', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: '폼 목록',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { type: 'object' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Forms'],
        summary: '새 폼 생성',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  projectId: { type: 'string' },
                  properties: { type: 'object' },
                  controls: { type: 'array', items: { type: 'object' } },
                  eventHandlers: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
        },
        responses: {
          201: { description: '생성됨' },
        },
      },
    },
    '/api/forms/{id}': {
      get: {
        tags: ['Forms'],
        summary: '폼 정의 조회',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: '폼 정의' },
          404: { description: '폼 없음' },
        },
      },
      put: {
        tags: ['Forms'],
        summary: '폼 정의 수정',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  properties: { type: 'object' },
                  controls: { type: 'array', items: { type: 'object' } },
                  eventHandlers: { type: 'array', items: { type: 'object' } },
                  dataBindings: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '수정 완료' },
        },
      },
      delete: {
        tags: ['Forms'],
        summary: '폼 삭제',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          204: { description: '삭제 완료' },
        },
      },
    },
    '/api/forms/{id}/versions': {
      get: {
        tags: ['Forms'],
        summary: '버전 히스토리',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: '버전 목록',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/forms/{id}/publish': {
      post: {
        tags: ['Forms'],
        summary: '폼 퍼블리시',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: '퍼블리시 완료' },
        },
      },
    },

    // ─── DataSources ─────────────────────────────────────────────────────
    '/api/datasources': {
      get: {
        tags: ['DataSources'],
        summary: '데이터소스 목록',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'projectId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: '데이터소스 목록',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { type: 'object' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['DataSources'],
        summary: '데이터소스 생성',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'type', 'config'],
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['mongodb', 'rest', 'static'] },
                  projectId: { type: 'string' },
                  config: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: '생성됨' },
        },
      },
    },
    '/api/datasources/{id}': {
      get: {
        tags: ['DataSources'],
        summary: '데이터소스 단일 조회',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: '데이터소스 정보 (config 복호화)' },
        },
      },
      put: {
        tags: ['DataSources'],
        summary: '데이터소스 수정',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  config: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '수정 완료' },
        },
      },
      delete: {
        tags: ['DataSources'],
        summary: '데이터소스 삭제 (soft delete)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          204: { description: '삭제 완료' },
        },
      },
    },
    '/api/datasources/{id}/test': {
      post: {
        tags: ['DataSources'],
        summary: '데이터소스 연결 테스트',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: '연결 테스트 결과' },
        },
      },
    },
    '/api/datasources/{id}/query': {
      post: {
        tags: ['DataSources'],
        summary: '데이터소스 쿼리 실행',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  collection: { type: 'string' },
                  filter: { type: 'object' },
                  skip: { type: 'integer' },
                  limit: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '쿼리 결과' },
        },
      },
    },

    // ─── Shells ──────────────────────────────────────────────────────────
    '/api/projects/{projectId}/shell': {
      get: {
        tags: ['Shells'],
        summary: 'Shell 조회',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Shell 정의' },
          404: { description: 'Shell 없음' },
        },
      },
      post: {
        tags: ['Shells'],
        summary: 'Shell 생성',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  properties: { type: 'object' },
                  controls: { type: 'array', items: { type: 'object' } },
                  eventHandlers: { type: 'array', items: { type: 'object' } },
                  startFormId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: '생성됨' },
        },
      },
      put: {
        tags: ['Shells'],
        summary: 'Shell 수정',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  properties: { type: 'object' },
                  controls: { type: 'array', items: { type: 'object' } },
                  eventHandlers: { type: 'array', items: { type: 'object' } },
                  startFormId: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '수정 완료' },
        },
      },
      delete: {
        tags: ['Shells'],
        summary: 'Shell 삭제',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          204: { description: '삭제 완료' },
        },
      },
    },
    '/api/projects/{projectId}/shell/publish': {
      post: {
        tags: ['Shells'],
        summary: 'Shell 퍼블리시',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: '퍼블리시 완료' },
        },
      },
    },

    // ─── Runtime ─────────────────────────────────────────────────────────
    '/api/runtime/forms/{id}': {
      get: {
        tags: ['Runtime'],
        summary: 'Published 폼 정의 조회',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: '폼 정의 (서버 핸들러만 노출)' },
          404: { description: '폼 없음 또는 미퍼블리시' },
        },
      },
    },
    '/api/runtime/forms/{id}/events': {
      post: {
        tags: ['Runtime'],
        summary: '이벤트 실행 → UIPatch 반환',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['controlId', 'eventName', 'formState'],
                properties: {
                  controlId: { type: 'string' },
                  eventName: { type: 'string' },
                  formState: { type: 'object' },
                  eventArgs: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'UIPatch 배열' },
        },
      },
    },
    '/api/runtime/forms/{id}/data': {
      post: {
        tags: ['Runtime'],
        summary: '데이터소스 쿼리 실행',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  dataSourceId: { type: 'string', description: '미지정 시 폼의 모든 dataBindings 일괄 조회' },
                  query: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '쿼리 결과' },
        },
      },
    },
    '/api/runtime/shells/{projectId}': {
      get: {
        tags: ['Runtime'],
        summary: '퍼블리시된 Shell 정의 조회',
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Shell 정의' },
          404: { description: 'Shell 없음' },
        },
      },
    },
    '/api/runtime/shells/{projectId}/events': {
      post: {
        tags: ['Runtime'],
        summary: 'Shell 이벤트 실행 → UIPatch 반환',
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['controlId', 'eventName', 'shellState'],
                properties: {
                  controlId: { type: 'string' },
                  eventName: { type: 'string' },
                  shellState: { type: 'object' },
                  appState: { type: 'object' },
                  eventArgs: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'UIPatch 배열' },
        },
      },
    },
    '/api/runtime/app/{projectId}': {
      get: {
        tags: ['Runtime'],
        summary: 'App 로드 (Shell + 시작 폼 일괄 반환)',
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
          {
            name: 'formId',
            in: 'query',
            schema: { type: 'string' },
            description: '시작 폼 ID 직접 지정 (shell.startFormId 오버라이드)',
          },
        ],
        responses: {
          200: {
            description: 'Shell + 시작 폼',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    shell: { type: 'object', nullable: true },
                    startForm: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── MongoDB ─────────────────────────────────────────────────────────
    '/api/runtime/mongodb/test-connection': {
      post: {
        tags: ['MongoDB'],
        summary: 'MongoDB 연결 테스트',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['connectionString', 'database'],
                properties: {
                  connectionString: { type: 'string' },
                  database: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '연결 테스트 결과' },
        },
      },
    },
    '/api/runtime/mongodb/query': {
      post: {
        tags: ['MongoDB'],
        summary: 'MongoDB 문서 조회',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['connectionString', 'database', 'collection'],
                properties: {
                  connectionString: { type: 'string' },
                  database: { type: 'string' },
                  collection: { type: 'string' },
                  filter: { type: 'object', default: {} },
                  skip: { type: 'integer', default: 0 },
                  limit: { type: 'integer', default: 100 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: '조회 결과',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { type: 'object' } },
                    totalCount: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/runtime/mongodb/insert': {
      post: {
        tags: ['MongoDB'],
        summary: 'MongoDB 문서 삽입',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['connectionString', 'database', 'collection', 'document'],
                properties: {
                  connectionString: { type: 'string' },
                  database: { type: 'string' },
                  collection: { type: 'string' },
                  document: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '삽입 결과' },
        },
      },
    },
    '/api/runtime/mongodb/update': {
      post: {
        tags: ['MongoDB'],
        summary: 'MongoDB 문서 수정',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['connectionString', 'database', 'collection', 'filter', 'update'],
                properties: {
                  connectionString: { type: 'string' },
                  database: { type: 'string' },
                  collection: { type: 'string' },
                  filter: { type: 'object' },
                  update: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '수정 결과' },
        },
      },
    },
    '/api/runtime/mongodb/delete': {
      post: {
        tags: ['MongoDB'],
        summary: 'MongoDB 문서 삭제',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['connectionString', 'database', 'collection', 'filter'],
                properties: {
                  connectionString: { type: 'string' },
                  database: { type: 'string' },
                  collection: { type: 'string' },
                  filter: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '삭제 결과' },
        },
      },
    },

    // ─── Debug ───────────────────────────────────────────────────────────
    '/api/debug/execute': {
      post: {
        tags: ['Debug'],
        summary: '코드 테스트 실행 (development 전용)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: {
                  code: { type: 'string' },
                  formState: { type: 'object' },
                  controlId: { type: 'string' },
                  debugMode: { type: 'boolean', default: true },
                  controls: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string' },
                        name: { type: 'string' },
                        properties: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: '실행 결과',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    logs: { type: 'array', items: { type: 'object' } },
                    traces: { type: 'array', items: { type: 'object' } },
                    controlChanges: { type: 'object' },
                    messages: { type: 'array', items: { type: 'object' } },
                    error: { type: 'string' },
                    errorLine: { type: 'integer' },
                    executionTime: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
