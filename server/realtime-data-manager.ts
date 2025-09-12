import { WebSocketServer, WebSocket } from 'ws';

// External API integration interfaces
interface ExternalDataSource {
  id: string;
  name: string;
  endpoint: string;
  auth_type: 'api_key' | 'bearer' | 'basic';
  credentials: {
    api_key?: string;
    token?: string;
    username?: string;
    password?: string;
  };
  sync_interval: number; // minutes
  last_sync?: string;
  status: 'active' | 'inactive' | 'error';
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

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'data_update' | 'error' | 'ping';
  channel?: string;
  data?: any;
  timestamp: string;
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

export class RealtimeDataManager {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, Set<string>> = new Map(); // client -> subscribed channels
  private dataSources: Map<string, ExternalDataSource> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private dataQuality: DataQualityMetrics;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.dataQuality = {
      completeness: 95.2,
      accuracy: 98.1,
      timeliness: 92.5,
      consistency: 96.8,
      validity: 94.3,
      last_updated: new Date().toISOString(),
      anomalies_detected: 0,
      error_count: 0
    };
  }

  async initialize() {
    console.log('Initializing Realtime Data Manager...');
    
    // Setup mock external data sources
    this.setupMockDataSources();
    
    // Start data synchronization schedules
    this.startSyncSchedules();
    
    // Start data quality monitoring
    this.startDataQualityMonitoring();
    
    console.log('Realtime Data Manager initialized successfully');
  }

  private setupMockDataSources() {
    // Mock external analytics API
    this.dataSources.set('analytics_api', {
      id: 'analytics_api',
      name: 'Analytics Data API',
      endpoint: 'https://api.analytics.example.com/v1/data',
      auth_type: 'api_key',
      credentials: { api_key: 'mock_api_key_12345' },
      sync_interval: 5, // 5 minutes
      status: 'active'
    });

    // Mock customer data API
    this.dataSources.set('customer_api', {
      id: 'customer_api',
      name: 'Customer Management API',
      endpoint: 'https://api.crm.example.com/customers',
      auth_type: 'bearer',
      credentials: { token: 'mock_bearer_token_67890' },
      sync_interval: 15, // 15 minutes
      status: 'active'
    });

    // Mock product data API
    this.dataSources.set('product_api', {
      id: 'product_api',
      name: 'Product Catalog API',
      endpoint: 'https://api.products.example.com/catalog',
      auth_type: 'basic',
      credentials: { username: 'api_user', password: 'api_pass' },
      sync_interval: 30, // 30 minutes
      status: 'active'
    });
  }

  private startSyncSchedules() {
    this.dataSources.forEach((source, sourceId) => {
      if (source.status === 'active') {
        const interval = setInterval(() => {
          this.performDataSync(sourceId);
        }, source.sync_interval * 60 * 1000); // Convert to milliseconds
        
        this.syncIntervals.set(sourceId, interval);
        console.log(`Started sync schedule for ${source.name} (every ${source.sync_interval} minutes)`);
      }
    });
  }

  private startDataQualityMonitoring() {
    // Monitor data quality every 2 minutes
    setInterval(() => {
      this.updateDataQualityMetrics();
    }, 2 * 60 * 1000);
  }

  async performDataSync(sourceId: string) {
    const source = this.dataSources.get(sourceId);
    if (!source) return;

    try {
      console.log(`Syncing data from ${source.name}...`);
      
      // Mock API call simulation
      const mockData = this.generateMockApiResponse(sourceId);
      
      // Update last sync time
      source.last_sync = new Date().toISOString();
      
      // Broadcast data update to subscribed clients
      this.broadcastDataUpdate(sourceId, mockData);
      
      console.log(`Successfully synced data from ${source.name}`);
      
    } catch (error) {
      console.error(`Failed to sync data from ${source.name}:`, error);
      source.status = 'error';
      this.dataQuality.error_count++;
    }
  }

  private generateMockApiResponse(sourceId: string) {
    const timestamp = new Date().toISOString();
    
    switch (sourceId) {
      case 'analytics_api':
        return {
          type: 'analytics_update',
          data: {
            daily_revenue: Math.floor(Math.random() * 50000) + 100000,
            daily_orders: Math.floor(Math.random() * 500) + 200,
            conversion_rate: (Math.random() * 2 + 3).toFixed(2), // 3-5%
            bounce_rate: (Math.random() * 20 + 40).toFixed(1), // 40-60%
            page_views: Math.floor(Math.random() * 10000) + 5000,
            timestamp
          }
        };
      
      case 'customer_api':
        return {
          type: 'customer_update',
          data: {
            new_customers: Math.floor(Math.random() * 50) + 10,
            customer_satisfaction: (Math.random() * 1 + 4).toFixed(1), // 4-5 stars
            churn_rate: (Math.random() * 2 + 1).toFixed(2), // 1-3%
            lifetime_value: Math.floor(Math.random() * 2000) + 3000,
            timestamp
          }
        };
      
      case 'product_api':
        return {
          type: 'product_update',
          data: {
            inventory_changes: Math.floor(Math.random() * 20) + 5,
            price_updates: Math.floor(Math.random() * 10) + 2,
            new_products: Math.floor(Math.random() * 3),
            discontinued_products: Math.floor(Math.random() * 2),
            top_selling_category: ['Electronics', 'Clothing', 'Home', 'Books'][Math.floor(Math.random() * 4)],
            timestamp
          }
        };
      
      default:
        return { type: 'unknown', data: {}, timestamp };
    }
  }

  private updateDataQualityMetrics() {
    // Simulate data quality metrics updates
    this.dataQuality = {
      completeness: Math.min(100, this.dataQuality.completeness + (Math.random() - 0.5) * 2),
      accuracy: Math.min(100, this.dataQuality.accuracy + (Math.random() - 0.5) * 1),
      timeliness: Math.min(100, this.dataQuality.timeliness + (Math.random() - 0.5) * 3),
      consistency: Math.min(100, this.dataQuality.consistency + (Math.random() - 0.5) * 1.5),
      validity: Math.min(100, this.dataQuality.validity + (Math.random() - 0.5) * 2),
      last_updated: new Date().toISOString(),
      anomalies_detected: this.dataQuality.anomalies_detected + (Math.random() > 0.95 ? 1 : 0),
      error_count: this.dataQuality.error_count
    };

    // Broadcast quality metrics to monitoring clients
    this.broadcastDataUpdate('data_quality', {
      type: 'quality_metrics',
      data: this.dataQuality
    });
  }

  handleClientMessage(ws: WebSocket, message: WebSocketMessage) {
    switch (message.type) {
      case 'subscribe':
        this.subscribeClient(ws, message.channel!);
        break;
      
      case 'unsubscribe':
        this.unsubscribeClient(ws, message.channel!);
        break;
      
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString()
        }));
        break;
      
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private subscribeClient(ws: WebSocket, channel: string) {
    if (!this.clients.has(ws)) {
      this.clients.set(ws, new Set());
    }
    
    this.clients.get(ws)!.add(channel);
    console.log(`Client subscribed to channel: ${channel}`);
    
    ws.send(JSON.stringify({
      type: 'subscription_confirmed',
      channel,
      timestamp: new Date().toISOString()
    }));
  }

  private unsubscribeClient(ws: WebSocket, channel: string) {
    const clientChannels = this.clients.get(ws);
    if (clientChannels) {
      clientChannels.delete(channel);
      console.log(`Client unsubscribed from channel: ${channel}`);
    }
  }

  handleClientDisconnect(ws: WebSocket) {
    this.clients.delete(ws);
    console.log('Client removed from subscribers');
  }

  private broadcastDataUpdate(channel: string, data: any) {
    const message = JSON.stringify({
      type: 'data_update',
      channel,
      data,
      timestamp: new Date().toISOString()
    });

    this.clients.forEach((channels, ws) => {
      if (channels.has(channel) || channels.has('all')) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    });
  }

  processWebhookData(source: string, data: any, timestamp: string) {
    console.log(`Processing webhook data from ${source}:`, data);
    
    // Validate and process webhook data
    if (this.validateWebhookData(source, data)) {
      this.broadcastDataUpdate(`webhook_${source}`, {
        type: 'webhook_data',
        source,
        data,
        timestamp
      });
    } else {
      this.dataQuality.error_count++;
      console.error(`Invalid webhook data from ${source}`);
    }
  }

  private validateWebhookData(source: string, data: any): boolean {
    // Basic validation - in production, this would be more comprehensive
    return data && typeof data === 'object' && Object.keys(data).length > 0;
  }

  async triggerSync(source?: string) {
    if (source) {
      await this.performDataSync(source);
    } else {
      // Sync all active sources
      const sourceIds = Array.from(this.dataSources.keys());
      for (const sourceId of sourceIds) {
        await this.performDataSync(sourceId);
      }
    }
  }

  getConnectionStatus(): ConnectionStatus {
    const apiStatuses = Array.from(this.dataSources.values()).map(source => ({
      source: source.name,
      status: source.status as 'connected' | 'disconnected' | 'error',
      last_ping: source.last_sync || 'Never'
    }));

    return {
      websocket_clients: this.clients.size,
      external_apis: apiStatuses,
      sync_status: {
        last_full_sync: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        next_scheduled_sync: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
        sync_errors: this.dataQuality.error_count
      }
    };
  }

  getDataQualityMetrics(): DataQualityMetrics {
    return { ...this.dataQuality };
  }

  // API authentication management
  updateDataSourceCredentials(sourceId: string, credentials: any) {
    const source = this.dataSources.get(sourceId);
    if (source) {
      source.credentials = { ...source.credentials, ...credentials };
      console.log(`Updated credentials for ${source.name}`);
    }
  }

  addDataSource(source: ExternalDataSource) {
    this.dataSources.set(source.id, source);
    
    if (source.status === 'active') {
      const interval = setInterval(() => {
        this.performDataSync(source.id);
      }, source.sync_interval * 60 * 1000);
      
      this.syncIntervals.set(source.id, interval);
    }
    
    console.log(`Added new data source: ${source.name}`);
  }

  removeDataSource(sourceId: string) {
    const interval = this.syncIntervals.get(sourceId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(sourceId);
    }
    
    this.dataSources.delete(sourceId);
    console.log(`Removed data source: ${sourceId}`);
  }
}