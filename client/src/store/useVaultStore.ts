import { create } from 'zustand';
import { api } from '../api/client';
import { decryptString, encryptString } from '../crypto/subtle';
import type { VaultMetadata, VaultRecord } from '../types';
import { useSessionStore } from './useSessionStore';

export type EncryptionPhase = 'idle' | 'encrypting' | 'uploading' | 'done' | 'error';

interface VaultState {
  records: VaultRecord[];
  isLoading: boolean;
  error: string | null;
  encryptionPhase: EncryptionPhase;
  lastEncryptedPreview: { iv: string; ciphertextPreview: string } | null;
  decryptedMap: Record<string, string>;
  decryptionErrors: Record<string, string>;
  fetchRecords: () => Promise<void>;
  uploadEncryptedRecord: (input: {
    title: string;
    plaintext: string;
    classification: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
  }) => Promise<VaultRecord | null>;
  decryptRecord: (record: VaultRecord) => Promise<void>;
  hideDecrypted: (id: string) => void;
  deleteRecord: (id: string) => Promise<void>;
  clearDecrypted: () => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  records: [],
  isLoading: false,
  error: null,
  encryptionPhase: 'idle',
  lastEncryptedPreview: null,
  decryptedMap: {},
  decryptionErrors: {},

  fetchRecords: async () => {
    set({ isLoading: true, error: null });
    try {
      const records = await api.listVaultRecords();
      set({ records, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load vault records';
      set({ error: message, isLoading: false });
    }
  },

  uploadEncryptedRecord: async ({ title, plaintext, classification, fileName, mimeType, sizeBytes }) => {
    const { derivedKey, actorId, isUnlocked } = useSessionStore.getState();
    if (!isUnlocked || !derivedKey) {
      set({ error: 'Unlock your vault with a passphrase before encrypting documents.', encryptionPhase: 'error' });
      return null;
    }

    set({ encryptionPhase: 'encrypting', error: null });

    try {
      const { ciphertext, iv } = await encryptString(derivedKey, plaintext);

      set({
        encryptionPhase: 'uploading',
        lastEncryptedPreview: {
          iv,
          ciphertextPreview: ciphertext.slice(0, 48) + (ciphertext.length > 48 ? '...' : ''),
        },
      });

      const metadata: VaultMetadata = {
        title: title.trim(),
        classification,
        fileName,
        mimeType: mimeType ?? 'text/plain',
        sizeBytes: sizeBytes ?? new TextEncoder().encode(plaintext).byteLength,
        algorithm: 'AES-GCM-256',
        kdf: 'PBKDF2-SHA256',
      };

      const created = await api.createVaultRecord({
        ownerId: actorId,
        ciphertext,
        iv,
        metadata,
      });

      set((state) => ({
        records: [created, ...state.records],
        encryptionPhase: 'done',
      }));

      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Encryption or upload failed';
      set({ encryptionPhase: 'error', error: message });
      return null;
    }
  },

  decryptRecord: async (record) => {
    const { derivedKey, actorId, isUnlocked } = useSessionStore.getState();
    if (!isUnlocked || !derivedKey) {
      set((state) => ({
        decryptionErrors: {
          ...state.decryptionErrors,
          [record.id]: 'Vault is locked. Unlock with your passphrase to decrypt.',
        },
      }));
      return;
    }

    // Clear prior error for this record
    set((state) => {
      const nextErrors = { ...state.decryptionErrors };
      delete nextErrors[record.id];
      return { decryptionErrors: nextErrors };
    });

    try {
      // Fetch fresh record from server (which also logs VAULT_READ in audit_logs)
      const freshRecord = await api.getVaultRecord(record.id, actorId);
      const plaintext = await decryptString(derivedKey, freshRecord.ciphertext, freshRecord.iv);

      set((state) => ({
        decryptedMap: { ...state.decryptedMap, [record.id]: plaintext },
      }));

      api
        .recordAuditEvent({
          actorId,
          action: 'DECRYPT_SUCCESS',
          resourceId: record.id,
          details: `Client-side AES-GCM-256 decryption succeeded for "${record.metadata.title}"`,
        })
        .catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Decryption failed';
      set((state) => ({
        decryptionErrors: { ...state.decryptionErrors, [record.id]: message },
      }));

      api
        .recordAuditEvent({
          actorId,
          action: 'DECRYPT_FAILED',
          resourceId: record.id,
          details: 'Client-side decryption rejected (wrong key or tampered ciphertext)',
        })
        .catch(() => {});
    }
  },

  hideDecrypted: (id) => {
    set((state) => {
      const next = { ...state.decryptedMap };
      delete next[id];
      return { decryptedMap: next };
    });
  },

  deleteRecord: async (id) => {
    const { actorId } = useSessionStore.getState();
    try {
      await api.deleteVaultRecord(id, actorId);
      const nextRecords = get().records.filter((r) => r.id !== id);
      set((state) => {
        const nextDecrypted = { ...state.decryptedMap };
        delete nextDecrypted[id];
        return { records: nextRecords, decryptedMap: nextDecrypted };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete record';
      set({ error: message });
    }
  },

  clearDecrypted: () => set({ decryptedMap: {}, decryptionErrors: {}, lastEncryptedPreview: null, encryptionPhase: 'idle' }),
}));
