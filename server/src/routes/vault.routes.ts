import { Router } from 'express';
import { z } from 'zod';
import type { VaultService } from '../services/vault.service.js';

const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;

const createVaultRecordSchema = z.object({
  ownerId: z.string().trim().min(1, 'ownerId is required').max(128),
  ciphertext: z
    .string()
    .trim()
    .min(1, 'ciphertext is required')
    .regex(base64Regex, 'ciphertext must be valid base64'),
  iv: z
    .string()
    .trim()
    .min(1, 'iv is required')
    .regex(base64Regex, 'iv must be valid base64'),
  metadata: z
    .object({
      title: z.string().trim().min(1, 'metadata.title is required').max(256),
      fileName: z.string().max(256).optional(),
      mimeType: z.string().max(128).optional(),
      sizeBytes: z.number().int().nonnegative().optional(),
      classification: z.string().max(64).optional(),
      algorithm: z.string().max(64).optional(),
      kdf: z.string().max(64).optional(),
      salt: z.string().max(256).optional(),
    })
    .passthrough(),
});

export function createVaultRouter(vaultService: VaultService): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const ownerId = typeof req.query.ownerId === 'string' && req.query.ownerId.trim()
      ? req.query.ownerId.trim()
      : undefined;
    const records = vaultService.listRecords(ownerId);
    res.json({ records });
  });

  router.get('/:id', (req, res) => {
    const actorIdHeader = req.header('x-actor-id');
    const actorId = actorIdHeader && actorIdHeader.trim() ? actorIdHeader.trim() : 'anonymous';
    const record = vaultService.getRecord(req.params.id, actorId);

    if (!record) {
      res.status(404).json({ error: 'Vault record not found' });
      return;
    }

    res.json({ record });
  });

  router.post('/', (req, res) => {
    const parsed = createVaultRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid vault record payload',
        details: parsed.error.flatten(),
      });
      return;
    }

    const record = vaultService.createRecord(parsed.data);
    res.status(201).json({ record });
  });

  router.delete('/:id', (req, res) => {
    const actorIdHeader = req.header('x-actor-id');
    const actorId = actorIdHeader && actorIdHeader.trim() ? actorIdHeader.trim() : 'anonymous';
    const deleted = vaultService.deleteRecord(req.params.id, actorId);

    if (!deleted) {
      res.status(404).json({ error: 'Vault record not found' });
      return;
    }

    res.json({ deleted: true, id: req.params.id });
  });

  return router;
}
