import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  CharacterActor,
  RenderJob,
  ShowProfile,
  SupportedLanguage,
  VoicePersona,
} from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Mandatory startup connection verification
async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged };

// Defensive payload sanitizers matching firebase-blueprint.json & firestore.rules
const ALLOWED_LANGUAGES: SupportedLanguage[] = [
  'Urdu',
  'English',
  'Arabic',
  'Hindi',
  'Spanish',
  'Turkish',
  'French',
  'Chinese',
];

function sanitizeLanguages(langs: SupportedLanguage[]): SupportedLanguage[] {
  const filtered = langs.filter((l) => ALLOWED_LANGUAGES.includes(l)).slice(0, 8);
  return filtered.length > 0 ? filtered : ['English'];
}

function clampStr(val: string | undefined, max: number, fallback = ''): string {
  const str = (val ?? fallback).trim();
  return str.slice(0, max);
}

function toMs(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (typeof val === 'number') {
    return val;
  }
  return Date.now();
}

export async function createShowInFirestore(show: ShowProfile): Promise<void> {
  const path = `shows/${show.id}`;
  try {
    await setDoc(doc(db, 'shows', show.id), {
      ownerId: clampStr(show.ownerId, 128),
      title: clampStr(show.title, 160, 'Untitled Show') || 'Untitled Show',
      titleIdeaPrompt: clampStr(show.titleIdeaPrompt, 1000),
      logline: clampStr(show.logline, 600),
      contentMode: show.contentMode,
      visualStyle: show.visualStyle,
      aspectRatio: show.aspectRatio,
      fps: show.fps,
      resolution: show.resolution,
      languages: sanitizeLanguages(show.languages),
      includeIntro: Boolean(show.includeIntro),
      includeEndCredits: Boolean(show.includeEndCredits),
      includeTrailer: Boolean(show.includeTrailer),
      storyPrompt: clampStr(show.storyPrompt, 8000),
      thumbnailAssetId: clampStr(show.thumbnailAssetId, 160),
      characterCount: Math.max(0, Math.min(100, Math.floor(show.characterCount || 0))),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateShowInFirestore(show: ShowProfile): Promise<void> {
  const path = `shows/${show.id}`;
  try {
    await updateDoc(doc(db, 'shows', show.id), {
      title: clampStr(show.title, 160, 'Untitled Show') || 'Untitled Show',
      titleIdeaPrompt: clampStr(show.titleIdeaPrompt, 1000),
      logline: clampStr(show.logline, 600),
      contentMode: show.contentMode,
      visualStyle: show.visualStyle,
      aspectRatio: show.aspectRatio,
      fps: show.fps,
      resolution: show.resolution,
      languages: sanitizeLanguages(show.languages),
      includeIntro: Boolean(show.includeIntro),
      includeEndCredits: Boolean(show.includeEndCredits),
      includeTrailer: Boolean(show.includeTrailer),
      storyPrompt: clampStr(show.storyPrompt, 8000),
      thumbnailAssetId: clampStr(show.thumbnailAssetId, 160),
      characterCount: Math.max(0, Math.min(100, Math.floor(show.characterCount || 0))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteShowFromFirestore(showId: string): Promise<void> {
  const path = `shows/${showId}`;
  try {
    await deleteDoc(doc(db, 'shows', showId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createCharacterInFirestore(char: CharacterActor): Promise<void> {
  const path = `shows/${char.showId}/characters/${char.id}`;
  try {
    await setDoc(doc(db, 'shows', char.showId, 'characters', char.id), {
      showId: clampStr(char.showId, 128),
      ownerId: clampStr(char.ownerId, 128),
      name: clampStr(char.name, 100, 'Actor') || 'Actor',
      age: clampStr(char.age, 40, '25') || '25',
      relation: clampStr(char.relation, 80, 'Lead') || 'Lead',
      visualPrompt: clampStr(char.visualPrompt, 1200, 'Expressive face') || 'Expressive face',
      faceLocked: Boolean(char.faceLocked),
      lockedFaceSignature: clampStr(char.lockedFaceSignature, 1200),
      lockedFaceAssetId: clampStr(char.lockedFaceAssetId, 160),
      voicePersona: char.voicePersona || ('Kore' as VoicePersona),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCharacterInFirestore(char: CharacterActor): Promise<void> {
  const path = `shows/${char.showId}/characters/${char.id}`;
  try {
    await updateDoc(doc(db, 'shows', char.showId, 'characters', char.id), {
      name: clampStr(char.name, 100, 'Actor') || 'Actor',
      age: clampStr(char.age, 40, '25') || '25',
      relation: clampStr(char.relation, 80, 'Lead') || 'Lead',
      visualPrompt: clampStr(char.visualPrompt, 1200, 'Expressive face') || 'Expressive face',
      faceLocked: Boolean(char.faceLocked),
      lockedFaceSignature: clampStr(char.lockedFaceSignature, 1200),
      lockedFaceAssetId: clampStr(char.lockedFaceAssetId, 160),
      voicePersona: char.voicePersona || ('Kore' as VoicePersona),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCharacterFromFirestore(
  showId: string,
  charId: string
): Promise<void> {
  const path = `shows/${showId}/characters/${charId}`;
  try {
    await deleteDoc(doc(db, 'shows', showId, 'characters', charId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createRenderJobInFirestore(job: RenderJob): Promise<void> {
  const path = `renderJobs/${job.id}`;
  try {
    await setDoc(doc(db, 'renderJobs', job.id), {
      ownerId: clampStr(job.ownerId, 128),
      showId: clampStr(job.showId, 128),
      showTitle: clampStr(job.showTitle, 160, 'Untitled Show') || 'Untitled Show',
      episodeTitle: clampStr(job.episodeTitle, 160, 'Episode 1') || 'Episode 1',
      status: job.status,
      currentStepLabel: clampStr(job.currentStepLabel, 240),
      completedSteps: Math.max(0, Math.min(500, Math.floor(job.completedSteps))),
      totalSteps: Math.max(1, Math.min(500, Math.floor(job.totalSteps))),
      retryCount: Math.max(0, Math.min(50, Math.floor(job.retryCount))),
      aspectRatio: job.aspectRatio,
      fps: job.fps,
      resolution: job.resolution,
      languages: sanitizeLanguages(job.languages),
      sceneCount: Math.max(1, Math.min(30, Math.floor(job.sceneCount))),
      zipAssetId: clampStr(job.zipAssetId, 160),
      thumbnailAssetId: clampStr(job.thumbnailAssetId, 160),
      checkpointKey: clampStr(job.checkpointKey, 160),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateRenderJobInFirestore(job: RenderJob): Promise<void> {
  const path = `renderJobs/${job.id}`;
  try {
    await updateDoc(doc(db, 'renderJobs', job.id), {
      status: job.status,
      currentStepLabel: clampStr(job.currentStepLabel, 240),
      completedSteps: Math.max(0, Math.min(500, Math.floor(job.completedSteps))),
      totalSteps: Math.max(1, Math.min(500, Math.floor(job.totalSteps))),
      retryCount: Math.max(0, Math.min(50, Math.floor(job.retryCount))),
      sceneCount: Math.max(1, Math.min(30, Math.floor(job.sceneCount))),
      zipAssetId: clampStr(job.zipAssetId, 160),
      thumbnailAssetId: clampStr(job.thumbnailAssetId, 160),
      checkpointKey: clampStr(job.checkpointKey, 160),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteRenderJobFromFirestore(jobId: string): Promise<void> {
  const path = `renderJobs/${jobId}`;
  try {
    await deleteDoc(doc(db, 'renderJobs', jobId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserShows(
  uid: string,
  onData: (shows: ShowProfile[]) => void
): () => void {
  const q = query(collection(db, 'shows'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items: ShowProfile[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: data.ownerId,
          title: data.title,
          titleIdeaPrompt: data.titleIdeaPrompt || '',
          logline: data.logline || '',
          contentMode: data.contentMode,
          visualStyle: data.visualStyle,
          aspectRatio: data.aspectRatio,
          fps: data.fps,
          resolution: data.resolution,
          languages: data.languages || ['English'],
          includeIntro: Boolean(data.includeIntro),
          includeEndCredits: Boolean(data.includeEndCredits),
          includeTrailer: Boolean(data.includeTrailer),
          storyPrompt: data.storyPrompt || '',
          thumbnailAssetId: data.thumbnailAssetId || '',
          characterCount: data.characterCount || 0,
          createdAtMs: toMs(data.createdAt),
          updatedAtMs: toMs(data.updatedAt),
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'shows');
    }
  );
}

export function subscribeShowCharacters(
  uid: string,
  showId: string,
  onData: (chars: CharacterActor[]) => void
): () => void {
  const path = `shows/${showId}/characters`;
  const q = query(
    collection(db, 'shows', showId, 'characters'),
    where('ownerId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: CharacterActor[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          showId: data.showId,
          ownerId: data.ownerId,
          name: data.name,
          age: data.age,
          relation: data.relation,
          visualPrompt: data.visualPrompt,
          faceLocked: Boolean(data.faceLocked),
          lockedFaceSignature: data.lockedFaceSignature || '',
          lockedFaceAssetId: data.lockedFaceAssetId || '',
          voicePersona: data.voicePersona || 'Kore',
          createdAtMs: toMs(data.createdAt),
          updatedAtMs: toMs(data.updatedAt),
        };
      });
      items.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeUserRenderJobs(
  uid: string,
  onData: (jobs: RenderJob[]) => void
): () => void {
  const q = query(collection(db, 'renderJobs'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items: RenderJob[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: data.ownerId,
          showId: data.showId,
          showTitle: data.showTitle,
          episodeTitle: data.episodeTitle,
          status: data.status,
          currentStepLabel: data.currentStepLabel || '',
          completedSteps: data.completedSteps || 0,
          totalSteps: data.totalSteps || 1,
          retryCount: data.retryCount || 0,
          aspectRatio: data.aspectRatio,
          fps: data.fps,
          resolution: data.resolution,
          languages: data.languages || ['English'],
          sceneCount: data.sceneCount || 1,
          zipAssetId: data.zipAssetId || '',
          thumbnailAssetId: data.thumbnailAssetId || '',
          checkpointKey: data.checkpointKey || '',
          createdAtMs: toMs(data.createdAt),
          updatedAtMs: toMs(data.updatedAt),
        };
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'renderJobs');
    }
  );
}
