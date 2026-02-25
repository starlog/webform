import { z } from 'zod';

export const createThemeSchema = z.object({
  name: z.string().min(1).max(200),
  basePreset: z.string().optional(),
  tokens: z.record(z.unknown()),
});

export type CreateThemeInput = z.infer<typeof createThemeSchema>;

export const updateThemeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  tokens: z.record(z.unknown()).optional(),
});

export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;

export const seedThemesSchema = z.object({
  themes: z
    .array(
      z.object({
        presetId: z.string().min(1),
        name: z.string().min(1).max(200),
        tokens: z.record(z.unknown()),
      }),
    )
    .min(1)
    .max(100),
});

export type SeedThemesInput = z.infer<typeof seedThemesSchema>;

export const listThemesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export type ListThemesQuery = z.infer<typeof listThemesQuerySchema>;
