import { Theme } from '../models/Theme.js';
import type { ThemeDocument } from '../models/Theme.js';
import type { CreateThemeInput, UpdateThemeInput } from '../validators/themeValidator.js';
import { NotFoundError } from '../middleware/errorHandler.js';

export class ThemeService {
  async create(input: CreateThemeInput, userId: string): Promise<ThemeDocument> {
    const theme = new Theme({
      name: input.name,
      basePreset: input.basePreset,
      tokens: input.tokens,
      createdBy: userId,
      updatedBy: userId,
    });
    return theme.save();
  }

  async getById(id: string): Promise<ThemeDocument> {
    const theme = await Theme.findOne({ _id: id, deletedAt: null });
    if (!theme) throw new NotFoundError('Theme not found');
    return theme;
  }

  async list(page: number, limit: number) {
    const filter = { deletedAt: null };
    const [themes, total] = await Promise.all([
      Theme.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Theme.countDocuments(filter),
    ]);
    return {
      data: themes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, input: UpdateThemeInput, userId: string): Promise<ThemeDocument> {
    const theme = await Theme.findOne({ _id: id, deletedAt: null });
    if (!theme) throw new NotFoundError('Theme not found');

    if (input.name !== undefined) theme.name = input.name;
    if (input.tokens !== undefined) {
      theme.tokens = input.tokens as unknown as ThemeDocument['tokens'];
      theme.markModified('tokens');
    }
    theme.updatedBy = userId;
    return theme.save();
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const theme = await Theme.findOne({ _id: id, deletedAt: null });
    if (!theme) throw new NotFoundError('Theme not found');
    theme.deletedAt = new Date();
    theme.updatedBy = userId;
    await theme.save();
  }
}
