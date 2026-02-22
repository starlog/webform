import type { RuntimeWsMessage } from '@webform/common';
import type { RuntimeState } from '../stores/runtimeStore';

type WsClientType = { onMessage: (cb: (msg: RuntimeWsMessage) => void) => () => void };

export function setupPatchListener(
  runtimeStore: Pick<RuntimeState, 'applyPatches'>,
  wsClientInstance: WsClientType,
): () => void {
  return wsClientInstance.onMessage((message) => {
    switch (message.type) {
      case 'uiPatch':
        runtimeStore.applyPatches(message.payload);
        break;
      case 'dataRefresh':
        console.log('dataRefresh received:', message.payload);
        break;
      case 'error':
        console.error('Server error:', message.payload);
        break;
      case 'eventResult':
        if (message.payload.patches) {
          runtimeStore.applyPatches(message.payload.patches);
        }
        break;
    }
  });
}
