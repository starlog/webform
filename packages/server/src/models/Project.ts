import mongoose, { Schema } from 'mongoose';

export interface ProjectDefaultFont {
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
}

export interface ProjectDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  defaultFont?: ProjectDefaultFont;
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    defaultFont: {
      type: {
        family: { type: String, required: true },
        size: { type: Number, required: true },
        bold: { type: Boolean, required: true },
        italic: { type: Boolean, required: true },
        underline: { type: Boolean, required: true },
        strikethrough: { type: Boolean, required: true },
      },
      default: undefined,
      _id: false,
    },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

projectSchema.index({ deletedAt: 1 });
projectSchema.index({ name: 'text' });
projectSchema.index({ createdAt: -1 });

export const Project = mongoose.model<ProjectDocument>('Project', projectSchema);
