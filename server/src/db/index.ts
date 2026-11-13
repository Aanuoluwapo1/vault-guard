import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type SqliteDatabase = DatabaseSync;

export interface VaultRecordRow {
  id: string;
  owner_id: string;
  ciphertext: string;
  iv: string;
  metadata: string;
  created_at: string;
}

export interface AuditLogRow {
  id: number;
  actor_id: string;
  action: string;
  resource_id: string | null;
  details: string | null;
  timestamp: string;
  previous_hash: string;
  current_hash: string;
}

export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS vault_records (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    metadata TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_vault_records_owner
    ON vault_records(owner_id);

  CREATE INDEX IF NOT EXISTS idx_vault_records_created_at
    ON vault_records(created_at DESC);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_id TEXT,
    details TEXT,
    timestamp TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    current_hash TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
    ON audit_logs(actor_id);

  CREATE TRIGGER IF NOT EXISTS prevent_audit_log_update
  BEFORE UPDATE ON audit_logs
  BEGIN
    SELECT RAISE(ABORT, 'audit_logs is append-only: updates are forbidden');
  END;

  CREATE TRIGGER IF NOT EXISTS prevent_audit_log_delete
  BEFORE DELETE ON audit_logs
  BEGIN
    SELECT RAISE(ABORT, 'audit_logs is append-only: deletions are forbidden');
  END;
`;

const txDepth = new WeakMap<SqliteDatabase, number>();

/**
 * Executes a synchronous callback inside an atomic SQLite transaction.
 * Supports nested calls safely via SQLite SAVEPOINTs.
 */
export function runTransaction<T>(db: SqliteDatabase, fn: () => T): T {
  const depth = txDepth.get(db) ?? 0;
  const spName = `vg_sp_${depth}`;

  if (depth === 0) {
    db.exec('BEGIN IMMEDIATE');
  } else {
    db.exec(`SAVEPOINT ${spName}`);
  }
  txDepth.set(db, depth + 1);

  try {
    const result = fn();
    if (depth === 0) {
      db.exec('COMMIT');
    } else {
      db.exec(`RELEASE SAVEPOINT ${spName}`);
    }
    return result;
  } catch (err) {
    if (depth === 0) {
      db.exec('ROLLBACK');
    } else {
      db.exec(`ROLLBACK TO SAVEPOINT ${spName}`);
      db.exec(`RELEASE SAVEPOINT ${spName}`);
    }
    throw err;
  } finally {
    if (depth === 0) {
      txDepth.delete(db);
    } else {
      txDepth.set(db, depth);
    }
  }
}

/**
 * Initialize a SQLite database connection with WAL mode and VaultGuard schema.
 * Pass `:memory:` for isolated unit/integration tests.
 */
export function createDatabase(dbPath?: string): SqliteDatabase {
  const resolvedPath =
    dbPath ?? process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'data', 'vault-guard.db');

  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(resolvedPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);

  return db;
}
