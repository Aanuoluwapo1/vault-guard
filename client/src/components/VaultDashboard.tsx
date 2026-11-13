import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  FileLock2,
  FileUp,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore';
import { useVaultStore } from '../store/useVaultStore';
import { useAuditStore } from '../store/useAuditStore';
import { SessionUnlockModal } from './SessionUnlockModal';

const CLASSIFICATIONS = [
  { id: 'RESTRICTED', tone: 'text-rose-300 border-rose-500/40 bg-rose-500/15', stripe: 'bg-rose-500' },
  { id: 'CONFIDENTIAL', tone: 'text-amber-300 border-amber-500/40 bg-amber-500/15', stripe: 'bg-amber-400' },
  { id: 'INTERNAL', tone: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/15', stripe: 'bg-cyan-400' },
] as const;

function CopyChip({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      title={`Copy full ${label}`}
      className="group flex items-center justify-between gap-2 rounded border border-white/[0.06] bg-black/40 px-2.5 py-1.5 text-left font-mono text-[11px] text-zinc-400 transition hover:border-white/15 hover:text-zinc-200"
    >
      <span className="truncate">
        <span className="text-zinc-500">{label}: </span>
        <span className="text-zinc-300">{value.slice(0, 26)}{value.length > 26 ? '…' : ''}</span>
      </span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 text-zinc-600 group-hover:text-zinc-300" />
      )}
    </button>
  );
}

export function VaultDashboard() {
  const { isUnlocked, keyFingerprint } = useSessionStore();
  const {
    records,
    isLoading,
    error,
    encryptionPhase,
    lastEncryptedPreview,
    decryptedMap,
    decryptionErrors,
    fetchRecords,
    uploadEncryptedRecord,
    decryptRecord,
    hideDecrypted,
    deleteRecord,
  } = useVaultStore();
  const refreshAudit = useAuditStore((s) => s.refreshAll);

  const [title, setTitle] = useState('');
  const [classification, setClassification] = useState('RESTRICTED');
  const [plaintext, setPlaintext] = useState('');
  const [fileName, setFileName] = useState<string | undefined>();
  const [mimeType, setMimeType] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Please select a text/document file under 2 MB for browser encryption.');
      return;
    }
    const text = await file.text();
    setPlaintext(text);
    setFileName(file.name);
    setMimeType(file.type || 'text/plain');
    if (!title.trim()) {
      setTitle(file.name);
    }
  };

  const handleEncryptAndUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !plaintext) return;

    const created = await uploadEncryptedRecord({
      title,
      plaintext,
      classification,
      fileName,
      mimeType,
    });

    if (created) {
      setTitle('');
      setPlaintext('');
      setFileName(undefined);
      setMimeType(undefined);
      if (fileInputRef.current) fileInputRef.current.value = '';
      void refreshAudit();
    }
  };

  const handleDecrypt = async (record: (typeof records)[number]) => {
    await decryptRecord(record);
    void refreshAudit();
  };

  const handleDelete = async (id: string) => {
    await deleteRecord(id);
    void refreshAudit();
  };

  const pipelineStep =
    encryptionPhase === 'encrypting'
      ? 2
      : encryptionPhase === 'uploading'
        ? 3
        : encryptionPhase === 'done'
          ? 4
          : plaintext.length > 0
            ? 1
            : 0;

  return (
    <div className="space-y-6">
      {!isUnlocked && <SessionUnlockModal />}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Evidence Sealing Chamber */}
        <section className="vg-panel relative rounded-xl p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <FileLock2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-sm font-bold tracking-tight text-zinc-100">
                  Evidence Sealing Chamber
                </h2>
                <p className="font-mono text-[10px] text-zinc-500">
                  LOCAL AES-256-GCM ENCLAVE
                </p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                isUnlocked
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}
            >
              {isUnlocked ? (
                <>
                  <Shield className="h-3 w-3" /> {keyFingerprint}
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" /> SEALED
                </>
              )}
            </span>
          </div>

          {/* 4-Step Pipeline Indicator */}
          <div className="mb-5 grid grid-cols-4 gap-1.5 rounded-lg border border-white/[0.06] bg-black/40 p-2 font-mono text-[10px]">
            {['01 INPUT', '02 96b IV', '03 GCM-256', '04 STORED'].map((step, idx) => {
              const active = pipelineStep >= idx + 1;
              return (
                <div
                  key={step}
                  className={`rounded px-1.5 py-1 text-center transition ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'text-zinc-600'
                  }`}
                >
                  {step}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleEncryptAndUpload} className="space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                Artifact Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. SOC2-CC6.1 Access Matrix Q4"
                disabled={!isUnlocked}
                className="w-full rounded-lg border border-white/10 bg-[#07090d] px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500/60 focus:outline-none disabled:opacity-45"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                Classification Tier
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CLASSIFICATIONS.map((c) => {
                  const selected = classification === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={!isUnlocked}
                      onClick={() => setClassification(c.id)}
                      className={`rounded-lg border px-2 py-1.5 font-mono text-[11px] font-semibold transition disabled:opacity-40 ${
                        selected
                          ? c.tone
                          : 'border-white/10 bg-[#07090d] text-zinc-500 hover:border-white/20 hover:text-zinc-300'
                      }`}
                    >
                      {c.id}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                  Plaintext Evidence
                </label>
                <label
                  className={`inline-flex cursor-pointer items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-zinc-300 transition hover:border-emerald-500/40 hover:text-emerald-300 ${
                    !isUnlocked ? 'pointer-events-none opacity-40' : ''
                  }`}
                >
                  <FileUp className="h-3 w-3" />
                  {fileName ? fileName : 'Import File'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.json,.md,.csv,.log,.xml,.yaml,.yml"
                    onChange={handleFileSelect}
                    disabled={!isUnlocked}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                rows={6}
                value={plaintext}
                onChange={(e) => setPlaintext(e.target.value)}
                placeholder="Paste compliance logs, incident reports, or JSON evidence. Encrypted locally before leaving this browser..."
                disabled={!isUnlocked}
                className="w-full rounded-lg border border-white/10 bg-[#07090d] p-3 font-mono text-xs leading-relaxed text-zinc-100 placeholder-zinc-600 focus:border-emerald-500/60 focus:outline-none disabled:opacity-45"
                required
              />
            </div>

            <button
              type="submit"
              disabled={!isUnlocked || encryptionPhase === 'encrypting' || encryptionPhase === 'uploading'}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/15 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Upload className="h-4 w-4" />
              {encryptionPhase === 'encrypting'
                ? 'Encrypting via Web Crypto...'
                : encryptionPhase === 'uploading'
                  ? 'Transmitting Opaque Ciphertext...'
                  : 'Seal & Transmit Ciphertext'}
            </button>
          </form>

          {/* Telemetry Readout */}
          {lastEncryptedPreview && (
            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 font-mono text-[11px]">
              <div className="mb-1.5 flex items-center justify-between text-emerald-300">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Sparkles className="h-3 w-3" /> Last Sealed Envelope
                </span>
                <span className="uppercase text-[10px] text-emerald-400/80">{encryptionPhase}</span>
              </div>
              <div className="truncate text-zinc-400">
                <span className="text-zinc-500">IV: </span>
                <span className="text-cyan-300">{lastEncryptedPreview.iv}</span>
              </div>
              <div className="truncate text-zinc-400">
                <span className="text-zinc-500">BLOB: </span>
                <span className="text-zinc-300">{lastEncryptedPreview.ciphertextPreview}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* Right Column: Sealed Artifact Ledger */}
        <section className="vg-panel rounded-xl p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-bold tracking-tight text-zinc-100">
                Sealed Artifact Ledger
              </h2>
              <p className="font-mono text-[11px] text-zinc-500">
                {records.length} OPAQUE RECORD{records.length === 1 ? '' : 'S'} • ZERO PLAINTEXT ON SERVER
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchRecords()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              SYNC
            </button>
          </div>

          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 py-16 text-center">
              <Lock className="mb-3 h-8 w-8 text-zinc-700" />
              <p className="font-display text-sm font-semibold text-zinc-300">
                Vault Ledger Empty
              </p>
              <p className="mt-1 max-w-xs text-xs text-zinc-500">
                Derive your local key and seal a compliance artifact to populate the encrypted
                storage ledger.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record) => {
                const decrypted = decryptedMap[record.id];
                const decryptError = decryptionErrors[record.id];
                const tier =
                  CLASSIFICATIONS.find((c) => c.id === record.metadata.classification) ??
                  CLASSIFICATIONS[1];

                return (
                  <article
                    key={record.id}
                    className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#07090d]/90 p-4 pl-5 transition hover:border-white/15"
                  >
                    {/* Classification Edge Stripe */}
                    <div className={`absolute inset-y-0 left-0 w-1 ${tier.stripe}`} />

                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-sm font-semibold text-zinc-100">
                            {record.metadata.title}
                          </h3>
                          <span
                            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${tier.tone}`}
                          >
                            {record.metadata.classification ?? 'CONFIDENTIAL'}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-zinc-500">
                          <span className="text-zinc-300">{record.owner_id}</span>
                          <span>•</span>
                          <span>{new Date(record.created_at).toLocaleString()}</span>
                          {record.metadata.sizeBytes !== undefined && (
                            <>
                              <span>•</span>
                              <span>{record.metadata.sizeBytes} B</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {decrypted !== undefined ? (
                          <button
                            type="button"
                            onClick={() => hideDecrypted(record.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[11px] font-medium text-zinc-200 hover:bg-white/10"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                            HIDE
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleDecrypt(record)}
                            disabled={!isUnlocked}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 font-mono text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {isUnlocked ? (
                              <Unlock className="h-3.5 w-3.5" />
                            ) : (
                              <Lock className="h-3.5 w-3.5" />
                            )}
                            DECRYPT
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => void handleDelete(record.id)}
                          className="rounded-lg p-1.5 text-zinc-600 transition hover:bg-rose-500/15 hover:text-rose-400"
                          aria-label="Delete encrypted record"
                          title="Delete record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Opaque Ciphertext Telemetry Chips */}
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <CopyChip label="IV" value={record.iv} />
                      <CopyChip label="CIPHER" value={record.ciphertext} />
                    </div>

                    {decryptError && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                        <span>{decryptError}</span>
                      </div>
                    )}

                    {decrypted !== undefined && (
                      <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3.5">
                        <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-emerald-300">
                          <span className="inline-flex items-center gap-1.5 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            IN-MEMORY PLAINTEXT VIEW
                          </span>
                          <Eye className="h-3.5 w-3.5 opacity-70" />
                        </div>
                        <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-zinc-200">
                          {decrypted}
                        </pre>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
