import { timingSafeEqual } from "crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { RealtimeDataManager } from "./realtime-data-manager";

const SOURCE_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function getBearerToken(authorization: string | undefined): string | undefined {
  const match = authorization?.match(/^Bearer (.+)$/i);
  return match?.[1];
}

function tokenIsValid(candidate: string | undefined): boolean {
  const expected = process.env.REALTIME_API_TOKEN;
  if (!expected || !candidate) return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length
    && timingSafeEqual(candidateBuffer, expectedBuffer);
}

function requireRealtimeToken(req: Request, res: Response, next: NextFunction) {
  if (!process.env.REALTIME_API_TOKEN) {
    return res.status(503).json({ error: "Realtime integrations are not configured" });
  }
  if (!tokenIsValid(getBearerToken(req.get("authorization")))) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function isValidSource(source: unknown): source is string {
  return typeof source === "string" && SOURCE_PATTERN.test(source);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // External API integration routes
  app.post('/api/external/webhook', requireRealtimeToken, (req, res) => {
    try {
      // Handle external data webhooks
      const { source, data, timestamp } = req.body ?? {};
      if (!isValidSource(source)
        || !data
        || typeof data !== "object"
        || Array.isArray(data)
        || Object.keys(data).length === 0
        || typeof timestamp !== "string"
        || Number.isNaN(Date.parse(timestamp))) {
        return res.status(400).json({ error: "Invalid webhook payload" });
      }
      realtimeManager.processWebhookData(source, data, timestamp);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  app.post('/api/external/sync', requireRealtimeToken, async (req, res) => {
    try {
      // Manual data sync trigger
      const { source } = req.body ?? {};
      if (source !== undefined && !isValidSource(source)) {
        return res.status(400).json({ error: "Invalid sync source" });
      }
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
    path: '/realtime',
    maxPayload: 16 * 1024,
    verifyClient: ({ req }, done) => {
      const requestUrl = new URL(req.url || "/realtime", "http://localhost");
      const authorization = typeof req.headers.authorization === "string"
        ? req.headers.authorization
        : undefined;
      const token = getBearerToken(authorization) || requestUrl.searchParams.get("token") || undefined;
      done(tokenIsValid(token), 401, "Unauthorized");
    },
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
