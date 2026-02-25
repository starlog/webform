import { z } from 'zod';

export const createThemeSchema = z.object({
  name: z.string().min(1).max(200),
  basePreset: z.enum(['windows-xp', 'ubuntu-2004', 'macos-tahoe']),
  tokens: z.record(z.unknown()),
});

export type CreateThemeInput = z.infer<typeof createThemeSchema>;

export const updateThemeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  tokens: z.record(z.unknown()).optional(),
});

export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;

export const listThemesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type ListThemesQuery = z.infer<typeof listThemesQuerySchema>;
