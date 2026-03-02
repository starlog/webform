import type { DataSourceAdapter } from './types.js';

export interface AdapterFactory {
  dialect: string;
  displayName: string;
  create(config: Record<string, unknown>): DataSourceAdapter;
}

export class AdapterRegistry {
  private factories = new Map<string, AdapterFactory>();

  register(factory: AdapterFactory): void {
    if (this.factories.has(factory.dialect)) {
      throw new Error(`AdapterRegistry: dialect '${factory.dialect}' is already registered`);
    }
    this.factories.set(factory.dialect, factory);
  }

  create(dialect: string, config: Record<string, unknown>): DataSourceAdapter {
    const factory = this.factories.get(dialect);
    if (!factory) {
      throw new Error(`AdapterRegistry: unsupported dialect '${dialect}'`);
    }
    return factory.create(config);
  }

  listDialects(): Array<{ dialect: string; displayName: string }> {
    return Array.from(this.factories.values()).map((f) => ({
      dialect: f.dialect,
      displayName: f.displayName,
    }));
  }

  has(dialect: string): boolean {
    return this.factories.has(dialect);
  }
}

export const adapterRegistry = new AdapterRegistry();
