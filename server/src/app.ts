import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createDatabase, type SqliteDatabase } from './db/index.js';
import { AuditService } from './services/audit.service.js';
import { VaultService } from './services/vault.service.js';
import { createVaultRouter } from './routes/vault.routes.js';
import { createAuditRouter } from './routes/audit.routes.js';

export interface AppContext {
  app: Express;
  db: SqliteDatabase;
  auditService: AuditService;
  vaultService: VaultService;
}

export function createApp(existingDb?: SqliteDatabase): AppContext {
  const db = existingDb ?? createDatabase();
  const auditService = new AuditService(db);
  const vaultService = new VaultService(db, auditService);

  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? ['http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'x-actor-id'],
    })
  );
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'vault-guard-server', timestamp: new Date().toISOString() });
  });

  app.use('/api/vault', createVaultRouter(vaultService));
  app.use('/api/audit', createAuditRouter(auditService));

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[VaultGuard Server Error]', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return { app, db, auditService, vaultService };
}
