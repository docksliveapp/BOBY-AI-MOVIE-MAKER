/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  auth,
  createCharacterInFirestore,
  createRenderJobInFirestore,
  createShowInFirestore,
  deleteCharacterFromFirestore,
  deleteRenderJobFromFirestore,
  deleteShowFromFirestore,
  onAuthStateChanged,
  signInWithGooglePopup,
  signOutFirebase,
  subscribeShowCharacters,
  subscribeUserRenderJobs,
  subscribeUserShows,
  updateCharacterInFirestore,
  updateRenderJobInFirestore,
  updateShowInFirestore,
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
import { getCheckpointFromVault, saveCheckpointToVault } from './services/mediaVault';
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

function buildStarterShows(ownerId: string): ShowProfile[] {
  const now = Date.now();
  return [
    {
      id: `show_skykeeper_${ownerId.slice(0, 8)}`,
      ownerId,
      title: 'The Clockwork Skykeeper',
      titleIdeaPrompt: 'An 8-year-old boy discovers his grandfather’s brass observatory controls the village sunrise.',
      logline: 'When the mountain observatory freezes before dawn, young Zayd bravely restarts the golden sun-gears.',
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
      titleIdeaPrompt: 'A wealthy industrialist confronts long-buried family secrets on the 40th floor.',
      logline: 'At twilight above the city skyline, two brothers uncover their late father’s final ledger.',
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
  const [authReady, setAuthReady] = useState(false);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');

  const [shows, setShows] = useState<ShowProfile[]>([]);
  const [activeShowId, setActiveShowId] = useState<string>('');
  const [charactersByShow, setCharactersByShow] = useState<Record<string, CharacterActor[]>>({});
  const [jobs, setJobs] = useState<RenderJob[]>([]);

  const [creditsBalance, setCreditsBalance] = useState<number>(2500);
  const [defaultFastMotion, setDefaultFastMotion] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<StudioNotification[]>([]);
  const [firestoreErrorBanner, setFirestoreErrorBanner] = useState<string | null>(null);

  const seededForUidRef = useRef<string | null>(null);
  const showUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Load / Subscribe Shows & Jobs based on Cloud vs Demo mode
  useEffect(() => {
    if (!authReady || !userSession) return;

    if (userSession.isDemo) {
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
      return;
    }

    // Authenticated Firebase User with Verified Email
    if (!userSession.emailVerified) {
      setFirestoreErrorBanner(
        'Your Google account email is unverified. Running with local session storage until verified.'
      );
      const fallback = buildStarterShows(userSession.uid);
      setShows(fallback);
      setActiveShowId(fallback[0].id);
      return;
    }

    let unsubShows = () => {};
    let unsubJobs = () => {};

    try {
      unsubShows = subscribeUserShows(userSession.uid, async (cloudShows) => {
        if (cloudShows.length === 0 && seededForUidRef.current !== userSession.uid) {
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
        setShows(cloudShows);
        if (cloudShows.length > 0) {
          setActiveShowId((curr) =>
            cloudShows.some((s) => s.id === curr) ? curr : cloudShows[0].id
          );
        }
      });

      unsubJobs = subscribeUserRenderJobs(userSession.uid, (cloudJobs) => {
        setJobs(cloudJobs);
      });
    } catch (err) {
      setFirestoreErrorBanner(err instanceof Error ? err.message : String(err));
    }

    return () => {
      unsubShows();
      unsubJobs();
    };
  }, [authReady, userSession]);

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

  const persistDemoShows = (nextShows: ShowProfile[]) => {
    setShows(nextShows);
    try {
      localStorage.setItem(DEMO_STORAGE_SHOWS, JSON.stringify(nextShows));
    } catch {
      // Ignore quota
    }
  };

  const persistDemoJobs = (nextJobs: RenderJob[]) => {
    setJobs(nextJobs);
    try {
      localStorage.setItem(DEMO_STORAGE_JOBS, JSON.stringify(nextJobs));
    } catch {
      // Ignore quota
    }
  };

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
      'Demo Studio active. All 3 AI prompt sections and Universal ZIP exports are live.',
      'info'
    );
  };

  const handleLogout = async () => {
    if (userSession && !userSession.isDemo) {
      await signOutFirebase();
    }
    setUserSession(null);
    setShows([]);
    setJobs([]);
  };

  // --- Show CRUD ---
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

    if (userSession.isDemo || !userSession.emailVerified) {
      persistDemoShows([newShow, ...shows]);
    } else {
      await createShowInFirestore(newShow);
    }
    setActiveShowId(newShow.id);
    setActiveTab('studio');
  };

  const handleUpdateActiveShow = (patch: Partial<ShowProfile>) => {
    if (!activeShow || !userSession) return;
    const updated: ShowProfile = {
      ...activeShow,
      ...patch,
      updatedAtMs: Date.now(),
    };

    if (userSession.isDemo || !userSession.emailVerified) {
      persistDemoShows(shows.map((s) => (s.id === updated.id ? updated : s)));
      return;
    }

    // Optimistic UI update + debounced Firestore sync
    setShows((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    if (showUpdateTimerRef.current) {
      clearTimeout(showUpdateTimerRef.current);
    }
    showUpdateTimerRef.current = setTimeout(() => {
      void updateShowInFirestore(updated);
    }, 450);
  };

  const handleDuplicateShow = async (source: ShowProfile) => {
    if (!userSession) return;
    const copy: ShowProfile = {
      ...source,
      id: `show_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: `${source.title} (Copy)`,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };
    if (userSession.isDemo || !userSession.emailVerified) {
      persistDemoShows([copy, ...shows]);
    } else {
      await createShowInFirestore(copy);
    }
    pushNotification('Profile Duplicated', `Created "${copy.title}".`, 'info', 'shows');
  };

  const handleDeleteShow = async (showId: string) => {
    if (!userSession) return;
    if (userSession.isDemo || !userSession.emailVerified) {
      const remaining = shows.filter((s) => s.id !== showId);
      persistDemoShows(remaining);
      if (activeShowId === showId && remaining[0]) {
        setActiveShowId(remaining[0].id);
      }
    } else {
      await deleteShowFromFirestore(showId);
    }
  };

  // --- Character CRUD ---
  const handleSaveCharacter = async (char: CharacterActor, isNew: boolean) => {
    if (!userSession || !activeShow) return;
    const currentList = charactersByShow[activeShow.id] || [];
    const nextList = isNew
      ? [...currentList, char]
      : currentList.map((c) => (c.id === char.id ? char : c));

    setCharactersByShow((prev) => {
      const updatedMap = { ...prev, [activeShow.id]: nextList };
      if (userSession.isDemo || !userSession.emailVerified) {
        localStorage.setItem(DEMO_STORAGE_CHARS, JSON.stringify(updatedMap));
      }
      return updatedMap;
    });

    if (!userSession.isDemo && userSession.emailVerified) {
      if (isNew) {
        await createCharacterInFirestore(char);
      } else {
        await updateCharacterInFirestore(char);
      }
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
      if (userSession.isDemo || !userSession.emailVerified) {
        localStorage.setItem(DEMO_STORAGE_CHARS, JSON.stringify(updatedMap));
      }
      return updatedMap;
    });

    if (!userSession.isDemo && userSession.emailVerified) {
      await deleteCharacterFromFirestore(activeShow.id, charId);
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
          await updateRenderJobInFirestore(updatedJob);
        } catch (err) {
          console.error('RenderJob progress sync warning:', err);
        }
      }
    },
    [userSession]
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
            `"${completedJob.showTitle}" (${completedJob.sceneCount} scenes) is ready in Ready Downloads.`,
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

    if (userSession.isDemo || !userSession.emailVerified) {
      persistDemoJobs([newJob, ...jobs]);
    } else {
      await createRenderJobInFirestore(newJob);
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
    if (!userSession || userSession.isDemo || !userSession.emailVerified) {
      persistDemoJobs(jobs.filter((j) => j.id !== jobId));
    } else {
      await deleteRenderJobFromFirestore(jobId);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-400 text-sm">
        Initializing BOBY AI MOVIE MAKER Studio...
      </div>
    );
  }

  if (!userSession) {
    return (
      <WelcomeAuthScreen
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
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      showsCount={shows.length}
      pendingCount={pendingCount}
      readyCount={readyCount}
      creditsBalance={creditsBalance}
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
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
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
