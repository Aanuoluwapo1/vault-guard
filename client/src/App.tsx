import { useEffect, useState } from 'react';
import {
  Activity,
  Database,
  FileLock2,
  KeyRound,
  Lock,
  ScrollText,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import { useSessionStore } from './store/useSessionStore';
import { useVaultStore } from './store/useVaultStore';
import { useAuditStore } from './store/useAuditStore';
import { VaultDashboard } from './components/VaultDashboard';
import { AuditExplorer } from './components/AuditExplorer';
import { VaultGuardLogo } from './components/VaultGuardLogo';

type ActiveTab = 'vault' | 'audit';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('vault');
  const { actorId, role, isUnlocked, keyFingerprint, lockVault } = useSessionStore();
  const records = useVaultStore((s) => s.records);
  const clearDecrypted = useVaultStore((s) => s.clearDecrypted);
  const { verification, verifyIntegrity } = useAuditStore();

  useEffect(() => {
    void verifyIntegrity();
  }, [verifyIntegrity]);

  const handleLock = async () => {
    clearDecrypted();
    await lockVault();
  };

  const totalBytes = records.reduce((acc, r) => acc + (r.metadata.sizeBytes ?? 0), 0);
  const chainValid = verification?.valid ?? true;

  return (
    <div className="min-h-screen text-zinc-100">
      {/* Top HSM Telemetry & Command Rail */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#07090d]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <VaultGuardLogo className="h-10 w-10 shrink-0 drop-shadow-[0_0_14px_rgba(16,185,129,0.28)]" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-bold tracking-wider text-zinc-100">
                  VAULTGUARD
                </h1>
                <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-300">
                  ZK-AUDIT v1.0
                </span>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                AES-256-GCM • SHA-256 HASH CHAIN
              </p>
            </div>
          </div>

          {/* Navigation Switcher */}
          <nav className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/50 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('vault')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 font-mono text-xs font-medium transition ${
                activeTab === 'vault'
                  ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/35'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileLock2 className="h-3.5 w-3.5" />
              VAULT
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 font-mono text-xs font-medium transition ${
                activeTab === 'audit'
                  ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/35'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ScrollText className="h-3.5 w-3.5" />
              AUDIT CHAIN
              {verification && (
                <span
                  className={`h-2 w-2 rounded-full ${
                    chainValid ? 'bg-emerald-400' : 'animate-pulse bg-red-500'
                  }`}
                  title={chainValid ? 'Chain Valid' : 'Tamper Detected'}
                />
              )}
            </button>
          </nav>

          {/* Session Custody Controls */}
          <div className="flex items-center gap-3">
            {isUnlocked ? (
              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <div className="flex items-center justify-end gap-1.5 font-mono text-xs font-medium text-zinc-200">
                    <Unlock className="h-3 w-3 text-emerald-400" />
                    <span>{actorId}</span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-zinc-400">{role}</span>
                  </div>
                  <div className="font-mono text-[10px] text-emerald-400">
                    KEY {keyFingerprint}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleLock()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-mono text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
                >
                  <Lock className="h-3.5 w-3.5" />
                  PURGE KEY
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 font-mono text-[11px] font-medium text-amber-300">
                <Lock className="h-3.5 w-3.5" />
                ENCLAVE SEALED
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Console */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Live Telemetry Strip */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="vg-panel rounded-xl px-4 py-3.5">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <span>Sealed Artifacts</span>
              <Database className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-display text-xl font-bold tabular-nums text-zinc-100">
                {records.length}
              </span>
              <span className="font-mono text-[11px] text-zinc-500">
                ({totalBytes.toLocaleString()} B ciphertext)
              </span>
            </div>
          </div>

          <div className="vg-panel rounded-xl px-4 py-3.5">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <span>Chain Height</span>
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-display text-xl font-bold tabular-nums text-zinc-100">
                #{verification?.totalRecords ?? 0}
              </span>
              <span className="font-mono text-[11px] text-zinc-500">SHA-256 blocks</span>
            </div>
          </div>

          <div className="vg-panel rounded-xl px-4 py-3.5">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <span>Key Custody</span>
              <KeyRound className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={`font-display text-lg font-bold ${
                  isUnlocked ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {isUnlocked ? 'IN-MEMORY' : 'SEALED'}
              </span>
              <span className="truncate font-mono text-[11px] text-zinc-500">
                {isUnlocked ? keyFingerprint : 'No key loaded'}
              </span>
            </div>
          </div>

          <div className="vg-panel rounded-xl px-4 py-3.5">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <span>Integrity Verdict</span>
              <ShieldCheck
                className={`h-3.5 w-3.5 ${chainValid ? 'text-emerald-400' : 'text-red-400'}`}
              />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={`font-display text-lg font-bold ${
                  verification === null
                    ? 'text-zinc-400'
                    : chainValid
                      ? 'text-emerald-400'
                      : 'text-red-400'
                }`}
              >
                {verification === null
                  ? 'CHECKING…'
                  : chainValid
                    ? 'VERIFIED'
                    : 'TAMPERED'}
              </span>
              <span className="font-mono text-[11px] text-zinc-500">
                {verification
                  ? `${verification.verifiedCount}/${verification.totalRecords} ok`
                  : 'Auditing'}
              </span>
            </div>
          </div>
        </section>

        {activeTab === 'vault' ? <VaultDashboard /> : <AuditExplorer />}
      </main>
    </div>
  );
}

export default App;
