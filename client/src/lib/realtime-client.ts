// Real-time data client for WebSocket connections and external API integrations

interface RealtimeMessage {
  type: 'connection' | 'data_update' | 'subscription_confirmed' | 'error' | 'pong' | 'subscribe' | 'unsubscribe' | 'ping';
  channel?: string;
  data?: any;
  timestamp: string;
  source?: string;
}

interface ConnectionStatus {
  websocket_clients: number;
  external_apis: Array<{
    source: string;
    status: 'connected' | 'disconnected' | 'error';
    last_ping: string;
  }>;
  sync_status: {
    last_full_sync: string;
    next_scheduled_sync: string;
    sync_errors: number;
  };
}

interface DataQualityMetrics {
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  validity: number;
  last_updated: string;
  anomalies_detected: number;
  error_count: number;
}

type RealtimeCallback = (data: any) => void;

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions = new Map<string, Set<RealtimeCallback>>();
  private connectionListeners = new Set<(connected: boolean) => void>();
  private isConnected = false;

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      // Use wss:// for HTTPS, ws:// for HTTP
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/realtime`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionListeners(true);
        
        // Re-subscribe to channels after reconnection
        this.resubscribeAll();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: RealtimeMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.notifyConnectionListeners(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  private handleMessage(message: RealtimeMessage) {
    switch (message.type) {
      case 'connection':
        console.log('Connection confirmed:', message.data);
        break;

      case 'data_update':
        if (message.channel) {
          this.notifySubscribers(message.channel, message.data);
        }
        break;

      case 'subscription_confirmed':
        console.log(`Subscription confirmed for channel: ${message.channel}`);
        break;

      case 'error':
        console.error('Server error:', message.data);
        break;

      case 'pong':
        // Heart beat response
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private notifySubscribers(channel: string, data: any) {
    const callbacks = this.subscriptions.get(channel);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in subscription callback:', error);
        }
      });
    }
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
      console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnect attempts reached');
    }
  }

  private resubscribeAll() {
    this.subscriptions.forEach((_, channel) => {
      this.sendMessage({
        type: 'subscribe',
        channel,
        timestamp: new Date().toISOString()
      });
    });
  }

  private sendMessage(message: Partial<RealtimeMessage>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  // Public API
  subscribe(channel: string, callback: RealtimeCallback): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      
      // Send subscription message to server
      this.sendMessage({
        type: 'subscribe',
        channel,
        timestamp: new Date().toISOString()
      });
    }

    this.subscriptions.get(channel)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
          this.sendMessage({
            type: 'unsubscribe',
            channel,
            timestamp: new Date().toISOString()
          });
        }
      }
    };
  }

  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    
    // Immediately notify of current status
    listener(this.isConnected);
    
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  ping() {
    this.sendMessage({
      type: 'ping',
      timestamp: new Date().toISOString()
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  // API integration helpers
  async triggerExternalSync(source?: string): Promise<boolean> {
    try {
      const response = await fetch('/api/external/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to trigger external sync:', error);
      return false;
    }
  }

  async getConnectionStatus(): Promise<ConnectionStatus | null> {
    try {
      const response = await fetch('/api/external/status');
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to get connection status:', error);
    }
    return null;
  }

  async getDataQualityMetrics(): Promise<DataQualityMetrics | null> {
    try {
      const response = await fetch('/api/data-quality/metrics');
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to get data quality metrics:', error);
    }
    return null;
  }
}

// React hooks for real-time data
import { useState, useEffect, useCallback } from 'react';

export function useRealtimeData<T>(channel: string, initialValue: T): [T, boolean] {
  const [data, setData] = useState<T>(initialValue);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const client = realtimeClient;
    
    const unsubscribeConnection = client.onConnectionChange(setIsConnected);
    const unsubscribeData = client.subscribe(channel, (newData) => {
      setData(newData);
    });

    return () => {
      unsubscribeConnection();
      unsubscribeData();
    };
  }, [channel]);

  return [data, isConnected];
}

export function useConnectionStatus(): [ConnectionStatus | null, boolean] {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    const statusData = await realtimeClient.getConnectionStatus();
    setStatus(statusData);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return [status, isLoading];
}

export function useDataQualityMetrics(): [DataQualityMetrics | null, boolean] {
  const [metrics, setMetrics] = useState<DataQualityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Subscribe to real-time quality updates
    const unsubscribe = realtimeClient.subscribe('data_quality', (newMetrics) => {
      if (newMetrics.type === 'quality_metrics') {
        setMetrics(newMetrics.data);
      }
    });

    // Initial load
    realtimeClient.getDataQualityMetrics().then(initialMetrics => {
      setMetrics(initialMetrics);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  return [metrics, isLoading];
}

// Global instance
export const realtimeClient = new RealtimeClient();