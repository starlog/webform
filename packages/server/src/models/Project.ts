import mongoose, { Schema } from 'mongoose';

export interface ProjectDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
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
