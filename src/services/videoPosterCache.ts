import { useSyncExternalStore } from 'react';

const posters = new Map<string, string>();
const listeners = new Set<() => void>();
let revision = 0;

export function getCachedVideoPoster(nodeId: string | undefined): string | undefined {
  return nodeId ? posters.get(nodeId) : undefined;
}

export function setCachedVideoPoster(nodeId: string, posterUrl: string): void {
  if (!nodeId || !posterUrl || posters.get(nodeId) === posterUrl) return;
  posters.set(nodeId, posterUrl);
  revision += 1;
  listeners.forEach((listener) => listener());
}

function subscribeVideoPosterCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getVideoPosterSnapshot(): number {
  return revision;
}

export function useVideoPosterRevision(): number {
  return useSyncExternalStore(
    subscribeVideoPosterCache,
    getVideoPosterSnapshot,
    getVideoPosterSnapshot,
  );
}
