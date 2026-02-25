import { Router } from 'express';
import { ThemeService } from '../services/ThemeService.js';
import { Theme } from '../models/Theme.js';
import {
  createThemeSchema,
  updateThemeSchema,
  listThemesQuerySchema,
  seedThemesSchema,
} from '../validators/themeValidator.js';

export const themesRouter = Router();
const themeService = new ThemeService();

// POST /api/themes/seed — 프리셋 테마 시딩 (관리자 전용)
themesRouter.post('/seed', async (req, res, next) => {
  try {
    const { themes } = seedThemesSchema.parse(req.body);
    let upserted = 0;
    let unchanged = 0;

    for (const entry of themes) {
      const result = await Theme.updateOne(
        { presetId: entry.presetId },
        {
          $set: {
            name: entry.name,
            tokens: entry.tokens,
            isPreset: true,
            updatedBy: req.user!.sub,
          },
          $setOnInsert: {
            presetId: entry.presetId,
            createdBy: req.user!.sub,
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount > 0 || result.modifiedCount > 0) {
        upserted++;
      } else {
        unchanged++;
      }
    }

    res.json({ upserted, unchanged, total: themes.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/themes — 커스텀 테마 목록
themesRouter.get('/', async (req, res, next) => {
  try {
    const query = listThemesQuerySchema.parse(req.query);
    const result = await themeService.list(query.page, query.limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/themes — 커스텀 테마 생성
themesRouter.post('/', async (req, res, next) => {
  try {
    const input = createThemeSchema.parse(req.body);
    const theme = await themeService.create(input, req.user!.sub);
    res.status(201).json({ data: theme });
  } catch (err) {
    next(err);
  }
});

// GET /api/themes/:id — 커스텀 테마 조회
themesRouter.get('/:id', async (req, res, next) => {
  try {
    const theme = await themeService.getById(req.params.id);
    res.json({ data: theme });
  } catch (err) {
    next(err);
  }
});

// PUT /api/themes/:id — 커스텀 테마 수정
themesRouter.put('/:id', async (req, res, next) => {
  try {
    const input = updateThemeSchema.parse(req.body);
    const theme = await themeService.update(req.params.id, input, req.user!.sub);
    res.json({ data: theme });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/themes/:id — 커스텀 테마 삭제 (소프트)
themesRouter.delete('/:id', async (req, res, next) => {
  try {
    await themeService.softDelete(req.params.id, req.user!.sub);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
