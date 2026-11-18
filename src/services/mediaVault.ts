import type { PipelineCheckpoint } from '../types';

const DB_NAME = 'boby_ai_movie_maker_vault_v1';
const DB_VERSION = 1;
const STORE_ASSETS = 'media_assets';
const STORE_CHECKPOINTS = 'pipeline_checkpoints';

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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
  if (assetId.startsWith('/') || assetId.startsWith('http') || assetId.startsWith('data:')) {
    return assetId;
  }
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readonly');
    const req = tx.objectStore(STORE_ASSETS).get(assetId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getImageUrlFromVault(assetId: string): Promise<string | null> {
  if (!assetId) return null;
  if (assetId.startsWith('/') || assetId.startsWith('http') || assetId.startsWith('data:')) {
    return assetId;
  }
  const stored = await getAssetFromVault(assetId);
  if (!stored) return null;
  if (typeof stored === 'string') return stored;
  return URL.createObjectURL(stored);
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
