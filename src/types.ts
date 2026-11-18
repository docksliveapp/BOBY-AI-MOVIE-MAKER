/**
 * Core Domain Types — BOBY AI MOVIE MAKER
 */

export type ContentMode = 'cartoon_3d' | 'human_movie' | 'music_video' | 'social_reel';

export type VisualStyle =
  | 'pixar_3d'
  | 'hollywood_live'
  | 'anime'
  | 'hyper_drama'
  | 'film_noir'
  | 'cyberpunk_neon';

export type AspectRatioOption = '16:9' | '9:16' | '1:1' | '2.39:1';

export type FpsOption = 24 | 30 | 60;

export type ResolutionOption = '720p' | '1080p' | '4K' | '8K';

export type SupportedLanguage =
  | 'Urdu'
  | 'English'
  | 'Arabic'
  | 'Hindi'
  | 'Spanish'
  | 'Turkish'
  | 'French'
  | 'Chinese';

export type VoicePersona = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export type NavigationTab = 'dashboard' | 'shows' | 'downloads' | 'queue' | 'studio';

export type RenderJobStatus = 'queued' | 'running' | 'paused' | 'error' | 'completed';

export interface ProductionSettings {
  contentMode: ContentMode;
  visualStyle: VisualStyle;
  aspectRatio: AspectRatioOption;
  fps: FpsOption;
  resolution: ResolutionOption;
  languages: SupportedLanguage[];
  includeIntro: boolean;
  includeEndCredits: boolean;
  includeTrailer: boolean;
}

export interface TitleSuggestion {
  title: string;
  logline: string;
  platformHook: string;
  thumbnailPrompt: string;
}

export interface CharacterFaceCandidate {
  id: string;
  label: string;
  signaturePrompt: string;
  dataUrl: string;
}

export interface CharacterActor {
  id: string;
  showId: string;
  ownerId: string;
  name: string;
  age: string;
  relation: string;
  visualPrompt: string;
  faceLocked: boolean;
  lockedFaceSignature: string;
  lockedFaceAssetId: string;
  voicePersona: VoicePersona;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ShowProfile {
  id: string;
  ownerId: string;
  title: string;
  titleIdeaPrompt: string;
  logline: string;
  contentMode: ContentMode;
  visualStyle: VisualStyle;
  aspectRatio: AspectRatioOption;
  fps: FpsOption;
  resolution: ResolutionOption;
  languages: SupportedLanguage[];
  includeIntro: boolean;
  includeEndCredits: boolean;
  includeTrailer: boolean;
  storyPrompt: string;
  thumbnailAssetId: string;
  characterCount: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SceneDialogueLine {
  language: SupportedLanguage;
  line: string;
}

export interface PlannedScene {
  sceneNumber: number;
  sceneCode: string; // e.g., "scene_01"
  heading: string;
  visualPrompt: string;
  motionPrompt: string;
  bgmMood: string;
  speakerName: string;
  voicePersona: VoicePersona;
  dialogues: SceneDialogueLine[];
}

export interface ProductionPlan {
  episodeTitle: string;
  introPrompt: string;
  trailerPrompt: string;
  endCreditsRoll: string[];
  bgmPrompt: string;
  scenes: PlannedScene[];
}

export interface SceneRenderedAssets {
  sceneCode: string;
  keyframeDataUrl?: string;
  videoBase64?: string;
  videoMimeType?: string;
  voiceByLang: Record<string, { base64: string; mimeType: string }>;
  bgmBase64?: string;
  bgmMimeType?: string;
}

export interface PipelineCheckpoint {
  jobId: string;
  showId: string;
  plan?: ProductionPlan;
  thumbnailDataUrl?: string;
  introVideoBase64?: string;
  introVideoMimeType?: string;
  trailerVideoBase64?: string;
  trailerVideoMimeType?: string;
  endCreditsVideoBase64?: string;
  endCreditsVideoMimeType?: string;
  masterBgmBase64?: string;
  masterBgmMimeType?: string;
  scenes: Record<string, SceneRenderedAssets>;
  completedStepIds: string[];
  useFastStudioMotion: boolean;
  lastError?: string;
}

export interface RenderJob {
  id: string;
  ownerId: string;
  showId: string;
  showTitle: string;
  episodeTitle: string;
  status: RenderJobStatus;
  currentStepLabel: string;
  completedSteps: number;
  totalSteps: number;
  retryCount: number;
  aspectRatio: AspectRatioOption;
  fps: FpsOption;
  resolution: ResolutionOption;
  languages: SupportedLanguage[];
  sceneCount: number;
  zipAssetId: string;
  thumbnailAssetId: string;
  checkpointKey: string;
  createdAtMs: number;
  updatedAtMs: number;
  errorMessage?: string;
}

export interface StudioNotification {
  id: string;
  title: string;
  detail: string;
  timestampMs: number;
  read: boolean;
  kind: 'success' | 'info' | 'warning';
  targetTab?: NavigationTab;
}

export interface UserSession {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  isDemo: boolean;
  emailVerified: boolean;
}
