export function formatSearchError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;

  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.length > 0) {
      return record.message;
    }
    if (typeof record.error === 'string' && record.error.length > 0) {
      return record.error;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return 'Search failed';
    }
  }

  return 'Search failed';
}

export function logSearchError(scope: string, err: unknown): void {
  if (!__DEV__) return;
  console.error(`[semantic-search] ${scope}:`, err);
}

export function logSearchStep(scope: string, data?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (data) {
    console.log(`[semantic-search] ${scope}`, data);
    return;
  }
  console.log(`[semantic-search] ${scope}`);
}
