import type { RuntimeWsMessage } from '@webform/common';
import type { RuntimeState } from '../stores/runtimeStore';

type WsClientType = { onMessage: (cb: (msg: RuntimeWsMessage) => void) => () => void };

export function setupPatchListener(
  runtimeStore: Pick<RuntimeState, 'applyPatches' | 'applyShellPatches'>,
  wsClientInstance: WsClientType,
): () => void {
  return wsClientInstance.onMessage((message) => {
    switch (message.type) {
      case 'uiPatch': {
        const scope = message.scope;
        if (scope === 'shell') {
          runtimeStore.applyShellPatches(message.payload);
        } else {
          runtimeStore.applyPatches(message.payload);
        }
        break;
      }
      case 'dataRefresh':
        console.log('dataRefresh received:', message.payload);
        break;
      case 'error':
        console.error('Server error:', message.payload);
        runtimeStore.applyPatches([{
          type: 'showDialog',
          target: '',
          payload: {
            title: '서버 오류',
            text: typeof message.payload === 'string'
              ? message.payload
              : JSON.stringify(message.payload),
            dialogType: 'error',
          },
        }]);
        break;
      case 'eventResult': {
        if (message.payload.patches) {
          const scope = (message as unknown as { scope?: string }).scope;
          if (scope === 'shell') {
            runtimeStore.applyShellPatches(message.payload.patches);
          } else {
            runtimeStore.applyPatches(message.payload.patches);
          }
        }
        break;
      }
    }
  });
}
