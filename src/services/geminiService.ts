import type {
  AspectRatioOption,
  CharacterActor,
  CharacterFaceCandidate,
  ContentMode,
  ProductionPlan,
  ResolutionOption,
  SupportedLanguage,
  TitleSuggestion,
  VisualStyle,
  VoicePersona,
} from '../types';

export async function withAutoRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  onRetry?: (attempt: number, errorMsg: string) => void
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Do not retry non-recoverable key configuration errors
      if (msg.includes('GEMINI_API_KEY is not configured') || msg.includes('invalid key')) {
        throw err;
      }
      if (attempt < maxAttempts) {
        onRetry?.(attempt, msg);
        const backoffMs = 1200 * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(
      'You are currently offline. Your shows and edits are safely saved locally and will auto-sync when online; reconnect to run cloud AI generation.'
    );
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }
  return data as T;
}

export async function suggestViralTitles(params: {
  ideaPrompt: string;
  contentMode: ContentMode;
  visualStyle: VisualStyle;
  languages: SupportedLanguage[];
}): Promise<TitleSuggestion[]> {
  const res = await postJson<{ suggestions: TitleSuggestion[] }>('/api/ai/suggest-titles', params);
  return res.suggestions || [];
}

export async function generateStudioImage(params: {
  prompt: string;
  aspectRatio: AspectRatioOption;
  highRes?: boolean;
  referenceImages?: Array<{ mimeType: string; data: string }>;
}): Promise<{ mimeType: string; base64Data: string; dataUrl: string }> {
  return postJson('/api/ai/generate-image', params);
}

export async function generateCharacterFaces(params: {
  name: string;
  age: string;
  relation: string;
  visualPrompt: string;
  visualStyle: VisualStyle;
  contentMode: ContentMode;
}): Promise<CharacterFaceCandidate[]> {
  const res = await postJson<{ faces: CharacterFaceCandidate[] }>('/api/ai/generate-faces', params);
  return res.faces || [];
}

export async function enhanceStoryScript(params: {
  title: string;
  roughPrompt: string;
  contentMode: ContentMode;
  visualStyle: VisualStyle;
  languages: SupportedLanguage[];
  characters: CharacterActor[];
  targetSceneCount: number;
}): Promise<string> {
  const res = await postJson<{ enhancedScript: string }>('/api/ai/enhance-script', params);
  return res.enhancedScript || params.roughPrompt;
}

export async function planStoryScenes(params: {
  title: string;
  storyPrompt: string;
  contentMode: ContentMode;
  visualStyle: VisualStyle;
  aspectRatio: AspectRatioOption;
  languages: SupportedLanguage[];
  characters: CharacterActor[];
  targetSceneCount?: number;
}): Promise<ProductionPlan> {
  const res = await postJson<{ plan: ProductionPlan }>('/api/ai/plan-scenes', params);
  return res.plan;
}

export async function generateVeoMotionClip(params: {
  prompt: string;
  aspectRatio: AspectRatioOption;
  resolution: ResolutionOption;
  duration?: string;
  startImageBase64?: string;
  startImageMimeType?: string;
}): Promise<{ mimeType: string; base64Data: string }> {
  return postJson('/api/ai/generate-video', params);
}

export async function synthesizeSceneVoiceover(params: {
  text: string;
  language: SupportedLanguage;
  voicePersona: VoicePersona;
  style?: string;
}): Promise<{ mimeType: string; extension: string; base64Data: string }> {
  return postJson('/api/ai/generate-voice', params);
}

export async function composeSceneBackgroundMusic(params: {
  prompt: string;
}): Promise<{ mimeType: string; base64Data: string; lyrics?: string }> {
  return postJson('/api/ai/generate-music', params);
}
