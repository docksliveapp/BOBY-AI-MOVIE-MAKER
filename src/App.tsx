/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  auth,
  createCharacterInFirestore,
  createShowInFirestore,
  onAuthStateChanged,
  signInWithGooglePopup,
  signOutFirebase,
  subscribeFirestoreSyncEvent,
  subscribeShowCharacters,
  subscribeUserRenderJobs,
  subscribeUserShows,
} from './firebase';
import type {
  AspectRatioOption,
  CharacterActor,
  ContentMode,
  FpsOption,
  NavigationTab,
  RenderJob,
  ShowProfile,
  StudioNotification,
  UserSession,
  VisualStyle,
} from './types';
import { mediaPipeline } from './services/mediaPipeline';
import {
  getCheckpointFromVault,
  getOfflineUserSnapshot,
  getPendingOfflineMutations,
  saveCheckpointToVault,
  saveOfflineUserSnapshot,
} from './services/mediaVault';
import {
  executeOrQueueCloudMutation,
  flushOfflineSyncOutbox,
  type SyncEngineState,
} from './services/offlineSyncEngine';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WelcomeAuthScreen } from './components/WelcomeAuthScreen';
import { StudioLayout } from './components/StudioLayout';
import { DashboardHome } from './components/DashboardHome';
import { AsaanThreeStepStudio } from './components/AsaanThreeStepStudio';
import { ShowsProfilesView } from './components/ShowsProfilesView';
import { PendingQueueView } from './components/PendingQueueView';
import { ReadyDownloadsView } from './components/ReadyDownloadsView';

const DEMO_STORAGE_SHOWS = 'boby_studio_demo_shows_v1';
const DEMO_STORAGE_CHARS = 'boby_studio_demo_chars_v1';
const DEMO_STORAGE_JOBS = 'boby_studio_demo_jobs_v1';
const THEME_STORAGE_KEY = 'boby_studio_theme';

function getInitialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Ignore storage access errors
  }
  return 'dark';
}

function getInitialTabFromUrl(): NavigationTab {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (
      tab === 'dashboard' ||
      tab === 'shows' ||
      tab === 'studio' ||
      tab === 'queue' ||
      tab === 'downloads'
    ) {
      return tab;
    }
  } catch {
    // Ignore
  }
  return 'dashboard';
}

function buildStarterShows(ownerId: string): ShowProfile[] {
  const now = Date.now();
  return [
    {
      id: `show_skykeeper_${ownerId.slice(0, 8)}`,
      ownerId,
      title: 'The Clockwork Skykeeper',
      titleIdeaPrompt:
        'An 8-year-old boy discovers his grandfather’s brass observatory controls the village sunrise.',
      logline:
        'When the mountain observatory freezes before dawn, young Zayd bravely restarts the golden sun-gears.',
      contentMode: 'cartoon_3d',
      visualStyle: 'pixar_3d',
      aspectRatio: '16:9',
      fps: 24,
      resolution: '1080p',
      languages: ['Urdu', 'English'],
      includeIntro: true,
      includeEndCredits: true,
      includeTrailer: false,
      storyPrompt:
        'Eight-year-old Zayd climbs into his grandfather’s brass clockwork observatory at dawn. Seeing the main sun-pendulum stuck, Zayd fits his glowing pocket compass into the central gear, restoring warm golden sunlight across the valley as the townspeople celebrate.',
      thumbnailAssetId: '/src/assets/images/demo_cartoon_thumb_1795041191481.jpg',
      characterCount: 1,
      createdAtMs: now - 3600_000,
      updatedAtMs: now - 1800_000,
    },
    {
      id: `show_boardroom_${ownerId.slice(0, 8)}`,
      ownerId,
      title: 'Shadows Over Clifton',
      titleIdeaPrompt:
        'A wealthy industrialist confronts long-buried family secrets on the 40th floor.',
      logline:
        'At twilight above the city skyline, two brothers uncover their late father’s final ledger.',
      contentMode: 'human_movie',
      visualStyle: 'hollywood_live',
      aspectRatio: '2.39:1',
      fps: 24,
      resolution: '4K',
      languages: ['Urdu', 'English', 'Hindi'],
      includeIntro: true,
      includeEndCredits: true,
      includeTrailer: true,
      storyPrompt:
        'Standing beside floor-to-ceiling windows overlooking the evening skyline, Tariq Mahmood welcomes his younger brother Bilal after ten years apart. Together they read their father’s handwritten letter and reconcile to protect the family legacy.',
      thumbnailAssetId: '/src/assets/images/demo_drama_thumb_1795041193052.jpg',
      characterCount: 0,
      createdAtMs: now - 7200_000,
      updatedAtMs: now - 3600_000,
    },
  ];
}

function buildStarterCharacter(showId: string, ownerId: string): CharacterActor {
  return {
    id: `char_zayd_${ownerId.slice(0, 8)}`,
    showId,
    ownerId,
    name: 'Zayd',
    age: '8 years',
    relation: 'Main Hero / Lead',
    visualPrompt:
      '8-year-old charming boy with soft curly dark hair, warm brown eyes, and a bright friendly smile wearing an amber-trimmed hoodie',
    faceLocked: true,
    lockedFaceSignature:
      '3D Pixar animated feature film character design. Character Zayd (8 years, Main Hero): soft curly dark hair, warm expressive brown eyes, cheerful genuine smile, wearing a neat amber-trimmed hoodie.',
    lockedFaceAssetId: '/src/assets/images/demo_char_portrait_1795041193115.jpg',
    voicePersona: 'Puck',
    createdAtMs: Date.now() - 3500_000,
    updatedAtMs: Date.now() - 3500_000,
  };
}

function StudioAppInner() {
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const [authReady, setAuthReady] = useState(false);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<NavigationTab>(getInitialTabFromUrl);

  const [shows, setShows] = useState<ShowProfile[]>([]);
  const [activeShowId, setActiveShowId] = useState<string>('');
  const [charactersByShow, setCharactersByShow] = useState<Record<string, CharacterActor[]>>({});
  const [jobs, setJobs] = useState<RenderJob[]>([]);

  const [creditsBalance, setCreditsBalance] = useState<number>(2500);
  const [defaultFastMotion, setDefaultFastMotion] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<StudioNotification[]>([]);
  const [firestoreErrorBanner, setFirestoreErrorBanner] = useState<string | null>(null);

  // Offline-first Database & Auto-Sync state
  const [syncState, setSyncState] = useState<SyncEngineState>('local_only');
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  const seededForUidRef = useRef<string | null>(null);
  const showUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedSnapshotRef = useRef<boolean>(false);

  const isCloudUser = Boolean(userSession && !userSession.isDemo && userSession.emailVerified);

  // Apply Light/Dark theme class to <html> and persist preference
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore
    }
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Clean up any pending debounced save timer on unmount
  useEffect(() => {
    return () => {
      if (showUpdateTimerRef.current) {
        clearTimeout(showUpdateTimerRef.current);
      }
    };
  }, []);

  const pushNotification = useCallback(
    (
      title: string,
      detail: string,
      kind: 'success' | 'info' | 'warning' = 'info',
      targetTab?: NavigationTab
    ) => {
      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title,
          detail,
          timestampMs: Date.now(),
          read: false,
          kind,
          targetTab,
        },
        ...prev.slice(0, 29),
      ]);
    },
    []
  );

  // Refresh pending outbox count helper
  const refreshPendingSyncStatus = useCallback(
    async (uid: string, cloudEnabled: boolean) => {
      if (!cloudEnabled) {
        setPendingSyncCount(0);
        setSyncState('local_only');
        return;
      }
      try {
        const pending = await getPendingOfflineMutations(uid);
        setPendingSyncCount(pending.length);
        if (!navigator.onLine || pending.length > 0) {
          setSyncState('offline_pending');
        } else {
          setSyncState('synced');
        }
      } catch {
        // Ignore IndexedDB transient errors
      }
    },
    []
  );

  // Flush queued IndexedDB mutations to Firebase Cloud once online
  const handleSyncNow = useCallback(async () => {
    if (!userSession || userSession.isDemo || !userSession.emailVerified) {
      setSyncState('local_only');
      return;
    }
    if (!navigator.onLine) {
      await refreshPendingSyncStatus(userSession.uid, true);
      return;
    }

    setSyncState('syncing');
    try {
      const { syncedCount, remainingCount } = await flushOfflineSyncOutbox(userSession.uid);
      setPendingSyncCount(remainingCount);
      setSyncState(remainingCount > 0 ? 'offline_pending' : 'synced');
      if (syncedCount > 0) {
        pushNotification(
          'Offline Changes Synced to Cloud',
          `${syncedCount} queued studio update${syncedCount === 1 ? '' : 's'} synchronized with Firebase Firestore.`,
          'success'
        );
      }
    } catch {
      await refreshPendingSyncStatus(userSession.uid, true);
    }
  }, [userSession, pushNotification, refreshPendingSyncStatus]);

  // Listen to browser online/offline events + Firestore in-sync events for instant auto-sync
  useEffect(() => {
    if (!userSession) return;
    if (!isCloudUser) {
      setSyncState('local_only');
      setPendingSyncCount(0);
      return;
    }

    const onOnline = () => {
      void handleSyncNow();
    };
    const onOffline = () => {
      setSyncState('offline_pending');
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const unsubFirestoreSync = subscribeFirestoreSyncEvent(() => {
      void refreshPendingSyncStatus(userSession.uid, true);
    });

    // Attempt immediate flush if we started online with queued items from a previous offline session
    if (navigator.onLine) {
      void handleSyncNow();
    } else {
      void refreshPendingSyncStatus(userSession.uid, true);
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsubFirestoreSync();
    };
  }, [userSession, isCloudUser, handleSyncNow, refreshPendingSyncStatus]);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setUserSession({
          uid: fbUser.uid,
          displayName: fbUser.displayName || 'Studio Director',
          email: fbUser.email || '',
          photoURL: fbUser.photoURL,
          isDemo: false,
          emailVerified: fbUser.emailVerified,
        });
      } else {
        setUserSession((prev) => (prev?.isDemo ? prev : null));
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Load / Hydrate Embedded Offline DB + Subscribe Cloud Shows & Jobs
  useEffect(() => {
    if (!authReady || !userSession) return;
    hydratedSnapshotRef.current = false;

    let cancelled = false;

    // 1. Hydrate immediately from embedded IndexedDB offline database (instant offline launch!)
    void (async () => {
      try {
        const snapshot = await getOfflineUserSnapshot(userSession.uid);
        if (!cancelled && snapshot && snapshot.shows.length > 0) {
          setShows((curr) => (curr.length > 0 ? curr : snapshot.shows));
          setActiveShowId((curr) => curr || snapshot.shows[0].id);
          setCharactersByShow((curr) =>
            Object.keys(curr).length > 0 ? curr : snapshot.charactersByShow || {}
          );
          setJobs((curr) => (curr.length > 0 ? curr : snapshot.jobs || []));
        }
      } catch {
        // Ignore IndexedDB read error
      } finally {
        if (!cancelled) {
          hydratedSnapshotRef.current = true;
        }
      }
    })();

    if (userSession.isDemo) {
      setSyncState('local_only');
      try {
        const rawShows = localStorage.getItem(DEMO_STORAGE_SHOWS);
        const parsedShows: ShowProfile[] = rawShows
          ? JSON.parse(rawShows)
          : buildStarterShows(userSession.uid);
        setShows(parsedShows);
        if (parsedShows[0]) {
          setActiveShowId((curr) => curr || parsedShows[0].id);
        }

        const rawChars = localStorage.getItem(DEMO_STORAGE_CHARS);
        if (rawChars) {
          setCharactersByShow(JSON.parse(rawChars));
        } else if (parsedShows[0]) {
          const starterChar = buildStarterCharacter(parsedShows[0].id, userSession.uid);
          const initMap = { [parsedShows[0].id]: [starterChar] };
          setCharactersByShow(initMap);
          localStorage.setItem(DEMO_STORAGE_CHARS, JSON.stringify(initMap));
        }
        localStorage.setItem(DEMO_STORAGE_SHOWS, JSON.stringify(parsedShows));

        const rawJobs = localStorage.getItem(DEMO_STORAGE_JOBS);
        if (rawJobs) {
          setJobs(JSON.parse(rawJobs));
        }
      } catch {
        const fallback = buildStarterShows(userSession.uid);
        setShows(fallback);
        setActiveShowId(fallback[0].id);
      }
      return () => {
        cancelled = true;
      };
    }

    // Authenticated Firebase User with Unverified Email
    if (!userSession.emailVerified) {
      setSyncState('local_only');
      setFirestoreErrorBanner(
        'Your Google account email is unverified. Running with embedded offline database until verified.'
      );
      const fallback = buildStarterShows(userSession.uid);
      setShows(fallback);
      setActiveShowId(fallback[0].id);
      return () => {
        cancelled = true;
      };
    }

    setFirestoreErrorBanner(null);
    let unsubShows = () => {};
    let unsubJobs = () => {};

    try {
      unsubShows = subscribeUserShows(userSession.uid, async (cloudShows) => {
        if (
          cloudShows.length === 0 &&
          seededForUidRef.current !== userSession.uid &&
          navigator.onLine
        ) {
          seededForUidRef.current = userSession.uid;
          const starters = buildStarterShows(userSession.uid);
          try {
            for (const st of starters) {
              await createShowInFirestore(st);
            }
            const firstChar = buildStarterCharacter(starters[0].id, userSession.uid);
            await createCharacterInFirestore(firstChar);
          } catch (err) {
            console.error('Initial starter seed error:', err);
          }
          return;
        }
        if (cloudShows.length > 0 || navigator.onLine) {
          setShows(cloudShows);
          if (cloudShows.length > 0) {
            setActiveShowId((curr) =>
              cloudShows.some((s) => s.id === curr) ? curr : cloudShows[0].id
            );
          }
        }
      });

      unsubJobs = subscribeUserRenderJobs(userSession.uid, (cloudJobs) => {
        if (cloudJobs.length > 0 || navigator.onLine) {
          setJobs(cloudJobs);
        }
      });
    } catch (err) {
      setFirestoreErrorBanner(err instanceof Error ? err.message : String(err));
    }

    return () => {
      cancelled = true;
      unsubShows();
      unsubJobs();
    };
  }, [authReady, userSession]);

  // Continuously mirror state to embedded IndexedDB offline database so app works 100% offline
  useEffect(() => {
    if (!userSession || !hydratedSnapshotRef.current) return;
    if (shows.length === 0 && jobs.length === 0) return;

    const timer = setTimeout(() => {
      void saveOfflineUserSnapshot({
        uid: userSession.uid,
        shows,
        charactersByShow,
        jobs,
        updatedAtMs: Date.now(),
      }).catch(() => {});
    }, 300);

    return () => clearTimeout(timer);
  }, [userSession, shows, charactersByShow, jobs]);

  // Subscribe to Active Show Characters in Cloud Mode
  useEffect(() => {
    if (
      !authReady ||
      !userSession ||
      userSession.isDemo ||
      !userSession.emailVerified ||
      !activeShowId
    ) {
      return;
    }

    const unsub = subscribeShowCharacters(userSession.uid, activeShowId, (chars) => {
      setCharactersByShow((prev) => ({ ...prev, [activeShowId]: chars }));
    });
    return () => unsub();
  }, [authReady, userSession, activeShowId]);

  const persistDemoShows = useCallback((updater: ShowProfile[] | ((prev: ShowProfile[]) => ShowProfile[])) => {
    setShows((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(DEMO_STORAGE_SHOWS, JSON.stringify(next));
      } catch {
        // Ignore quota
      }
      return next;
    });
  }, []);

  const persistDemoJobs = useCallback((updater: RenderJob[] | ((prev: RenderJob[]) => RenderJob[])) => {
    setJobs((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(DEMO_STORAGE_JOBS, JSON.stringify(next));
      } catch {
        // Ignore quota
      }
      return next;
    });
  }, []);

  const activeShow: ShowProfile | undefined = useMemo(() => {
    return shows.find((s) => s.id === activeShowId) || shows[0];
  }, [shows, activeShowId]);

  const activeCharacters: CharacterActor[] = useMemo(() => {
    if (!activeShow) return [];
    return charactersByShow[activeShow.id] || [];
  }, [charactersByShow, activeShow]);

  const totalCharactersCount = useMemo(() => {
    const mapVals = Object.values(charactersByShow).reduce((acc, arr) => acc + arr.length, 0);
    if (mapVals > 0) return mapVals;
    return shows.reduce((acc, s) => acc + (s.characterCount || 0), 0);
  }, [charactersByShow, shows]);

  // --- Auth Actions ---
  const handleGoogleLogin = async () => {
    await signInWithGooglePopup();
  };

  const handleEnterDemoMode = () => {
    setUserSession({
      uid: 'demo_director_local',
      displayName: 'Demo Studio Director',
      email: 'demo@bobymoviemaker.studio',
      photoURL: null,
      isDemo: true,
      emailVerified: true,
    });
    pushNotification(
      'Welcome to BOBY AI MOVIE MAKER',
      'Local Offline Studio active. All 3 AI prompt sections and Universal ZIP exports are ready.',
      'info'
    );
  };

  const handleLogout = async () => {
    if (userSession && !userSession.isDemo) {
      await signOutFirebase();
    }
    setUserSession(null);
    setShows([]);
    setCharactersByShow({});
    setJobs([]);
    setPendingSyncCount(0);
    setSyncState('local_only');
  };

  // --- Tool: Export Studio Profiles & Cast Backup (.json) ---
  const handleExportStudioBackup = useCallback(() => {
    const payload = {
      app: 'BOBY AI MOVIE MAKER',
      exportedAt: new Date().toISOString(),
      showsCount: shows.length,
      shows,
      charactersByShow,
      renderHistoryCount: jobs.length,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.download = `BOBY_Studio_Backup_${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    pushNotification(
      'Studio Backup Exported',
      `Saved ${shows.length} show profiles & cast rosters to BOBY_Studio_Backup_${dateStamp}.json.`,
      'success'
    );
  }, [shows, charactersByShow, jobs.length, pushNotification]);

  // --- Show CRUD (Offline-First + Auto-Sync) ---
  const handleCreateNewShowWithPreset = async (preset?: {
    contentMode?: ContentMode;
    visualStyle?: VisualStyle;
    aspectRatio?: AspectRatioOption;
    fps?: FpsOption;
    defaultTitle?: string;
    ideaPrompt?: string;
    storyPrompt?: string;
  }) => {
    if (!userSession) return;
    const newShow: ShowProfile = {
      id: `show_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ownerId: userSession.uid,
      title: preset?.defaultTitle || 'New AI Production',
      titleIdeaPrompt: preset?.ideaPrompt || '',
      logline: '',
      contentMode: preset?.contentMode || 'cartoon_3d',
      visualStyle: preset?.visualStyle || 'pixar_3d',
      aspectRatio: preset?.aspectRatio || '16:9',
      fps: preset?.fps || 24,
      resolution: '1080p',
      languages: ['Urdu', 'English'],
      includeIntro: true,
      includeEndCredits: true,
      includeTrailer: false,
      storyPrompt: preset?.storyPrompt || '',
      thumbnailAssetId: '',
      characterCount: 0,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };

    if (!isCloudUser) {
      persistDemoShows((prev) => [newShow, ...prev]);
    } else {
      setShows((prev) => [newShow, ...prev]);
      await executeOrQueueCloudMutation({
        uid: userSession.uid,
        entity: 'show',
        action: 'create',
        docId: newShow.id,
        payload: newShow,
      });
      await refreshPendingSyncStatus(userSession.uid, true);
    }
    setActiveShowId(newShow.id);
    setActiveTab('studio');
  };

  const handleUpdateActiveShow = (patch: Partial<ShowProfile>) => {
    if (!activeShow || !userSession) return;
    const targetId = activeShow.id;

    if (!isCloudUser) {
      persistDemoShows((prev) =>
        prev.map((s) => (s.id === targetId ? { ...s, ...patch, updatedAtMs: Date.now() } : s))
      );
      return;
    }

    // Optimistic UI update using functional updater + debounced offline-safe Firestore sync
    let latestMerged: ShowProfile | null = null;
    setShows((prev) =>
      prev.map((s) => {
        if (s.id === targetId) {
          latestMerged = { ...s, ...patch, updatedAtMs: Date.now() };
          return latestMerged;
        }
        return s;
      })
    );

    const payloadToSync: ShowProfile = latestMerged || {
      ...activeShow,
      ...patch,
      updatedAtMs: Date.now(),
    };

    if (showUpdateTimerRef.current) {
      clearTimeout(showUpdateTimerRef.current);
    }
    const uid = userSession.uid;
    showUpdateTimerRef.current = setTimeout(() => {
      void executeOrQueueCloudMutation({
        uid,
        entity: 'show',
        action: 'update',
        docId: payloadToSync.id,
        payload: payloadToSync,
      }).then(() => refreshPendingSyncStatus(uid, true));
    }, 450);
  };

  const handleDuplicateShow = async (source: ShowProfile) => {
    if (!userSession) return;
    const newShowId = `show_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const sourceChars = charactersByShow[source.id] || [];
    const clonedChars: CharacterActor[] = sourceChars.map((ch, idx) => ({
      ...ch,
      id: `char_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      showId: newShowId,
      ownerId: userSession.uid,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    }));

    const copy: ShowProfile = {
      ...source,
      id: newShowId,
      title: `${source.title} (Copy)`,
      characterCount: clonedChars.length,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };

    if (!isCloudUser) {
      persistDemoShows((prev) => [copy, ...prev]);
      if (clonedChars.length > 0) {
        setCharactersByShow((prev) => {
          const nextMap = { ...prev, [newShowId]: clonedChars };
          try {
            localStorage.setItem(DEMO_STORAGE_CHARS, JSON.stringify(nextMap));
          } catch {
            // Ignore
          }
          return nextMap;
        });
      }
    } else {
      setShows((prev) => [copy, ...prev]);
      if (clonedChars.length > 0) {
        setCharactersByShow((prev) => ({ ...prev, [newShowId]: clonedChars }));
      }
      await executeOrQueueCloudMutation({
        uid: userSession.uid,
        entity: 'show',
        action: 'create',
        docId: copy.id,
        payload: copy,
      });
      for (const ch of clonedChars) {
        await executeOrQueueCloudMutation({
          uid: userSession.uid,
          entity: 'character',
          action: 'create',
          docId: ch.id,
          parentId: newShowId,
          payload: ch,
        });
      }
      await refreshPendingSyncStatus(userSession.uid, true);
    }

    pushNotification(
      'Profile Duplicated',
      `Created "${copy.title}" with ${clonedChars.length} locked actor${clonedChars.length === 1 ? '' : 's'}.`,
      'info',
      'shows'
    );
  };

  const handleDeleteShow = async (showId: string) => {
    if (!userSession) return;

    // Clean up local characters map for deleted show
    setCharactersByShow((prev) => {
      if (!(showId in prev)) return prev;
      const nextMap = { ...prev };
      delete nextMap[showId];
      if (!isCloudUser) {
        try {
          localStorage.setItem(DEMO_STORAGE_CHARS, JSON.stringify(nextMap));
        } catch {
          // Ignore
        }
      }
      return nextMap;
    });

    if (!isCloudUser) {
      persistDemoShows((prev) => {
        const remaining = prev.filter((s) => s.id !== showId);
        if (activeShowId === showId && remaining[0]) {
          setActiveShowId(remaining[0].id);
        }
        return remaining;
      });
    } else {
      setShows((prev) => {
        const remaining = prev.filter((s) => s.id !== showId);
        if (activeShowId === showId && remaining[0]) {
          setActiveShowId(remaining[0].id);
        }
        return remaining;
      });
      await executeOrQueueCloudMutation({
        uid: userSession.uid,
        entity: 'show',
        action: 'delete',
        docId: showId,
      });
      await refreshPendingSyncStatus(userSession.uid, true);
    }
  };

  // --- Character CRUD (Offline-First + Auto-Sync) ---
  const handleSaveCharacter = async (char: CharacterActor, isNew: boolean) => {
    if (!userSession || !activeShow) return;
    const currentList = charactersByShow[activeShow.id] || [];
    const nextList = isNew
      ? [...currentList, char]
      : currentList.map((c) => (c.id === char.id ? char : c));

    setCharactersByShow((prev) => {
      const updatedMap = { ...prev, [activeShow.id]: nextList };
      if (!isCloudUser) {
        try {
          localStorage.setItem(DEMO_STORAGE_CHARS, JSON.stringify(updatedMap));
        } catch {
          // Ignore
        }
      }
      return updatedMap;
    });

    if (isCloudUser) {
      await executeOrQueueCloudMutation({
        uid: userSession.uid,
        entity: 'character',
        action: isNew ? 'create' : 'update',
        docId: char.id,
        parentId: activeShow.id,
        payload: char,
      });
      await refreshPendingSyncStatus(userSession.uid, true);
    }

    handleUpdateActiveShow({ characterCount: nextList.length });
    pushNotification(
      'Character Face Locked',
      `${char.name} (${char.relation}) is now locked into "${activeShow.title}".`,
      'success'
    );
  };

  const handleDeleteCharacter = async (charId: string) => {
    if (!userSession || !activeShow) return;
    const currentList = charactersByShow[activeShow.id] || [];
    const nextList = currentList.filter((c) => c.id !== charId);

    setCharactersByShow((prev) => {
      const updatedMap = { ...prev, [activeShow.id]: nextList };
      if (!isCloudUser) {
        try {
          localStorage.setItem(DEMO_STORAGE_CHARS, JSON.stringify(updatedMap));
        } catch {
          // Ignore
        }
      }
      return updatedMap;
    });

    if (isCloudUser) {
      await executeOrQueueCloudMutation({
        uid: userSession.uid,
        entity: 'character',
        action: 'delete',
        docId: charId,
        parentId: activeShow.id,
      });
      await refreshPendingSyncStatus(userSession.uid, true);
    }
    handleUpdateActiveShow({ characterCount: nextList.length });
  };

  // --- Unstoppable Background Pipeline Orchestration ---
  const syncJobState = useCallback(
    async (updatedJob: RenderJob) => {
      setJobs((prev) => {
        const exists = prev.some((j) => j.id === updatedJob.id);
        const next = exists
          ? prev.map((j) => (j.id === updatedJob.id ? updatedJob : j))
          : [updatedJob, ...prev];
        if (!userSession || userSession.isDemo || !userSession.emailVerified) {
          try {
            localStorage.setItem(DEMO_STORAGE_JOBS, JSON.stringify(next));
          } catch {
            // Ignore
          }
        }
        return next;
      });

      if (userSession && !userSession.isDemo && userSession.emailVerified) {
        try {
          await executeOrQueueCloudMutation({
            uid: userSession.uid,
            entity: 'renderJob',
            action: 'update',
            docId: updatedJob.id,
            payload: updatedJob,
          });
          await refreshPendingSyncStatus(userSession.uid, true);
        } catch (err) {
          console.error('RenderJob progress sync warning:', err);
        }
      }
    },
    [userSession, refreshPendingSyncStatus]
  );

  const launchOrResumePipelineJob = async (
    job: RenderJob,
    showForJob: ShowProfile,
    charsForJob: CharacterActor[],
    targetSceneCount: number,
    useFastStudioMotion: boolean
  ) => {
    void mediaPipeline.startOrResumeJob({
      job,
      show: showForJob,
      characters: charsForJob,
      targetSceneCount,
      useFastStudioMotion,
      callbacks: {
        onJobProgress: async (progressJob) => {
          await syncJobState(progressJob);
        },
        onJobCompleted: async (completedJob) => {
          await syncJobState(completedJob);
          setCreditsBalance((c) => Math.max(0, c - completedJob.sceneCount * 25));
          pushNotification(
            'Production Completed — ZIP Ready!',
            `"${completedJob.showTitle}" (${completedJob.sceneCount} scenes + .SRT subtitles) is ready in Ready Downloads.`,
            'success',
            'downloads'
          );
        },
        onJobFailed: async (failedJob, errorMsg) => {
          await syncJobState(failedJob);
          pushNotification(
            'Render Paused at Checkpoint',
            `${failedJob.showTitle}: ${errorMsg.slice(0, 100)}`,
            'warning',
            'queue'
          );
        },
      },
    });
  };

  const handleStartAutomatedProduction = async (opts: {
    targetSceneCount: number;
    useFastStudioMotion: boolean;
  }) => {
    if (!userSession || !activeShow) return;

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newJob: RenderJob = {
      id: jobId,
      ownerId: userSession.uid,
      showId: activeShow.id,
      showTitle: activeShow.title,
      episodeTitle: `Episode ${
        jobs.filter((j) => j.showId === activeShow.id).length + 1
      }`,
      status: 'running',
      currentStepLabel: 'Initializing multi-scene production pipeline...',
      completedSteps: 0,
      totalSteps: 1 + opts.targetSceneCount * (2 + activeShow.languages.length) + 4,
      retryCount: 0,
      aspectRatio: activeShow.aspectRatio,
      fps: activeShow.fps,
      resolution: activeShow.resolution,
      languages: activeShow.languages,
      sceneCount: opts.targetSceneCount,
      zipAssetId: '',
      thumbnailAssetId: activeShow.thumbnailAssetId,
      checkpointKey: `cp_${jobId}`,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };

    if (!isCloudUser) {
      persistDemoJobs((prev) => [newJob, ...prev]);
    } else {
      setJobs((prev) => [newJob, ...prev]);
      await executeOrQueueCloudMutation({
        uid: userSession.uid,
        entity: 'renderJob',
        action: 'create',
        docId: newJob.id,
        payload: newJob,
      });
      await refreshPendingSyncStatus(userSession.uid, true);
    }

    pushNotification(
      'Background Production Started',
      `Rendering "${activeShow.title}" (${opts.targetSceneCount} scenes). You can browse freely while it builds.`,
      'info',
      'queue'
    );
    setActiveTab('queue');

    await launchOrResumePipelineJob(
      newJob,
      activeShow,
      activeCharacters,
      opts.targetSceneCount,
      opts.useFastStudioMotion
    );
  };

  const handlePauseJob = (job: RenderJob) => {
    mediaPipeline.pauseJob(job.id);
    void syncJobState({
      ...job,
      status: 'paused',
      currentStepLabel: 'Pausing safely after current checkpoint step...',
      updatedAtMs: Date.now(),
    });
  };

  const handleResumeJob = async (job: RenderJob, forceFastMotion = false) => {
    const matchedShow = shows.find((s) => s.id === job.showId) || activeShow;
    if (!matchedShow) return;
    const chars = charactersByShow[matchedShow.id] || [];

    if (forceFastMotion) {
      const existingCp = await getCheckpointFromVault(job.checkpointKey);
      if (existingCp) {
        existingCp.useFastStudioMotion = true;
        await saveCheckpointToVault(job.checkpointKey, existingCp);
      }
    }

    const resumedJob: RenderJob = {
      ...job,
      status: 'running',
      currentStepLabel: 'Resuming from saved checkpoint...',
      updatedAtMs: Date.now(),
    };
    await syncJobState(resumedJob);
    await launchOrResumePipelineJob(
      resumedJob,
      matchedShow,
      chars,
      job.sceneCount,
      forceFastMotion ? true : defaultFastMotion
    );
  };

  const handleDeleteJob = async (jobId: string) => {
    mediaPipeline.pauseJob(jobId);
    if (!userSession || !isCloudUser) {
      persistDemoJobs((prev) => prev.filter((j) => j.id !== jobId));
    } else {
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      await executeOrQueueCloudMutation({
        uid: userSession.uid,
        entity: 'renderJob',
        action: 'delete',
        docId: jobId,
      });
      await refreshPendingSyncStatus(userSession.uid, true);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] flex items-center justify-center text-zinc-600 dark:text-zinc-400 text-sm">
        Initializing BOBY AI MOVIE MAKER Studio...
      </div>
    );
  }

  if (!userSession) {
    return (
      <WelcomeAuthScreen
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onGoogleLogin={handleGoogleLogin}
        onDemoMode={handleEnterDemoMode}
      />
    );
  }

  const pendingCount = jobs.filter((j) => j.status !== 'completed').length;
  const readyCount = jobs.filter((j) => j.status === 'completed').length;

  return (
    <StudioLayout
      user={userSession}
      theme={theme}
      onToggleTheme={handleToggleTheme}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      showsCount={shows.length}
      pendingCount={pendingCount}
      readyCount={readyCount}
      creditsBalance={creditsBalance}
      syncState={syncState}
      pendingSyncCount={pendingSyncCount}
      onSyncNow={handleSyncNow}
      onExportStudioBackup={handleExportStudioBackup}
      notifications={notifications}
      onMarkAllNotificationsRead={() =>
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      }
      onClearNotifications={() => setNotifications([])}
      defaultFastMotion={defaultFastMotion}
      onToggleDefaultFastMotion={setDefaultFastMotion}
      onLogout={handleLogout}
    >
      {firestoreErrorBanner && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          {firestoreErrorBanner}
        </div>
      )}

      {activeTab === 'dashboard' && (
        <DashboardHome
          shows={shows}
          jobs={jobs}
          totalCharactersCount={totalCharactersCount}
          onQuickLaunchFormat={(preset) => void handleCreateNewShowWithPreset(preset)}
          onUseInspirationPrompt={(insp) =>
            void handleCreateNewShowWithPreset({
              defaultTitle: insp.title,
              ideaPrompt: insp.ideaPrompt,
              storyPrompt: insp.storyPrompt,
              contentMode: insp.contentMode,
              visualStyle: insp.visualStyle,
              aspectRatio: insp.aspectRatio,
            })
          }
          onOpenShowInStudio={(id) => {
            setActiveShowId(id);
            setActiveTab('studio');
          }}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'shows' && (
        <ShowsProfilesView
          shows={shows}
          activeShowId={activeShow?.id || ''}
          onOpenInStudio={(id) => {
            setActiveShowId(id);
            setActiveTab('studio');
          }}
          onCreateNewShow={() => void handleCreateNewShowWithPreset()}
          onDuplicateShow={handleDuplicateShow}
          onDeleteShow={handleDeleteShow}
        />
      )}

      {activeTab === 'studio' && activeShow && (
        <AsaanThreeStepStudio
          show={activeShow}
          showsList={shows}
          onSelectShow={(id) => setActiveShowId(id)}
          onCreateNewShow={() => void handleCreateNewShowWithPreset()}
          characters={activeCharacters}
          onUpdateShow={handleUpdateActiveShow}
          onSaveCharacter={handleSaveCharacter}
          onDeleteCharacter={handleDeleteCharacter}
          defaultFastMotion={defaultFastMotion}
          onStartAutomatedProduction={handleStartAutomatedProduction}
        />
      )}

      {activeTab === 'queue' && (
        <PendingQueueView
          jobs={jobs}
          onPauseJob={handlePauseJob}
          onResumeJob={(j, fast) => void handleResumeJob(j, fast)}
          onDeleteJob={handleDeleteJob}
          onGoToStudio={() => setActiveTab('studio')}
        />
      )}

      {activeTab === 'downloads' && (
        <ReadyDownloadsView
          jobs={jobs}
          shows={shows}
          onDeleteJob={handleDeleteJob}
          onGoToStudio={() => setActiveTab('studio')}
        />
      )}
    </StudioLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StudioAppInner />
    </ErrorBoundary>
  );
}
