export { adapterRegistry } from './AdapterRegistry.js';
export type { AdapterFactory } from './AdapterRegistry.js';
export type { DataSourceAdapter } from './types.js';

// — 어댑터 팩토리 등록 —
import { adapterRegistry } from './AdapterRegistry.js';
import { MongoDBAdapterFactory } from './MongoDBAdapter.js';

adapterRegistry.register(MongoDBAdapterFactory);
