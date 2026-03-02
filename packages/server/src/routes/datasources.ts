import { Router } from 'express';
import { DataSourceService } from '../services/DataSourceService.js';
import { adapterRegistry } from '../services/adapters/index.js';
import {
  createDataSourceSchema,
  updateDataSourceSchema,
  listDataSourcesQuerySchema,
  executeQuerySchema,
} from '../validators/datasourceValidator.js';

export const datasourcesRouter = Router();
const dataSourceService = new DataSourceService();

// GET /api/datasources/dialects — 지원 dialect 목록
datasourcesRouter.get('/dialects', (_req, res) => {
  res.json({ data: adapterRegistry.listDialects() });
});

// GET /api/datasources — 데이터소스 목록
datasourcesRouter.get('/', async (req, res, next) => {
  try {
    const query = listDataSourcesQuerySchema.parse(req.query);
    const { data, total } = await dataSourceService.listDataSources(query);
    const totalPages = Math.ceil(total / query.limit);
    res.json({
      data,
      meta: { total, page: query.page, limit: query.limit, totalPages },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/datasources — 데이터소스 생성
datasourcesRouter.post('/', async (req, res, next) => {
  try {
    const input = createDataSourceSchema.parse(req.body);
    const ds = await dataSourceService.createDataSource(input, req.user!.sub);
    res.status(201).json({ data: ds });
  } catch (err) {
    next(err);
  }
});

// GET /api/datasources/:id — 단일 조회 (config 복호화)
datasourcesRouter.get('/:id', async (req, res, next) => {
  try {
    const ds = await dataSourceService.getDataSource(req.params.id);
    res.json({ data: ds });
  } catch (err) {
    next(err);
  }
});

// PUT /api/datasources/:id — 수정 (config 재암호화)
datasourcesRouter.put('/:id', async (req, res, next) => {
  try {
    const input = updateDataSourceSchema.parse(req.body);
    const ds = await dataSourceService.updateDataSource(
      req.params.id,
      input,
      req.user!.sub,
    );
    res.json({ data: ds });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/datasources/:id — Soft delete
datasourcesRouter.delete('/:id', async (req, res, next) => {
  try {
    await dataSourceService.deleteDataSource(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/datasources/:id/tables — 테이블/컬렉션 목록
datasourcesRouter.get('/:id/tables', async (req, res, next) => {
  try {
    const tables = await dataSourceService.listTables(req.params.id);
    res.json({ data: tables });
  } catch (err) {
    next(err);
  }
});

// POST /api/datasources/:id/test — 연결 테스트
datasourcesRouter.post('/:id/test', async (req, res, next) => {
  try {
    const result = await dataSourceService.testConnection(req.params.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/datasources/:id/raw-query — Raw 쿼리 실행 (SQL SELECT / MongoDB JSON)
datasourcesRouter.post('/:id/raw-query', async (req, res, next) => {
  try {
    const { query } = req.body as { query?: string };
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query (string) is required' });
    }
    const results = await dataSourceService.executeRawQuery(req.params.id, query);
    res.json({ data: results });
  } catch (err) {
    next(err);
  }
});

// POST /api/datasources/:id/query — 쿼리 실행
datasourcesRouter.post('/:id/query', async (req, res, next) => {
  try {
    const query = executeQuerySchema.parse(req.body);
    const results = await dataSourceService.executeQuery(req.params.id, query);
    res.json({ data: results });
  } catch (err) {
    next(err);
  }
});
