import type { Document, Tab } from '../types';
import { getDocumentUrl, getDocuments, getTabs } from './api';

interface OfflineSnapshot {
  version: string;
  syncedAt: string;
  totalDocuments: number;
  tabs: Tab[];
  documentsByTab: Record<string, Document[]>;
  documentFingerprints: Record<string, string>;
}

export interface OfflineSnapshotMeta {
  version: string;
  syncedAt: string;
  totalDocuments: number;
}

export interface OfflineSyncResult {
  syncedAt: string;
  version: string;
  totalDocuments: number;
  downloadedCount: number;
  skippedCount: number;
}

const OFFLINE_SNAPSHOT_KEY = 'agenda_offline_snapshot_v1';
const OFFLINE_PDF_CACHE = 'agenda-offline-pdf-v1';
const OFFLINE_PDF_PREFIX = '/__offline_pdf__';
const MAX_PARALLEL_DOWNLOADS = 4;

const safeJsonParse = <T>(value: string | null): T | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const getPdfCacheKey = (document: Document): string => {
  return `${OFFLINE_PDF_PREFIX}/tab-${document.tab_id}/${encodeURIComponent(document.filename)}`;
};

const getDocumentFingerprint = (document: Document): string => {
  return [
    document.id,
    document.tab_id,
    document.filename,
    document.original_name,
    document.file_size,
    document.created_at
  ].join('|');
};

const computeVersion = (tabs: Tab[], documentsByTab: Record<string, Document[]>): string => {
  const base = JSON.stringify({
    tabs: tabs.map((tab) => ({ id: tab.id, name: tab.name, order_index: tab.order_index })),
    documentsByTab: Object.entries(documentsByTab)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([tabId, documents]) => ({
        tabId: Number(tabId),
        documents: documents.map((document) => ({
          id: document.id,
          filename: document.filename,
          original_name: document.original_name,
          file_size: document.file_size,
          created_at: document.created_at
        }))
      }))
  });

  // Hash ligero para etiquetar versión sin depender de librerías externas.
  let hash = 5381;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash * 33) ^ base.charCodeAt(i);
  }
  return `v${(hash >>> 0).toString(16)}`;
};

const readSnapshot = (): OfflineSnapshot | null => {
  return safeJsonParse<OfflineSnapshot>(window.localStorage.getItem(OFFLINE_SNAPSHOT_KEY));
};

const writeSnapshot = (snapshot: OfflineSnapshot) => {
  window.localStorage.setItem(OFFLINE_SNAPSHOT_KEY, JSON.stringify(snapshot));
};

const getCacheStorage = (): CacheStorage => {
  if (!('caches' in window)) {
    throw new Error('El navegador no soporta almacenamiento offline (Cache Storage).');
  }
  return window.caches;
};

export const hasOfflineAgendaSnapshot = (): boolean => {
  const snapshot = readSnapshot();
  return Boolean(snapshot && Array.isArray(snapshot.tabs) && snapshot.tabs.length > 0);
};

export const getOfflineSnapshotMeta = (): OfflineSnapshotMeta | null => {
  const snapshot = readSnapshot();
  if (!snapshot) {
    return null;
  }

  return {
    version: snapshot.version,
    syncedAt: snapshot.syncedAt,
    totalDocuments: snapshot.totalDocuments
  };
};

export const getOfflineTabs = (): Tab[] => {
  const snapshot = readSnapshot();
  return snapshot?.tabs || [];
};

export const getOfflineDocumentsByTab = (tabId: number): Document[] => {
  const snapshot = readSnapshot();
  if (!snapshot) {
    return [];
  }

  return snapshot.documentsByTab[String(tabId)] || [];
};

const runWithConcurrency = async <T>(
  entries: T[],
  limit: number,
  worker: (entry: T) => Promise<void>
) => {
  const queue = [...entries];
  const runners = Array.from({ length: Math.max(1, Math.min(limit, queue.length)) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) {
        return;
      }
      await worker(next);
    }
  });

  await Promise.all(runners);
};

export const syncOfflineAgenda = async (): Promise<OfflineSyncResult> => {
  const previousSnapshot = readSnapshot();
  const previousFingerprints = previousSnapshot?.documentFingerprints || {};

  const tabs = await getTabs();
  const documentsByTab: Record<string, Document[]> = {};
  const allDocuments: Document[] = [];

  for (const tab of tabs) {
    const documents = await getDocuments(tab.id);
    documentsByTab[String(tab.id)] = documents;
    allDocuments.push(...documents);
  }

  const cacheStorage = getCacheStorage();
  const cache = await cacheStorage.open(OFFLINE_PDF_CACHE);
  const nextFingerprints: Record<string, string> = {};
  const expectedCacheUrls = new Set<string>();
  let downloadedCount = 0;
  let skippedCount = 0;

  await runWithConcurrency(allDocuments, MAX_PARALLEL_DOWNLOADS, async (document) => {
    const cacheKey = getPdfCacheKey(document);
    const absoluteCacheUrl = new URL(cacheKey, window.location.origin).toString();
    expectedCacheUrls.add(absoluteCacheUrl);

    const nextFingerprint = getDocumentFingerprint(document);
    nextFingerprints[cacheKey] = nextFingerprint;

    const cachedResponse = await cache.match(cacheKey);
    const isUnchanged = previousFingerprints[cacheKey] === nextFingerprint;
    if (isUnchanged && cachedResponse) {
      skippedCount += 1;
      return;
    }

    const sourceUrl = getDocumentUrl(document.filename, document.tab_id);
    const response = await fetch(sourceUrl, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`No se pudo descargar "${document.original_name}" (HTTP ${response.status}).`);
    }

    await cache.put(cacheKey, response.clone());
    downloadedCount += 1;
  });

  const cacheEntries = await cache.keys();
  await Promise.all(
    cacheEntries
      .filter((request) => {
        const requestUrl = request.url;
        const belongsToOfflinePdfCache = requestUrl.includes(`${OFFLINE_PDF_PREFIX}/`);
        return belongsToOfflinePdfCache && !expectedCacheUrls.has(requestUrl);
      })
      .map((request) => cache.delete(request))
  );

  const syncedAt = new Date().toISOString();
  const version = computeVersion(tabs, documentsByTab);
  const totalDocuments = allDocuments.length;

  writeSnapshot({
    version,
    syncedAt,
    totalDocuments,
    tabs,
    documentsByTab,
    documentFingerprints: nextFingerprints
  });

  return {
    syncedAt,
    version,
    totalDocuments,
    downloadedCount,
    skippedCount
  };
};

export const getOfflinePdfObjectUrl = async (document: Document): Promise<string | null> => {
  const cacheStorage = getCacheStorage();
  const cache = await cacheStorage.open(OFFLINE_PDF_CACHE);
  const response = await cache.match(getPdfCacheKey(document));
  if (!response) {
    return null;
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
