import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { RealtimeDataManager } from "./realtime-data-manager";

export async function registerRoutes(app: Express): Promise<Server> {
  // External API integration routes
  app.post('/api/external/webhook', (req, res) => {
    try {
      // Handle external data webhooks
      const { source, data, timestamp } = req.body;
      realtimeManager.processWebhookData(source, data, timestamp);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  app.post('/api/external/sync', async (req, res) => {
    try {
      // Manual data sync trigger
      const { source } = req.body;
      await realtimeManager.triggerSync(source);
      res.json({ success: true, message: 'Sync initiated' });
    } catch (error) {
      res.status(500).json({ error: 'Sync trigger failed' });
    }
  });

  app.get('/api/external/status', (req, res) => {
    // API connection status
    const status = realtimeManager.getConnectionStatus();
    res.json(status);
  });

  // Data quality monitoring endpoints
  app.get('/api/data-quality/metrics', (req, res) => {
    const metrics = realtimeManager.getDataQualityMetrics();
    res.json(metrics);
  });

  const httpServer = createServer(app);

  // Setup WebSocket server for real-time updates on specific path
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/realtime'
  });
  const realtimeManager = new RealtimeDataManager(wss);

  wss.on('connection', (ws, req) => {
    console.log('Client connected to realtime WebSocket');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        realtimeManager.handleClientMessage(ws, data);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
      realtimeManager.handleClientDisconnect(ws);
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      timestamp: new Date().toISOString()
    }));
  });

  // Start real-time data synchronization
  await realtimeManager.initialize();

  return httpServer;
}
