
import { LegionMessage, LegionRole, DeviceTelemetry } from '../types';

export type ConnectivityProtocol = 'WIFI' | 'BLUETOOTH';

class LegionService {
  private socket: WebSocket | null = null;
  private role: LegionRole | null = null;
  private protocol: ConnectivityProtocol = 'WIFI';
  private deviceId: string = crypto.randomUUID();
  private syncOffset: number = 0;
  private onMessageCallback: ((msg: LegionMessage) => void) | null = null;
  private onTelemetryCallback: ((devices: DeviceTelemetry[]) => void) | null = null;
  private heartbeatInterval: number | null = null;
  private devices: Map<string, DeviceTelemetry> = new Map();

  async initialize(role: LegionRole, protocol: ConnectivityProtocol = 'WIFI', targetIp?: string): Promise<void> {
    this.role = role;
    this.protocol = protocol;
    this.stopHeartbeat();

    if (role === 'CENTURION' && targetIp) {
      const port = protocol === 'WIFI' ? '8080' : '8081';
      this.socket = new WebSocket(`ws://${targetIp}:${port}/legion`);
      this.socket.onopen = () => {
        this.sendCommand('HANDSHAKE', { name: `Node_${this.deviceId.slice(0, 4)}`, protocol });
        this.startHeartbeat();
      };
      this.socket.onmessage = (event) => {
        try {
          const msg: LegionMessage = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) { console.error("Legion Protocol Error", e); }
      };
    } else {
      this.startHeartbeat();
    }
  }

  private handleMessage(msg: LegionMessage) {
    if (msg.senderId === this.deviceId) return;

    const localNow = Date.now();
    if (msg.type === 'SYNC' || msg.type === 'HEARTBEAT') {
      this.syncOffset = localNow - msg.timestamp;
    }

    if (msg.type === 'TELEMETRY' || msg.type === 'HANDSHAKE') {
      this.devices.set(msg.senderId, {
        id: msg.senderId,
        name: msg.payload?.name || 'Vanguard Node',
        role: 'CENTURION',
        status: msg.payload?.status || 'ONLINE',
        currentLens: msg.payload?.lens || 'STANDARD',
        previewFrame: msg.payload?.preview,
        lastPing: localNow
      });
      this.notifyTelemetry();
    }

    if (this.onMessageCallback) {
      this.onMessageCallback(msg);
    }
  }

  private notifyTelemetry() {
    if (this.onTelemetryCallback) {
      this.onTelemetryCallback(Array.from(this.devices.values()));
    }
  }

  onMessage(callback: (msg: LegionMessage) => void) {
    this.onMessageCallback = callback;
    return () => { this.onMessageCallback = null; };
  }

  onTelemetryUpdate(callback: (devices: DeviceTelemetry[]) => void) {
    this.onTelemetryCallback = callback;
    return () => { this.onTelemetryCallback = null; };
  }

  sendCommand(type: LegionMessage['type'], payload?: any) {
    const msg: LegionMessage = {
      type,
      timestamp: Date.now(),
      senderId: this.deviceId,
      payload
    };

    const msgString = JSON.stringify(msg);
    const win = window as any;

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(msgString);
    } else if (this.role === 'LEGATUS') {
      if (win.Capacitor?.Plugins?.LegionLink) {
        win.Capacitor.Plugins.LegionLink.broadcastCommand({
          type: msg.type,
          payload: msg.payload,
          protocol: this.protocol
        });
      }
      
      // Decoupled loopback to avoid call stack overflow on master node
      setTimeout(() => {
        if (this.onMessageCallback) this.onMessageCallback(msg);
      }, 0);
    }
  }

  startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = window.setInterval(() => {
      this.sendCommand('HEARTBEAT', { 
        status: 'ONLINE', 
        name: `Node_${this.deviceId.slice(0, 4)}`,
        protocol: this.protocol
      });
      
      const now = Date.now();
      let changed = false;
      this.devices.forEach((d, id) => {
        if (now - d.lastPing > 15000) {
          this.devices.delete(id);
          changed = true;
        }
      });
      if (changed) this.notifyTelemetry();
    }, 5000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  getSynchronizedTime() { return Date.now() - this.syncOffset; }
  getConnectedDevices() { return Array.from(this.devices.values()); }
  getProtocol() { return this.protocol; }
  getDeviceId() { return this.deviceId; }
}

export const legionService = new LegionService();
