import type {
  AuditLogEntry,
  AuditVerificationResult,
  VaultMetadata,
  VaultRecord,
} from '../types';

const API_BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Ignore JSON parse errors on non-JSON error responses
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const api = {
  async listVaultRecords(ownerId?: string): Promise<VaultRecord[]> {
    const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : '';
    const data = await request<{ records: VaultRecord[] }>(`/vault${query}`);
    return data.records;
  },

  async getVaultRecord(id: string, actorId: string): Promise<VaultRecord> {
    const data = await request<{ record: VaultRecord }>(`/vault/${encodeURIComponent(id)}`, {
      headers: { 'x-actor-id': actorId },
    });
    return data.record;
  },

  async createVaultRecord(payload: {
    ownerId: string;
    ciphertext: string;
    iv: string;
    metadata: VaultMetadata;
  }): Promise<VaultRecord> {
    const data = await request<{ record: VaultRecord }>('/vault', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.record;
  },

  async deleteVaultRecord(id: string, actorId: string): Promise<void> {
    await request<{ deleted: boolean }>(`/vault/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-actor-id': actorId },
    });
  },

  async listAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
    const data = await request<{ logs: AuditLogEntry[] }>(`/audit?limit=${limit}&order=desc`);
    return data.logs;
  },

  async verifyAuditChain(): Promise<AuditVerificationResult> {
    const data = await request<{ verification: AuditVerificationResult }>('/audit/verify');
    return data.verification;
  },

  async recordAuditEvent(payload: {
    actorId: string;
    action: 'VAULT_UNLOCK' | 'VAULT_LOCK' | 'DECRYPT_SUCCESS' | 'DECRYPT_FAILED' | 'INTEGRITY_CHECK';
    resourceId?: string | null;
    details?: string | null;
  }): Promise<void> {
    await request('/audit/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
