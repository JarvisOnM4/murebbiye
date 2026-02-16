const DEFAULT_DB_BACKOFF_MS = 60000;

const globalForPersistence = globalThis as unknown as {
  dbRetryAt?: number;
};

function backoffMs() {
  const raw = Number(process.env.DB_FALLBACK_BACKOFF_MS ?? DEFAULT_DB_BACKOFF_MS);

  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_DB_BACKOFF_MS;
  }

  return Math.floor(raw);
}

export function shouldAttemptDb() {
  const retryAt = globalForPersistence.dbRetryAt ?? 0;
  return Date.now() >= retryAt;
}

export function markDbFailure() {
  globalForPersistence.dbRetryAt = Date.now() + backoffMs();
}

export function markDbSuccess() {
  globalForPersistence.dbRetryAt = 0;
}

export function dbCooldownRemainingMs() {
  const retryAt = globalForPersistence.dbRetryAt ?? 0;
  return Math.max(0, retryAt - Date.now());
}
