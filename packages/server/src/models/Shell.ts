import mongoose, { Schema } from 'mongoose';
import type {
  ControlDefinition,
  EventHandlerDefinition,
  ShellProperties,
} from '@webform/common';

export interface ShellDocument {
  _id: mongoose.Types.ObjectId;
  projectId: string;
  name: string;
  version: number;
  properties: ShellProperties;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  startFormId?: string;
  published: boolean;
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const shellSchema = new Schema(
  {
    projectId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    version: { type: Number, default: 1 },
    properties: { type: Schema.Types.Mixed, required: true },
    controls: { type: [Schema.Types.Mixed], default: [] },
    eventHandlers: { type: [Schema.Types.Mixed], default: [] },
    startFormId: { type: String, default: undefined },
    published: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

shellSchema.index({ projectId: 1, deletedAt: 1 });
shellSchema.index({ published: 1 });

export const Shell = mongoose.model<ShellDocument>('Shell', shellSchema);
