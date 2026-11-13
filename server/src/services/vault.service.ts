import { randomUUID } from 'node:crypto';
import { runTransaction, type SqliteDatabase, type VaultRecordRow } from '../db/index.js';
import type { AuditService } from './audit.service.js';

export interface VaultMetadata {
  title: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  classification?: string;
  algorithm?: string;
  kdf?: string;
  salt?: string;
  [key: string]: unknown;
}

export interface VaultRecord {
  id: string;
  owner_id: string;
  ciphertext: string;
  iv: string;
  metadata: VaultMetadata;
  created_at: string;
}

export interface CreateVaultRecordInput {
  ownerId: string;
  ciphertext: string;
  iv: string;
  metadata: VaultMetadata;
}

function deserializeRecord(row: VaultRecordRow): VaultRecord {
  let parsedMeta: VaultMetadata = { title: 'Untitled Record' };
  try {
    parsedMeta = JSON.parse(row.metadata) as VaultMetadata;
  } catch {
    // Fallback if metadata is malformed
  }
  return {
    id: row.id,
    owner_id: row.owner_id,
    ciphertext: row.ciphertext,
    iv: row.iv,
    metadata: parsedMeta,
    created_at: row.created_at,
  };
}

export class VaultService {
  private readonly db: SqliteDatabase;
  private readonly auditService: AuditService;

  constructor(db: SqliteDatabase, auditService: AuditService) {
    this.db = db;
    this.auditService = auditService;
  }

  listRecords(ownerId?: string): VaultRecord[] {
    const rows = ownerId
      ? (this.db
          .prepare('SELECT * FROM vault_records WHERE owner_id = ? ORDER BY created_at DESC')
          .all(ownerId) as unknown as VaultRecordRow[])
      : (this.db
          .prepare('SELECT * FROM vault_records ORDER BY created_at DESC')
          .all() as unknown as VaultRecordRow[]);

    return rows.map(deserializeRecord);
  }

  getRecord(id: string, actorId: string): VaultRecord | null {
    const row = this.db
      .prepare('SELECT * FROM vault_records WHERE id = ?')
      .get(id) as VaultRecordRow | undefined;

    if (!row) {
      return null;
    }

    const record = deserializeRecord(row);
    this.auditService.appendLog({
      actorId,
      action: 'VAULT_READ',
      resourceId: id,
      details: JSON.stringify({
        ownerId: record.owner_id,
        title: record.metadata.title,
      }),
    });

    return record;
  }

  createRecord(input: CreateVaultRecordInput): VaultRecord {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const metadataJson = JSON.stringify(input.metadata);

    runTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO vault_records (id, owner_id, ciphertext, iv, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(id, input.ownerId, input.ciphertext, input.iv, metadataJson, createdAt);

      this.auditService.appendLog({
        actorId: input.ownerId,
        action: 'VAULT_CREATE',
        resourceId: id,
        details: JSON.stringify({
          title: input.metadata.title,
          classification: input.metadata.classification ?? 'CONFIDENTIAL',
          ciphertextBytes: input.ciphertext.length,
        }),
      });
    });

    return {
      id,
      owner_id: input.ownerId,
      ciphertext: input.ciphertext,
      iv: input.iv,
      metadata: input.metadata,
      created_at: createdAt,
    };
  }

  deleteRecord(id: string, actorId: string): boolean {
    return runTransaction(this.db, () => {
      const existing = this.db
        .prepare('SELECT id, owner_id, metadata FROM vault_records WHERE id = ?')
        .get(id) as Pick<VaultRecordRow, 'id' | 'owner_id' | 'metadata'> | undefined;

      if (!existing) {
        return false;
      }

      const result = this.db.prepare('DELETE FROM vault_records WHERE id = ?').run(id);
      if (result.changes === 0) {
        return false;
      }

      this.auditService.appendLog({
        actorId,
        action: 'VAULT_DELETE',
        resourceId: id,
        details: JSON.stringify({
          ownerId: existing.owner_id,
        }),
      });

      return true;
    });
  }
}
