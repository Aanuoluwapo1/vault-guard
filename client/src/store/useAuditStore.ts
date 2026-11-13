import { create } from 'zustand';
import { api } from '../api/client';
import type { AuditLogEntry, AuditVerificationResult } from '../types';

interface AuditState {
  logs: AuditLogEntry[];
  verification: AuditVerificationResult | null;
  isLoading: boolean;
  isVerifying: boolean;
  error: string | null;
  fetchLogs: () => Promise<void>;
  verifyIntegrity: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

export const useAuditStore = create<AuditState>((set) => ({
  logs: [],
  verification: null,
  isLoading: false,
  isVerifying: false,
  error: null,

  fetchLogs: async () => {
    set({ isLoading: true, error: null });
    try {
      const logs = await api.listAuditLogs(200);
      set({ logs, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load audit logs';
      set({ error: message, isLoading: false });
    }
  },

  verifyIntegrity: async () => {
    set({ isVerifying: true, error: null });
    try {
      const verification = await api.verifyAuditChain();
      set({ verification, isVerifying: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Chain verification request failed';
      set({ error: message, isVerifying: false });
    }
  },

  refreshAll: async () => {
    set({ isLoading: true, isVerifying: true, error: null });
    try {
      const [logs, verification] = await Promise.all([
        api.listAuditLogs(200),
        api.verifyAuditChain(),
      ]);
      set({ logs, verification, isLoading: false, isVerifying: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh audit state';
      set({ error: message, isLoading: false, isVerifying: false });
    }
  },
}));
