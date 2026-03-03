import type { ThemeTokens } from '../types/theme.js';

/** 불완전한 토큰을 기본 테마와 deep merge하여 누락 속성을 채운다 */
export function mergeThemeWithDefaults(
  partial: Record<string, unknown>,
  defaults: ThemeTokens,
): ThemeTokens {
  const result = { ...defaults } as Record<string, unknown>;
  for (const key of Object.keys(partial)) {
    const val = partial[key];
    const def = (defaults as unknown as Record<string, unknown>)[key];
    if (val && def && typeof val === 'object' && typeof def === 'object' && !Array.isArray(val)) {
      result[key] = mergeThemeWithDefaults(
        val as Record<string, unknown>,
        def as unknown as ThemeTokens,
      );
    } else if (val !== undefined) {
      result[key] = val;
    }
  }
  return result as unknown as ThemeTokens;
}
