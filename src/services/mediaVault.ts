import type { CharacterActor, PipelineCheckpoint, RenderJob, ShowProfile } from '../types';

const DB_NAME = 'boby_ai_movie_maker_vault_v1';
const DB_VERSION = 2;
const STORE_ASSETS = 'media_assets';
const STORE_CHECKPOINTS = 'pipeline_checkpoints';
const STORE_OFFLINE_DB = 'offline_records';
const STORE_SYNC_OUTBOX = 'sync_outbox';

export interface OfflineSyncMutation {
  id: string;
  uid: string;
  entity: 'show' | 'character' | 'renderJob';
  action: 'create' | 'update' | 'delete';
  docId: string;
  parentId?: string;
  payload?: ShowProfile | CharacterActor | RenderJob;
  queuedAtMs: number;
}

export interface OfflineUserSnapshot {
  uid: string;
  shows: ShowProfile[];
  charactersByShow: Record<string, CharacterActor[]>;
  jobs: RenderJob[];
  updatedAtMs: number;
}

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS);
      }
      if (!db.objectStoreNames.contains(STORE_CHECKPOINTS)) {
        db.createObjectStore(STORE_CHECKPOINTS);
      }
      if (!db.objectStoreNames.contains(STORE_OFFLINE_DB)) {
        db.createObjectStore(STORE_OFFLINE_DB);
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_OUTBOX)) {
        db.createObjectStore(STORE_SYNC_OUTBOX, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function isSafeMediaUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/')) return true;
  if (url.startsWith('data:image/') || url.startsWith('data:video/') || url.startsWith('data:audio/')) {
    return true;
  }
  if (url.startsWith('blob:')) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function saveAssetToVault(assetId: string, value: string | Blob): Promise<void> {
  if (!assetId) return;
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readwrite');
    tx.objectStore(STORE_ASSETS).put(value, assetId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAssetFromVault(assetId: string): Promise<string | Blob | null> {
  if (!assetId) return null;
  if (
    assetId.startsWith('/') ||
    assetId.startsWith('https://') ||
    assetId.startsWith('data:')
  ) {
    return isSafeMediaUrl(assetId) ? assetId : null;
  }
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readonly');
    const req = tx.objectStore(STORE_ASSETS).get(assetId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getImageUrlFromVault(
  assetId: string
): Promise<{ url: string | null; isObjectUrl: boolean }> {
  if (!assetId) return { url: null, isObjectUrl: false };
  if (assetId.startsWith('/') || assetId.startsWith('https://') || assetId.startsWith('data:')) {
    return { url: isSafeMediaUrl(assetId) ? assetId : null, isObjectUrl: false };
  }
  const stored = await getAssetFromVault(assetId);
  if (!stored) return { url: null, isObjectUrl: false };
  if (typeof stored === 'string') {
    return { url: isSafeMediaUrl(stored) ? stored : null, isObjectUrl: false };
  }
  return { url: URL.createObjectURL(stored), isObjectUrl: true };
}

export async function saveCheckpointToVault(
  checkpointKey: string,
  checkpoint: PipelineCheckpoint
): Promise<void> {
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHECKPOINTS, 'readwrite');
    tx.objectStore(STORE_CHECKPOINTS).put(checkpoint, checkpointKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCheckpointFromVault(
  checkpointKey: string
): Promise<PipelineCheckpoint | null> {
  if (!checkpointKey) return null;
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHECKPOINTS, 'readonly');
    const req = tx.objectStore(STORE_CHECKPOINTS).get(checkpointKey);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

// --- Offline Database Snapshot Storage (Works in Web PWA, Android, iOS & Windows Electron) ---
export async function saveOfflineUserSnapshot(snapshot: OfflineUserSnapshot): Promise<void> {
  if (!snapshot.uid) return;
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OFFLINE_DB, 'readwrite');
    tx.objectStore(STORE_OFFLINE_DB).put(snapshot, `user_${snapshot.uid}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineUserSnapshot(uid: string): Promise<OfflineUserSnapshot | null> {
  if (!uid) return null;
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OFFLINE_DB, 'readonly');
    const req = tx.objectStore(STORE_OFFLINE_DB).get(`user_${uid}`);
    req.onsuccess = () => resolve((req.result as OfflineUserSnapshot) ?? null);
    req.onerror = () => reject(req.error);
  });
}

// --- Persistent Offline Sync Outbox (Auto-Flushes on Reconnect) ---
export async function enqueueOfflineMutation(mutation: OfflineSyncMutation): Promise<void> {
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SYNC_OUTBOX, 'readwrite');
    tx.objectStore(STORE_SYNC_OUTBOX).put(mutation);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingOfflineMutations(uid: string): Promise<OfflineSyncMutation[]> {
  if (!uid) return [];
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SYNC_OUTBOX, 'readonly');
    const req = tx.objectStore(STORE_SYNC_OUTBOX).getAll();
    req.onsuccess = () => {
      const all = (req.result as OfflineSyncMutation[]) || [];
      const mine = all
        .filter((m) => m.uid === uid)
        .sort((a, b) => a.queuedAtMs - b.queuedAtMs);
      resolve(mine);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function removeOfflineMutation(id: string): Promise<void> {
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SYNC_OUTBOX, 'readwrite');
    tx.objectStore(STORE_SYNC_OUTBOX).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Storage Telemetry & Maintenance Tools ---
export async function getVaultStorageStats(): Promise<{
  usedMb: number;
  quotaMb: number;
  assetCount: number;
  checkpointCount: number;
}> {
  let usedMb = 0;
  let quotaMb = 0;
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      usedMb = Number(((est.usage || 0) / (1024 * 1024)).toFixed(1));
      quotaMb = Number(((est.quota || 0) / (1024 * 1024)).toFixed(0));
    }
  } catch {
    // Ignore unsupported browsers
  }

  let assetCount = 0;
  let checkpointCount = 0;
  try {
    const db = await openVaultDb();
    assetCount = await new Promise<number>((resolve) => {
      const tx = db.transaction(STORE_ASSETS, 'readonly');
      const req = tx.objectStore(STORE_ASSETS).count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
    checkpointCount = await new Promise<number>((resolve) => {
      const tx = db.transaction(STORE_CHECKPOINTS, 'readonly');
      const req = tx.objectStore(STORE_CHECKPOINTS).count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch {
    // Ignore
  }

  return { usedMb, quotaMb, assetCount, checkpointCount };
}

export async function clearCachedRenderBundles(): Promise<number> {
  const db = await openVaultDb();
  let removed = 0;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_ASSETS, STORE_CHECKPOINTS], 'readwrite');
    const assetsStore = tx.objectStore(STORE_ASSETS);
    const keyReq = assetsStore.getAllKeys();
    keyReq.onsuccess = () => {
      for (const k of keyReq.result) {
        if (typeof k === 'string' && (k.startsWith('zip_bundle_') || k.startsWith('job_thumb_'))) {
          assetsStore.delete(k);
          removed++;
        }
      }
    };
    tx.objectStore(STORE_CHECKPOINTS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return removed;
}
