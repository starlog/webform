import type { DataBindingDefinition } from '@webform/common';

export function useDataBinding(
  _controlId: string,
  _bindings: DataBindingDefinition[],
): Record<string, unknown> {
  // 현재는 빈 객체 반환 (DataSource 서비스 구현 후 활성화)
  return {};
}
