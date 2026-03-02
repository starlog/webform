import mongoose, { Schema } from 'mongoose';

export interface DataSourceDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: 'database' | 'restApi' | 'static';
  description?: string;
  projectId: string;

  // 암호화된 config JSON 문자열 (database, restApi 타입)
  encryptedConfig?: string;

  // static 타입 전용 (암호화 불필요)
  staticData?: unknown[];

  // 메타데이터 (비민감 정보)
  meta: {
    dialect?: 'mongodb' | 'postgresql' | 'mysql' | 'mssql' | 'sqlite';
    baseUrl?: string;
  };

  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const dataSourceSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 200 },
    type: { type: String, required: true, enum: ['database', 'restApi', 'static'] },
    description: { type: String, default: '' },
    projectId: { type: String, required: true },
    encryptedConfig: { type: String, default: null },
    staticData: { type: Schema.Types.Mixed, default: null },
    meta: {
      dialect: { type: String, enum: ['mongodb', 'postgresql', 'mysql', 'mssql', 'sqlite'], default: null },
      baseUrl: { type: String, default: null },
    },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

dataSourceSchema.index({ projectId: 1, deletedAt: 1 });
dataSourceSchema.index({ type: 1 });
dataSourceSchema.index({ name: 'text' });

export const DataSource = mongoose.model<DataSourceDocument>('DataSource', dataSourceSchema);
