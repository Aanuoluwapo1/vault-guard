import { create } from 'zustand';
import { api } from '../api/client';
import { deriveKey, deriveKeyFingerprint, PBKDF2_ITERATIONS } from '../crypto/subtle';

interface SessionState {
  actorId: string;
  role: 'Compliance Officer' | 'Security Auditor' | 'Vault Admin';
  isUnlocked: boolean;
  isDeriving: boolean;
  derivedKey: CryptoKey | null;
  keyFingerprint: string | null;
  error: string | null;
  unlockVault: (actorId: string, passphrase: string, role?: SessionState['role']) => Promise<boolean>;
  lockVault: () => Promise<void>;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  actorId: 'auditor-01',
  role: 'Compliance Officer',
  isUnlocked: false,
  isDeriving: false,
  derivedKey: null,
  keyFingerprint: null,
  error: null,

  unlockVault: async (actorId, passphrase, role) => {
    const cleanActor = actorId.trim();
    if (!cleanActor) {
      set({ error: 'Actor ID is required to derive your vault key.' });
      return false;
    }
    if (!passphrase || passphrase.length < 8) {
      set({ error: 'Passphrase must be at least 8 characters.' });
      return false;
    }

    set({ isDeriving: true, error: null });

    try {
      // Domain-separated salt bound to the operator identity so the derived key
      // is deterministic across sessions for the same actor + passphrase.
      const salt = `vault-guard:v1:${cleanActor}`;
      const [key, fingerprint] = await Promise.all([
        deriveKey(passphrase, salt, PBKDF2_ITERATIONS),
        deriveKeyFingerprint(passphrase, salt),
      ]);

      set({
        actorId: cleanActor,
        role: role ?? get().role,
        isUnlocked: true,
        isDeriving: false,
        derivedKey: key,
        keyFingerprint: fingerprint,
        error: null,
      });

      // Best-effort audit log for session unlock
      api
        .recordAuditEvent({
          actorId: cleanActor,
          action: 'VAULT_UNLOCK',
          details: `Key fingerprint ${fingerprint} derived locally (PBKDF2-${PBKDF2_ITERATIONS})`,
        })
        .catch(() => {});

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to derive encryption key.';
      set({ isDeriving: false, error: message });
      return false;
    }
  },

  lockVault: async () => {
    const { actorId, isUnlocked } = get();
    set({
      isUnlocked: false,
      derivedKey: null,
      keyFingerprint: null,
      error: null,
    });

    if (isUnlocked) {
      api
        .recordAuditEvent({
          actorId,
          action: 'VAULT_LOCK',
          details: 'In-memory CryptoKey purged on client',
        })
        .catch(() => {});
    }
  },

  clearError: () => set({ error: null }),
}));
