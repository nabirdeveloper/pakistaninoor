'use client';

import { useCallback, useState } from 'react';

export type AiContentAction = 'description' | 'seo' | 'tags';

interface UseProductAiReturn {
  /** The action currently being generated, or null when idle. */
  busy: AiContentAction | null;
  /** 'ai' when the microservice answered, 'local' when the in-app engine did. */
  source: 'ai' | 'local' | null;
  isBusy: boolean;
  generate: <T>(action: AiContentAction, payload: Record<string, unknown>) => Promise<T>;
}

/**
 * Admin product-form AI helper. Calls the server-side proxy
 * /api/admin/ai-content (which falls back to local template engines when the
 * AI microservice is unreachable) and reports the generation source.
 */
export function useProductAi(): UseProductAiReturn {
  const [busy, setBusy] = useState<AiContentAction | null>(null);
  const [source, setSource] = useState<'ai' | 'local' | null>(null);

  const generate = useCallback(async <T,>(action: AiContentAction, payload: Record<string, unknown>): Promise<T> => {
    setBusy(action);
    setSource(null);
    try {
      const res = await fetch('/api/admin/ai-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'AI generation failed');
      }
      setSource(data.source || 'local');
      return data.result as T;
    } finally {
      setBusy(null);
    }
  }, []);

  return { busy, source, isBusy: busy !== null, generate };
}