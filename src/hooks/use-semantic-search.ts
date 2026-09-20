import { useCallback, useEffect, useRef, useState } from 'react';

import { backfillEmbeddingsForMoment } from '@/lib/embedding-backfill';
import { areModelsReady, DownloadProgress, ensureModelsReady } from '@/lib/model-manager';
import { formatSearchError, logSearchError } from '@/lib/search-errors';
import { SearchResult, searchPhotos } from '@/lib/semantic-search';

export function useSemanticSearch(momentId?: string) {
  const [modelsReady, setModelsReady] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void areModelsReady().then((ready) => {
      if (ready) {
        setModelsReady(true);
        if (momentId) void backfillEmbeddingsForMoment(momentId);
        return;
      }

      void ensureModelsReady(setDownloadProgress)
        .then(() => {
          setModelsReady(true);
          if (momentId) void backfillEmbeddingsForMoment(momentId);
        })
        .catch((err) => {
          logSearchError('model download', err);
          setError(formatSearchError(err));
        });
    });
  }, [momentId]);

  const onQueryChange = useCallback(
    (text: string) => {
      setQuery(text);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!text.trim()) {
        setResults([]);
        return;
      }

      if (!modelsReady) return;

      debounceRef.current = setTimeout(() => {
        void (async () => {
          setIsSearching(true);
          setError(null);
          try {
            const nextResults = await searchPhotos(text.trim(), { momentId });
            setResults(nextResults);
          } catch (err) {
            logSearchError('search', err);
            setError(formatSearchError(err));
            setResults([]);
          } finally {
            setIsSearching(false);
          }
        })();
      }, 300);
    },
    [momentId, modelsReady]
  );

  const emptyMessage =
    query.trim() && !isSearching && !error && results.length === 0
      ? 'No matching photos yet. New photos are indexed after upload.'
      : null;

  return {
    query,
    onQueryChange,
    results,
    isSearching,
    modelsReady,
    downloadProgress,
    error,
    emptyMessage,
  };
}
