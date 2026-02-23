import type { ControlDefinition } from '../types/form';

/**
 * 중첩된 children 구조를 평면 배열로 변환 (로드 시)
 * 자식 position을 부모 기준 → 폼 기준(절대좌표)으로 변환하고 _parentId 부여
 */
export function flattenControls(controls: ControlDefinition[]): ControlDefinition[] {
  const result: ControlDefinition[] = [];
  function walk(ctrls: ControlDefinition[], parentId: string | null, offsetX: number, offsetY: number) {
    for (const ctrl of ctrls) {
      const children = ctrl.children;
      const flatCtrl: ControlDefinition = {
        ...ctrl,
        position: {
          x: ctrl.position.x + offsetX,
          y: ctrl.position.y + offsetY,
        },
        properties: parentId
          ? { ...ctrl.properties, _parentId: parentId }
          : { ...ctrl.properties },
        children: undefined,
      };
      result.push(flatCtrl);
      if (children && children.length > 0) {
        walk(children, ctrl.id, flatCtrl.position.x, flatCtrl.position.y);
      }
    }
  }
  walk(controls, null, 0, 0);
  return result;
}

/**
 * 평면 배열을 중첩 children 구조로 복원 (저장 시)
 * 자식 position을 폼 기준(절대좌표) → 부모 기준(상대좌표)으로 변환
 */
export function nestControls(controls: ControlDefinition[]): ControlDefinition[] {
  const childrenMap = new Map<string, ControlDefinition[]>();
  const topLevel: ControlDefinition[] = [];

  for (const ctrl of controls) {
    const parentId = ctrl.properties._parentId as string | undefined;
    if (parentId) {
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
      childrenMap.get(parentId)!.push(ctrl);
    } else {
      topLevel.push(ctrl);
    }
  }

  function buildTree(ctrl: ControlDefinition): ControlDefinition {
    const props = { ...ctrl.properties };
    delete props._parentId;
    const result: ControlDefinition = { ...ctrl, properties: props };

    const children = childrenMap.get(ctrl.id);
    if (children && children.length > 0) {
      result.children = children.map((child) => {
        const nested = buildTree(child);
        return {
          ...nested,
          position: {
            x: child.position.x - ctrl.position.x,
            y: child.position.y - ctrl.position.y,
          },
        };
      });
    } else {
      result.children = undefined;
    }
    return result;
  }

  return topLevel.map(buildTree);
}
