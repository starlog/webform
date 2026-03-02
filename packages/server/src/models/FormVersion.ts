import mongoose, { Schema } from 'mongoose';
import type {
  ControlDefinition,
  EventHandlerDefinition,
  FormProperties,
} from '@webform/common';

export interface FormVersionDocument {
  _id: mongoose.Types.ObjectId;
  formId: string;
  version: number;
  note: string;
  snapshot: {
    name: string;
    properties: FormProperties;
    controls: ControlDefinition[];
    eventHandlers: EventHandlerDefinition[];
  };
  savedAt: Date;
  savedBy: string;
}

const formVersionSchema = new Schema(
  {
    formId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    note: { type: String, default: 'Auto-save' },
    snapshot: { type: Schema.Types.Mixed, required: true },
    savedAt: { type: Date, default: Date.now },
    savedBy: { type: String, required: true },
  },
  { timestamps: false },
);

formVersionSchema.index({ formId: 1, version: -1 }, { unique: true });
formVersionSchema.index({ formId: 1, savedAt: -1 });

export const FormVersion = mongoose.model<FormVersionDocument>('FormVersion', formVersionSchema);
