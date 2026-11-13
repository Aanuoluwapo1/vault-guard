import { createApp } from './app.js';

const PORT = Number.parseInt(process.env.PORT ?? '4000', 10);

const { app, db } = createApp();

const server = app.listen(PORT, () => {
  console.log(`[VaultGuard] Secure Audit API listening on http://localhost:${PORT}`);
});

function shutdown() {
  console.log('[VaultGuard] Shutting down gracefully...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
