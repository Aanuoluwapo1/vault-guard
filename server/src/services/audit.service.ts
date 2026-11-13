import { createHash } from 'node:crypto';
import { runTransaction, type AuditLogRow, type SqliteDatabase } from '../db/index.js';

export const GENESIS_HASH = '0'.repeat(64);

export interface AppendAuditLogInput {
  actorId: string;
  action: string;
  resourceId?: string | null;
  details?: string | null;
  timestamp?: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  totalRecords: number;
  verifiedCount: number;
  brokenAtId?: number;
  reason?: string;
  checkedAt: string;
}

export type AuditHashPayload = Omit<AuditLogRow, 'current_hash'>;

/**
 * Computes the deterministic SHA-256 hash for an audit log entry.
 * Serializes fields in a fixed tuple order so key ordering never drifts.
 */
export function computeEntryHash(entry: AuditHashPayload): string {
  const canonical = JSON.stringify([
    entry.id,
    entry.actor_id,
    entry.action,
    entry.resource_id ?? null,
    entry.details ?? null,
    entry.timestamp,
    entry.previous_hash,
  ]);

  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export class AuditService {
  private readonly db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  /**
   * Appends a new hash-chained record to the immutable audit_logs table.
   * Executes inside a SQLite transaction to guarantee strict sequential chaining.
   */
  appendLog(input: AppendAuditLogInput): AuditLogRow {
    return runTransaction(this.db, () => {
      const last = this.db
        .prepare('SELECT id, current_hash FROM audit_logs ORDER BY id DESC LIMIT 1')
        .get() as Pick<AuditLogRow, 'id' | 'current_hash'> | undefined;

      const nextId = last ? last.id + 1 : 1;
      const previousHash = last ? last.current_hash : GENESIS_HASH;
      const timestamp = input.timestamp ?? new Date().toISOString();
      const resourceId = input.resourceId ?? null;
      const details = input.details ?? null;

      const currentHash = computeEntryHash({
        id: nextId,
        actor_id: input.actorId,
        action: input.action,
        resource_id: resourceId,
        details,
        timestamp,
        previous_hash: previousHash,
      });

      this.db
        .prepare(
          `INSERT INTO audit_logs (id, actor_id, action, resource_id, details, timestamp, previous_hash, current_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(nextId, input.actorId, input.action, resourceId, details, timestamp, previousHash, currentHash);

      return {
        id: nextId,
        actor_id: input.actorId,
        action: input.action,
        resource_id: resourceId,
        details,
        timestamp,
        previous_hash: previousHash,
        current_hash: currentHash,
      };
    });
  }

  /**
   * Returns audit log entries ordered newest-first by default.
   */
  listLogs(options: { limit?: number; offset?: number; order?: 'asc' | 'desc' } = {}): AuditLogRow[] {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 1000);
    const offset = Math.max(options.offset ?? 0, 0);
    const orderSql = options.order === 'asc' ? 'ASC' : 'DESC';

    return this.db
      .prepare(`SELECT * FROM audit_logs ORDER BY id ${orderSql} LIMIT ? OFFSET ?`)
      .all(limit, offset) as unknown as AuditLogRow[];
  }

  /**
   * Verifies the cryptographic integrity of the entire audit log hash chain.
   * Checks sequence continuity, previous_hash linkage, and SHA-256 recomputation.
   */
  verifyChain(): AuditVerificationResult {
    const checkedAt = new Date().toISOString();
    const rows = this.db
      .prepare('SELECT * FROM audit_logs ORDER BY id ASC')
      .all() as unknown as AuditLogRow[];

    if (rows.length === 0) {
      return {
        valid: true,
        totalRecords: 0,
        verifiedCount: 0,
        checkedAt,
      };
    }

    let verifiedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (i === 0) {
        if (row.id !== 1) {
          return {
            valid: false,
            totalRecords: rows.length,
            verifiedCount,
            brokenAtId: row.id,
            reason: `Genesis record must have id 1, found id ${row.id} (possible leading truncation)`,
            checkedAt,
          };
        }
        if (row.previous_hash !== GENESIS_HASH) {
          return {
            valid: false,
            totalRecords: rows.length,
            verifiedCount,
            brokenAtId: row.id,
            reason: 'Genesis record previous_hash does not match expected genesis zero-hash',
            checkedAt,
          };
        }
      } else {
        const prev = rows[i - 1];
        if (row.id !== prev.id + 1) {
          return {
            valid: false,
            totalRecords: rows.length,
            verifiedCount,
            brokenAtId: row.id,
            reason: `Sequence gap detected between id ${prev.id} and id ${row.id}`,
            checkedAt,
          };
        }
        if (row.previous_hash !== prev.current_hash) {
          return {
            valid: false,
            totalRecords: rows.length,
            verifiedCount,
            brokenAtId: row.id,
            reason: `Hash link mismatch at id ${row.id}: previous_hash does not match record #${prev.id} current_hash`,
            checkedAt,
          };
        }
      }

      const expectedHash = computeEntryHash({
        id: row.id,
        actor_id: row.actor_id,
        action: row.action,
        resource_id: row.resource_id,
        details: row.details,
        timestamp: row.timestamp,
        previous_hash: row.previous_hash,
      });

      if (row.current_hash !== expectedHash) {
        return {
          valid: false,
          totalRecords: rows.length,
          verifiedCount,
          brokenAtId: row.id,
          reason: `Payload hash mismatch at id ${row.id}: record contents were altered`,
          checkedAt,
        };
      }

      verifiedCount++;
    }

    return {
      valid: true,
      totalRecords: rows.length,
      verifiedCount,
      checkedAt,
    };
  }
}
