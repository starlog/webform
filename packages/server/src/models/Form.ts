import mongoose, { Schema } from 'mongoose';
import type {
  ControlDefinition,
  EventHandlerDefinition,
  DataBindingDefinition,
  FormProperties,
} from '@webform/common';

export interface FormVersionSnapshot {
  version: number;
  snapshot: {
    name: string;
    properties: FormProperties;
    controls: ControlDefinition[];
    eventHandlers: EventHandlerDefinition[];
    dataBindings: DataBindingDefinition[];
  };
  savedAt: Date;
}

export interface FormDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  version: number;
  projectId: string;
  status: 'draft' | 'published';
  publishedVersion?: number;
  properties: FormProperties;
  controls: ControlDefinition[];
  eventHandlers: EventHandlerDefinition[];
  dataBindings: DataBindingDefinition[];
  versions: FormVersionSnapshot[];
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const controlDefinitionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    name: { type: String, required: true },
    properties: { type: Schema.Types.Mixed, default: {} },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    size: {
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },
    children: { type: [Schema.Types.Mixed], default: [] },
    anchor: {
      top: { type: Boolean, default: true },
      bottom: { type: Boolean, default: false },
      left: { type: Boolean, default: true },
      right: { type: Boolean, default: false },
    },
    dock: { type: String, default: 'None' },
    tabIndex: { type: Number, default: 0 },
    visible: { type: Boolean, default: true },
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const formVersionSchema = new Schema(
  {
    version: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    savedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const formSchema = new Schema(
  {
    name: { type: String, required: true },
    version: { type: Number, default: 1 },
    projectId: { type: String, required: true, index: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedVersion: { type: Number },
    properties: {
      title: { type: String, default: '' },
      width: { type: Number, default: 800 },
      height: { type: Number, default: 600 },
      backgroundColor: { type: String, default: '#FFFFFF' },
      font: {
        family: { type: String, default: 'Segoe UI' },
        size: { type: Number, default: 9 },
        bold: { type: Boolean, default: false },
        italic: { type: Boolean, default: false },
        underline: { type: Boolean, default: false },
        strikethrough: { type: Boolean, default: false },
      },
      startPosition: { type: String, default: 'CenterScreen' },
      formBorderStyle: { type: String, default: 'Sizable' },
      maximizeBox: { type: Boolean, default: true },
      minimizeBox: { type: Boolean, default: true },
      windowState: { type: String, enum: ['Normal', 'Maximized'], default: 'Normal' },
      theme: { type: String },
    },
    controls: { type: [controlDefinitionSchema], default: [] },
    eventHandlers: { type: [Schema.Types.Mixed], default: [] },
    dataBindings: { type: [Schema.Types.Mixed], default: [] },
    versions: { type: [formVersionSchema], default: [] },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

formSchema.index({ projectId: 1, deletedAt: 1 });
formSchema.index({ status: 1 });
formSchema.index({ name: 'text' });
formSchema.index({ createdAt: -1 });

export const Form = mongoose.model<FormDocument>('Form', formSchema);
