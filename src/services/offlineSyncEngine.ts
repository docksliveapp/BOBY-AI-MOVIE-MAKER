import {
  createCharacterInFirestore,
  createRenderJobInFirestore,
  createShowInFirestore,
  deleteCharacterFromFirestore,
  deleteRenderJobFromFirestore,
  deleteShowFromFirestore,
  updateCharacterInFirestore,
  updateRenderJobInFirestore,
  updateShowInFirestore,
} from '../firebase';
import type { CharacterActor, RenderJob, ShowProfile } from '../types';
import {
  enqueueOfflineMutation,
  getPendingOfflineMutations,
  OfflineSyncMutation,
  removeOfflineMutation,
} from './mediaVault';

export type SyncEngineState = 'synced' | 'syncing' | 'offline_pending' | 'local_only';

function isNetworkUnavailable(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * Executes a Firestore write when online; if offline or transiently disconnected,
 * persists the mutation in IndexedDB sync_outbox so it auto-syncs the moment
 * internet connectivity returns across Web PWA, Android, iOS, and Windows.
 */
export async function executeOrQueueCloudMutation(
  mutation: Omit<OfflineSyncMutation, 'id' | 'queuedAtMs'>
): Promise<{ queuedOffline: boolean }> {
  const fullMutation: OfflineSyncMutation = {
    ...mutation,
    id: `${mutation.entity}_${mutation.action}_${mutation.docId}_${Date.now()}`,
    queuedAtMs: Date.now(),
  };

  if (isNetworkUnavailable()) {
    await enqueueOfflineMutation(fullMutation);
    return { queuedOffline: true };
  }

  try {
    await applyMutationToFirestore(fullMutation);
    return { queuedOffline: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isOfflineErr =
      msg.includes('offline') ||
      msg.includes('unavailable') ||
      msg.includes('Failed to fetch') ||
      msg.includes('network');
    if (isOfflineErr) {
      await enqueueOfflineMutation(fullMutation);
      return { queuedOffline: true };
    }
    throw err;
  }
}

async function applyMutationToFirestore(m: OfflineSyncMutation): Promise<void> {
  if (m.entity === 'show') {
    if (m.action === 'create' && m.payload) {
      await createShowInFirestore(m.payload as ShowProfile);
    } else if (m.action === 'update' && m.payload) {
      await updateShowInFirestore(m.payload as ShowProfile);
    } else if (m.action === 'delete') {
      await deleteShowFromFirestore(m.docId);
    }
    return;
  }

  if (m.entity === 'character') {
    if (m.action === 'create' && m.payload) {
      await createCharacterInFirestore(m.payload as CharacterActor);
    } else if (m.action === 'update' && m.payload) {
      await updateCharacterInFirestore(m.payload as CharacterActor);
    } else if (m.action === 'delete' && m.parentId) {
      await deleteCharacterFromFirestore(m.parentId, m.docId);
    }
    return;
  }

  if (m.entity === 'renderJob') {
    if (m.action === 'create' && m.payload) {
      await createRenderJobInFirestore(m.payload as RenderJob);
    } else if (m.action === 'update' && m.payload) {
      await updateRenderJobInFirestore(m.payload as RenderJob);
    } else if (m.action === 'delete') {
      await deleteRenderJobFromFirestore(m.docId);
    }
  }
}

/**
 * Replays all pending IndexedDB mutations sequentially to Firebase Firestore once online.
 */
export async function flushOfflineSyncOutbox(uid: string): Promise<{
  syncedCount: number;
  remainingCount: number;
}> {
  if (!uid || isNetworkUnavailable()) {
    const pending = await getPendingOfflineMutations(uid);
    return { syncedCount: 0, remainingCount: pending.length };
  }

  const pending = await getPendingOfflineMutations(uid);
  let syncedCount = 0;

  for (const item of pending) {
    if (isNetworkUnavailable()) break;
    try {
      await applyMutationToFirestore(item);
      await removeOfflineMutation(item.id);
      syncedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not-found') || msg.includes('NOT_FOUND') || msg.includes('PERMISSION_DENIED')) {
        await removeOfflineMutation(item.id);
      } else {
        break;
      }
    }
  }

  const remaining = await getPendingOfflineMutations(uid);
  return { syncedCount, remainingCount: remaining.length };
}
