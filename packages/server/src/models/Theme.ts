import mongoose, { Schema } from 'mongoose';
import type { ThemeTokens } from '@webform/common';

export interface ThemeDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  basePreset?: string;
  tokens: ThemeTokens;
  isPreset: boolean;
  presetId?: string;
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const themeSchema = new Schema(
  {
    name: { type: String, required: true },
    basePreset: { type: String },
    tokens: { type: Schema.Types.Mixed, required: true },
    isPreset: { type: Boolean, default: false },
    presetId: { type: String, unique: true, sparse: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

themeSchema.index({ deletedAt: 1 });
themeSchema.index({ isPreset: 1 });

export const Theme = mongoose.model<ThemeDocument>('Theme', themeSchema);
