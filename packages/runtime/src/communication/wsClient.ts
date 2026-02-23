import type { RuntimeWsMessage } from '@webform/common';

type WsEventCallback = (message: RuntimeWsMessage) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private listeners: WsEventCallback[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentPath: string | null = null;

  connect(formId: string): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const path = `/ws/runtime/${formId}`;
    this.currentPath = path;
    const url = `${protocol}//${window.location.host}${path}`;
    this.setupWebSocket(url, () => this.connect(formId));
  }

  connectApp(projectId: string): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const path = `/ws/runtime/app/${projectId}`;
    this.currentPath = path;
    const url = `${protocol}//${window.location.host}${path}`;
    this.setupWebSocket(url, () => this.connectApp(projectId));
  }

  send(message: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  onMessage(callback: WsEventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  disconnect(): void {
    this.currentPath = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.listeners = [];
  }

  private setupWebSocket(url: string, reconnect: () => void): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();

    this.ws = new WebSocket(url);

    this.ws.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data) as RuntimeWsMessage;
      this.listeners.forEach((cb) => cb(message));
    };

    this.ws.onclose = () => {
      const pathAtConnect = this.currentPath;
      this.reconnectTimer = setTimeout(() => {
        if (this.currentPath === pathAtConnect) reconnect();
      }, 5000);
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }
}

export const wsClient = new WsClient();
