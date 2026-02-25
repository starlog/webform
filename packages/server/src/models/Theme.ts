import mongoose, { Schema } from 'mongoose';
import type { PresetThemeId, ThemeTokens } from '@webform/common';
import { PRESET_THEME_IDS } from '@webform/common';

export interface ThemeDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  basePreset: PresetThemeId;
  tokens: ThemeTokens;
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const themeSchema = new Schema(
  {
    name: { type: String, required: true },
    basePreset: {
      type: String,
      required: true,
      enum: [...PRESET_THEME_IDS],
    },
    tokens: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

themeSchema.index({ deletedAt: 1 });

export const Theme = mongoose.model<ThemeDocument>('Theme', themeSchema);
