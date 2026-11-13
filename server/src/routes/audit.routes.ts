import { Router } from 'express';
import { z } from 'zod';
import type { AuditService } from '../services/audit.service.js';

const clientAuditEventSchema = z.object({
  actorId: z.string().trim().min(1).max(128),
  action: z.enum([
    'VAULT_UNLOCK',
    'VAULT_LOCK',
    'DECRYPT_SUCCESS',
    'DECRYPT_FAILED',
    'INTEGRITY_CHECK',
  ]),
  resourceId: z.string().max(128).nullable().optional(),
  details: z.string().max(1024).nullable().optional(),
});

export function createAuditRouter(auditService: AuditService): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const limit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 100;
    const offset = typeof req.query.offset === 'string' ? Number.parseInt(req.query.offset, 10) : 0;
    const order = req.query.order === 'asc' ? 'asc' : 'desc';

    const logs = auditService.listLogs({
      limit: Number.isNaN(limit) ? 100 : limit,
      offset: Number.isNaN(offset) ? 0 : offset,
      order,
    });

    res.json({ logs });
  });

  router.get('/verify', (_req, res) => {
    const verification = auditService.verifyChain();
    res.json({ verification });
  });

  router.post('/events', (req, res) => {
    const parsed = clientAuditEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid audit event payload',
        details: parsed.error.flatten(),
      });
      return;
    }

    const entry = auditService.appendLog({
      actorId: parsed.data.actorId,
      action: parsed.data.action,
      resourceId: parsed.data.resourceId ?? null,
      details: parsed.data.details ?? null,
    });

    res.status(201).json({ entry });
  });

  return router;
}
