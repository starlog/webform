import { createRequire } from 'node:module';
import { Theme } from '../models/Theme.js';

const require = createRequire(import.meta.url);
const presetThemes: Array<{ presetId: string; name: string; tokens: Record<string, unknown> }> =
  require('../data/preset-themes.json');

export async function seedThemes(): Promise<void> {
  let upserted = 0;
  let unchanged = 0;

  for (const entry of presetThemes) {
    const result = await Theme.updateOne(
      { presetId: entry.presetId },
      {
        $set: {
          name: entry.name,
          tokens: entry.tokens,
          isPreset: true,
          updatedBy: 'system',
        },
        $setOnInsert: {
          presetId: entry.presetId,
          createdBy: 'system',
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

  console.log(
    `[seed] Preset themes: ${upserted} upserted, ${unchanged} unchanged (${presetThemes.length} total)`,
  );
}
