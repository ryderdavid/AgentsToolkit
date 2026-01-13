type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
};

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 200;

  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const delay = baseDelayMs * Math.pow(2, i);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
