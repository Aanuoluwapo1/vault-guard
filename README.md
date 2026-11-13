# VaultGuard — Encrypted Compliance Audit Hub

**VaultGuard** is a zero-knowledge Encrypted Compliance Audit Hub featuring **client-side end-to-end encryption (E2EE)** via the browser's native Web Crypto API (`window.crypto.subtle`) and **cryptographically hash-chained immutable audit logs** backed by SQLite and Node.js `crypto`.

---

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        Browser (Client / E2EE)                       │
│                                                                      │
│  Passphrase + Actor Salt                                             │
│       │                                                              │
│       ▼  PBKDF2-HMAC-SHA256 (310,000 iterations)                     │
│  Non-extractable AES-GCM-256 CryptoKey (In-Memory Only)              │
│       │                                                              │
│       ├─► Encrypts compliance evidence + fresh 96-bit random IV      │
│       └─► Decrypts fetched ciphertext blobs locally on demand        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS / JSON (Opaque Ciphertext + IV)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Node.js + Express API (/server)                    │
│                                                                      │
│  ├── /api/vault   ──► VaultService  ──► vault_records (SQLite)       │
│  └── /api/audit   ──► AuditService  ──► audit_logs (Append-Only)     │
│                         │                                            │
│                         ▼  SHA-256(id, actor, action, ..., prevHash) │
│                     Hash-Chain Verifier (Detects Tampering & Gaps)   │
└──────────────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

- `package.json` — Root npm workspace configuration (`server`, `client`).
- `server/` — Express + TypeScript + Node.js `node:sqlite` API & SHA-256 hash-chain audit engine.
  - `src/db/index.ts` — SQLite schema (`vault_records`, `audit_logs`) with `BEFORE UPDATE` / `BEFORE DELETE` append-only triggers.
  - `src/services/audit.service.ts` — Transactional SHA-256 hash-chain appender and `verifyChain()` integrity verifier.
  - `src/services/vault.service.ts` — Opaque ciphertext storage that atomically logs `VAULT_CREATE`, `VAULT_READ`, and `VAULT_DELETE`.
  - `src/routes/` — REST endpoints for `/api/vault` and `/api/audit`.
- `client/` — React + TypeScript + Vite + Tailwind CSS + Zustand frontend.
  - `src/crypto/subtle.ts` — Native Web Crypto API wrapper (`PBKDF2` + `AES-GCM-256`).
  - `src/store/` — Zustand stores for session/key state, vault records, and audit verification.
  - `src/components/` — `VaultDashboard` (encrypt/upload & client-side decryption viewer) and `AuditExplorer` (hash-chained log table & live Chain Integrity Verification badge).

---

## Threat Model & Security Guarantees

| Threat Vector | Mitigation in VaultGuard |
| :--- | :--- |
| **Compromised Server / Database Leak** | Plaintext compliance documents, master passphrases, and `CryptoKey` objects **never leave the client**. The server only stores Base64-encoded AES-GCM ciphertext and 96-bit IVs. |
| **Passphrase Extraction from Browser** | `PBKDF2-HMAC-SHA256` (310,000 iterations) derives an `AES-GCM-256` `CryptoKey` with `extractable: false`. Keys exist strictly in JS memory and are purged when locking the vault or closing the tab. |
| **Ciphertext Tampering / Bit-Flipping** | AES-GCM includes a 128-bit authentication tag. Any modification to the ciphertext or IV causes `crypto.subtle.decrypt` to fail immediately. |
| **IV Reuse** | Every `encryptBytes` / `encryptString` call generates a fresh 12-byte (96-bit) cryptographically random IV via `crypto.getRandomValues`. |
| **Audit Log Alteration or Deletion** | `audit_logs` is protected by SQLite `BEFORE UPDATE` and `BEFORE DELETE` triggers. Even if an attacker bypasses triggers out-of-band, `AuditService.verifyChain()` detects payload hash mismatches, broken `previous_hash` links, and sequence ID gaps. |

> **Scope & Operational Notes:**
> - Document metadata (`title`, `classification`, `sizeBytes`) is stored unencrypted for indexing in this hub; sensitive details belong inside the encrypted payload.
> - Production deployments should terminate TLS (HTTPS) in front of the API so `window.crypto.subtle` operates in a secure context and transport metadata is protected.

---

## Quick Start

### Prerequisites
- Node.js `>= 24` (required for built-in `node:sqlite`)
- npm `>= 10`

### 1. Install Dependencies
```bash
cd vault-guard
npm install
```

### 2. Run in Development Mode
Starts both the Express backend (`http://localhost:4000`) and Vite frontend (`http://localhost:5173`):
```bash
npm run dev
```

### 3. Typecheck, Test & Build
```bash
npm run typecheck
npm run test
npm run build
```

### 4. Production Container Deployment (Unified Port 80 via Nginx)
```bash
docker compose up --build -d
```
- Only `vault-client` (Nginx) exposes port `80` (`http://localhost`).
- `/api/*` requests are reverse-proxied internally to `http://vault-server:3001/api/` on the private `vault-net` bridge network; `vault-server` is not directly exposed to the host.

