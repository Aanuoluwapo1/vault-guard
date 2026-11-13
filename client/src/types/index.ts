export interface VaultMetadata {
  title: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  classification?: 'CONFIDENTIAL' | 'RESTRICTED' | 'INTERNAL' | string;
  algorithm?: string;
  kdf?: string;
  salt?: string;
}

export interface VaultRecord {
  id: string;
  owner_id: string;
  ciphertext: string;
  iv: string;
  metadata: VaultMetadata;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  actor_id: string;
  action: string;
  resource_id: string | null;
  details: string | null;
  timestamp: string;
  previous_hash: string;
  current_hash: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  totalRecords: number;
  verifiedCount: number;
  brokenAtId?: number;
  reason?: string;
  checkedAt: string;
}
