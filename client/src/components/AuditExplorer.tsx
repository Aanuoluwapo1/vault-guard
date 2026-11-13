import { useEffect, useState } from 'react';
import {
  AlertOctagon,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useAuditStore } from '../store/useAuditStore';

const ACTION_STYLES: Record<string, string> = {
  VAULT_CREATE: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  VAULT_READ: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
  VAULT_DELETE: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
  VAULT_UNLOCK: 'border-violet-500/30 bg-violet-500/15 text-violet-300',
  VAULT_LOCK: 'border-zinc-500/30 bg-zinc-500/15 text-zinc-300',
  DECRYPT_SUCCESS: 'border-teal-500/30 bg-teal-500/15 text-teal-300',
  DECRYPT_FAILED: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
};

function shortHash(hash: string): string {
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

function HashPill({ label, hash, accent }: { label: string; hash: string; accent?: 'emerald' | 'red' | 'muted' }) {
  const [copied, setCopied] = useState(false);

  const colorClass =
    accent === 'emerald'
      ? 'text-emerald-300'
      : accent === 'red'
        ? 'text-rose-300'
        : 'text-zinc-400';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={`${label}: ${hash}`}
      className="group inline-flex items-center gap-1.5 rounded border border-white/[0.06] bg-black/50 px-2 py-1 font-mono text-[11px] transition hover:border-white/20"
    >
      <span className="text-zinc-500">{label}</span>
      <span className={colorClass}>{shortHash(hash)}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 text-zinc-600 group-hover:text-zinc-300" />
      )}
    </button>
  );
}

export function AuditExplorer() {
  const { logs, verification, isLoading, isVerifying, error, refreshAll, verifyIntegrity } =
    useAuditStore();

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const isValid = verification?.valid ?? true;

  return (
    <div className="space-y-5">
      {/* Cryptographic Chain Integrity Banner */}
      <div
        className={`vg-panel relative overflow-hidden rounded-xl p-5 ${
          verification === null
            ? ''
            : isValid
              ? 'border-emerald-500/30'
              : 'border-red-500/40'
        }`}
      >
        <div
          className={`absolute inset-x-0 top-0 h-[2px] ${
            verification === null
              ? 'bg-zinc-700'
              : isValid
                ? 'bg-gradient-to-r from-emerald-500/0 via-emerald-400 to-cyan-400/0'
                : 'bg-gradient-to-r from-red-500/0 via-red-500 to-rose-400/0'
          }`}
        />

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3.5">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${
                verification === null
                  ? 'border-white/10 bg-white/5 text-zinc-400'
                  : isValid
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                    : 'border-red-500/40 bg-red-500/15 text-red-400'
              }`}
            >
              {isValid ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-base font-bold tracking-tight text-zinc-100">
                  Immutable Hash-Chain Ledger
                </h2>

                {verification && (
                  <span
                    data-testid="chain-integrity-badge"
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 font-mono text-[11px] font-semibold ${
                      isValid
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : 'border-red-500/40 bg-red-500/20 text-red-300'
                    }`}
                  >
                    {isValid ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Chain Integrity Verification: Valid
                      </>
                    ) : (
                      <>
                        <AlertOctagon className="h-3.5 w-3.5" />
                        Chain Integrity Verification: Tamper Detected
                      </>
                    )}
                  </span>
                )}
              </div>

              <p className="mt-1 font-mono text-xs text-zinc-400">
                {verification
                  ? isValid
                    ? `${verification.verifiedCount}/${verification.totalRecords} SHA-256 blocks verified • Checked ${new Date(verification.checkedAt).toLocaleTimeString()}`
                    : `BROKEN AT BLOCK #${verification.brokenAtId ?? '?'}: ${verification.reason}`
                  : 'Running full SHA-256 hash-chain audit...'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void verifyIntegrity()}
            disabled={isVerifying}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 font-mono text-xs font-semibold text-zinc-100 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            RE-VERIFY CHAIN
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Hash-Chain Block Stream */}
      <div className="vg-panel rounded-xl p-5">
        {isLoading && logs.length === 0 ? (
          <div className="py-12 text-center font-mono text-xs text-zinc-400">
            Streaming immutable audit blocks...
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/20 py-14 text-center">
            <Link2 className="mx-auto mb-2.5 h-7 w-7 text-zinc-700" />
            <p className="font-display text-sm font-semibold text-zinc-300">
              Genesis Block Awaited
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Unlock the vault or seal an artifact to append Block #1 to the SHA-256 chain.
            </p>
          </div>
        ) : (
          <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-white/[0.08]">
            {logs.map((log) => {
              const isBroken =
                verification && !verification.valid && verification.brokenAtId === log.id;
              const actionTone =
                ACTION_STYLES[log.action] ?? 'border-white/15 bg-white/5 text-zinc-300';

              return (
                <div key={log.id} className="relative flex items-start gap-4 pl-1">
                  {/* Sequence Node */}
                  <div
                    className={`relative z-10 mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold ${
                      isBroken
                        ? 'border-red-500 bg-red-950 text-red-300'
                        : 'border-emerald-500/40 bg-[#07090d] text-emerald-300'
                    }`}
                  >
                    #{log.id}
                  </div>

                  {/* Block Card */}
                  <div
                    className={`flex-1 rounded-xl border p-4 transition ${
                      isBroken
                        ? 'border-red-500/40 bg-red-950/25'
                        : 'border-white/[0.07] bg-[#07090d]/90 hover:border-white/15'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${actionTone}`}
                        >
                          {log.action}
                        </span>
                        <span className="font-mono text-xs text-zinc-200">{log.actor_id}</span>
                        {log.resource_id && (
                          <span className="font-mono text-[11px] text-zinc-500">
                            → {log.resource_id}
                          </span>
                        )}
                      </div>

                      <span className="font-mono text-[11px] text-zinc-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    {log.details && (
                      <p className="mt-2 truncate font-mono text-[11px] text-zinc-400" title={log.details}>
                        {log.details}
                      </p>
                    )}

                    {/* Hash Link Strip */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <HashPill label="PREV" hash={log.previous_hash} accent="muted" />
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
                      <HashPill
                        label="CURR"
                        hash={log.current_hash}
                        accent={isBroken ? 'red' : 'emerald'}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
