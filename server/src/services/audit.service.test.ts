import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type SqliteDatabase } from '../db/index.js';
import { AuditService, GENESIS_HASH } from './audit.service.js';
import { VaultService } from './vault.service.js';

describe('AuditService & Hash-Chain Verification', () => {
  let db: SqliteDatabase;
  let auditService: AuditService;
  let vaultService: VaultService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    auditService = new AuditService(db);
    vaultService = new VaultService(db, auditService);
  });

  afterEach(() => {
    db.close();
  });

  it('verifies an empty audit log chain as valid', () => {
    const result = auditService.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.totalRecords).toBe(0);
    expect(result.verifiedCount).toBe(0);
  });

  it('chains SHA-256 hashes sequentially from the genesis zero-hash', () => {
    const first = auditService.appendLog({
      actorId: 'auditor-alice',
      action: 'VAULT_UNLOCK',
      details: 'Session started',
    });

    const second = auditService.appendLog({
      actorId: 'auditor-alice',
      action: 'VAULT_CREATE',
      resourceId: 'rec-001',
    });

    const third = auditService.appendLog({
      actorId: 'auditor-bob',
      action: 'VAULT_READ',
      resourceId: 'rec-001',
    });

    expect(first.id).toBe(1);
    expect(first.previous_hash).toBe(GENESIS_HASH);
    expect(second.id).toBe(2);
    expect(second.previous_hash).toBe(first.current_hash);
    expect(third.id).toBe(3);
    expect(third.previous_hash).toBe(second.current_hash);

    const verification = auditService.verifyChain();
    expect(verification.valid).toBe(true);
    expect(verification.totalRecords).toBe(3);
    expect(verification.verifiedCount).toBe(3);
    expect(verification.brokenAtId).toBeUndefined();
  });

  it('enforces append-only immutability via SQLite triggers', () => {
    auditService.appendLog({
      actorId: 'auditor-alice',
      action: 'VAULT_UNLOCK',
    });

    expect(() => {
      db.prepare("UPDATE audit_logs SET action = 'TAMPERED' WHERE id = 1").run();
    }).toThrow(/append-only/i);

    expect(() => {
      db.prepare('DELETE FROM audit_logs WHERE id = 1').run();
    }).toThrow(/append-only/i);
  });

  it('detects payload tampering when a record is altered out-of-band', () => {
    auditService.appendLog({ actorId: 'alice', action: 'VAULT_UNLOCK' });
    auditService.appendLog({ actorId: 'alice', action: 'VAULT_CREATE', resourceId: 'doc-1' });
    auditService.appendLog({ actorId: 'bob', action: 'VAULT_READ', resourceId: 'doc-1' });

    // Simulate privileged out-of-band database tampering (bypassing trigger)
    db.exec('DROP TRIGGER prevent_audit_log_update;');
    db.prepare("UPDATE audit_logs SET actor_id = 'mallory' WHERE id = 2").run();

    const verification = auditService.verifyChain();
    expect(verification.valid).toBe(false);
    expect(verification.brokenAtId).toBe(2);
    expect(verification.verifiedCount).toBe(1);
    expect(verification.reason).toMatch(/payload hash mismatch/i);
  });

  it('detects chain break when a middle record is deleted out-of-band', () => {
    auditService.appendLog({ actorId: 'alice', action: 'VAULT_UNLOCK' });
    auditService.appendLog({ actorId: 'alice', action: 'VAULT_CREATE', resourceId: 'doc-1' });
    auditService.appendLog({ actorId: 'bob', action: 'VAULT_READ', resourceId: 'doc-1' });

    db.exec('DROP TRIGGER prevent_audit_log_delete;');
    db.prepare('DELETE FROM audit_logs WHERE id = 2').run();

    const verification = auditService.verifyChain();
    expect(verification.valid).toBe(false);
    expect(verification.brokenAtId).toBe(3);
    expect(verification.reason).toMatch(/sequence gap/i);
  });

  it('records valid hash-chained audit entries on VaultService operations', () => {
    const created = vaultService.createRecord({
      ownerId: 'sec-ops-1',
      ciphertext: 'U2FsdGVkX1+abc123==',
      iv: 'MTIzNDU2Nzg5MDEy',
      metadata: { title: 'SOC2 Evidence Q4', classification: 'RESTRICTED' },
    });

    const fetched = vaultService.getRecord(created.id, 'auditor-2');
    expect(fetched?.id).toBe(created.id);

    const deleted = vaultService.deleteRecord(created.id, 'sec-ops-1');
    expect(deleted).toBe(true);

    const logs = auditService.listLogs({ order: 'asc' });
    expect(logs.map((l) => l.action)).toEqual(['VAULT_CREATE', 'VAULT_READ', 'VAULT_DELETE']);

    const verification = auditService.verifyChain();
    expect(verification.valid).toBe(true);
    expect(verification.totalRecords).toBe(3);
  });
});
