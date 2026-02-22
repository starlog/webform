import type { RuntimeWsMessage } from '@webform/common';

type WsEventCallback = (message: RuntimeWsMessage) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private listeners: WsEventCallback[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(formId: string): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/runtime/${formId}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data) as RuntimeWsMessage;
      this.listeners.forEach((cb) => cb(message));
    };

    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(formId), 5000);
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  onMessage(callback: WsEventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.listeners = [];
  }
}

export const wsClient = new WsClient();
