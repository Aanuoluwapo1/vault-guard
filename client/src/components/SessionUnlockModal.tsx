import { useState } from 'react';
import {
  AlertCircle,
  Cpu,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore';
import { useAuditStore } from '../store/useAuditStore';

interface SessionUnlockModalProps {
  onClose?: () => void;
}

const ROLES: Array<'Compliance Officer' | 'Security Auditor' | 'Vault Admin'> = [
  'Compliance Officer',
  'Security Auditor',
  'Vault Admin',
];

export function SessionUnlockModal({ onClose }: SessionUnlockModalProps) {
  const { actorId: currentActor, role: currentRole, isDeriving, error, unlockVault, clearError } =
    useSessionStore();
  const refreshAll = useAuditStore((s) => s.refreshAll);

  const [actorId, setActorId] = useState(currentActor);
  const [role, setRole] = useState<'Compliance Officer' | 'Security Auditor' | 'Vault Admin'>(
    currentRole
  );
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await unlockVault(actorId, passphrase, role);
    if (ok) {
      setPassphrase('');
      void refreshAll();
      onClose?.();
    }
  };

  return (
    <div className="vg-panel relative overflow-hidden rounded-xl p-6 sm:p-7">
      {/* Subtle top signal line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-400/80 to-cyan-400/0" />

      <div className="grid gap-7 lg:grid-cols-12">
        {/* Left: Key Ceremony Spec & Custody Guarantee */}
        <div className="flex flex-col justify-between border-b border-white/[0.06] pb-6 lg:col-span-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
              <Cpu className="h-3 w-3" />
              Client Key Ceremony
            </div>
            <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-zinc-100">
              Derive Local Vault Key
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              VaultGuard operates on strict zero-knowledge custody. Your passphrase is stretched
              entirely inside the browser&apos;s Web Crypto enclave and never touches the network.
            </p>
          </div>

          <div className="mt-6 space-y-2 rounded-lg border border-white/[0.06] bg-black/40 p-3.5 font-mono text-[11px]">
            <div className="flex items-center justify-between text-zinc-400">
              <span>KDF ENGINE</span>
              <span className="text-zinc-200">PBKDF2-HMAC-SHA256</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>WORK FACTOR</span>
              <span className="text-emerald-400">310,000 ROUNDS</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>CIPHER SUITE</span>
              <span className="text-cyan-300">AES-256-GCM (96-bit IV)</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>KEY EXTRACTABLE</span>
              <span className="text-amber-300">FALSE (IN-MEMORY)</span>
            </div>
          </div>
        </div>

        {/* Right: Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4 lg:col-span-7">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Operator Identity (Salt Binding)
            </label>
            <div className="relative">
              <Fingerprint className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={actorId}
                onChange={(e) => {
                  clearError();
                  setActorId(e.target.value);
                }}
                placeholder="e.g. auditor-01"
                className="w-full rounded-lg border border-white/10 bg-[#07090d] py-2.5 pl-9 pr-3 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500/70 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Clearance Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((item) => {
                const active = role === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRole(item)}
                    className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition ${
                      active
                        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                        : 'border-white/10 bg-[#07090d] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Master Passphrase (Min. 8 Characters)
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => {
                  clearError();
                  setPassphrase(e.target.value);
                }}
                placeholder="Enter high-entropy vault passphrase"
                className="w-full rounded-lg border border-white/10 bg-[#07090d] py-2.5 pl-9 pr-10 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500/70 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassphrase((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
                aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
              >
                {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              window.crypto.subtle ready
            </span>

            <button
              type="submit"
              disabled={isDeriving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              {isDeriving ? 'Stretching Key (310k)...' : 'Initialize Key & Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
