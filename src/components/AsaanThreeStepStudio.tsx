import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Image as ImageIcon,
  Loader2,
  Lock,
  Mic,
  MicOff,
  Play,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  Volume2,
  Wand2,
} from 'lucide-react';
import type {
  CharacterActor,
  CharacterFaceCandidate,
  ShowProfile,
  SupportedLanguage,
  TitleSuggestion,
  VoicePersona,
} from '../types';
import {
  enhanceStoryScript,
  generateCharacterFaces,
  generateStudioImage,
  suggestViralTitles,
  synthesizeSceneVoiceover,
} from '../services/geminiService';
import { saveAssetToVault } from '../services/mediaVault';
import { ProductionSettingsBar } from './ProductionSettingsBar';
import { ResilientImage } from './ResilientImage';

interface AsaanThreeStepStudioProps {
  show: ShowProfile;
  showsList: ShowProfile[];
  onSelectShow: (showId: string) => void;
  onCreateNewShow: () => void;
  characters: CharacterActor[];
  onUpdateShow: (patch: Partial<ShowProfile>) => void;
  onSaveCharacter: (char: CharacterActor, isNew: boolean) => Promise<void>;
  onDeleteCharacter: (charId: string) => Promise<void>;
  defaultFastMotion: boolean;
  onStartAutomatedProduction: (opts: {
    targetSceneCount: number;
    useFastStudioMotion: boolean;
  }) => Promise<void>;
}

const RELATION_PRESETS = [
  'Main Hero / Lead',
  'Heroine / Co-Lead',
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Best Friend',
  'Grandfather / Elder',
  'Villain / Rival',
];

const VOICE_PERSONAS: Array<{ value: VoicePersona; label: string }> = [
  { value: 'Kore', label: 'Kore · Warm Female / Youth' },
  { value: 'Puck', label: 'Puck · Energetic Boy / Cheerful' },
  { value: 'Charon', label: 'Charon · Deep Mature Male / Father' },
  { value: 'Fenrir', label: 'Fenrir · Commanding Villain / Bold' },
  { value: 'Zephyr', label: 'Zephyr · Gentle Narrator / Soft' },
];

const VOICE_AUDITION_LINES: Record<SupportedLanguage, string> = {
  Urdu: 'خوش آمدید! آج ہم ایک شاندار اور یادگار کہانی شروع کرنے جا رہے ہیں۔',
  English: 'Welcome to the studio! Every scene is ready for lights, camera, and action.',
  Arabic: 'مرحباً بكم في الاستوديو! قصتنا السينمائية المدهشة تبدأ الآن.',
  Hindi: 'स्टूडियो में आपका स्वागत है! आज हम एक शानदार कहानी शुरू करने जा रहे हैं।',
  Spanish: '¡Bienvenidos al estudio! Nuestra nueva historia cinematográfica comienza ahora.',
  Turkish: 'Stüdyoya hoş geldiniz! Harika sinema hikayemiz şimdi başlıyor.',
  French: 'Bienvenue au studio ! Notre nouvelle histoire cinématographique commence maintenant.',
  Chinese: '欢迎来到电影工作室！我们精彩的故事现在正式开始。',
};

const QUICK_CHARACTER_PROMPTS = [
  {
    name: 'Zayd',
    age: '8 years',
    relation: 'Main Hero / Lead',
    voice: 'Puck' as VoicePersona,
    prompt:
      '8-year-old innocent boy with soft curly dark hair, expressive brown eyes, and a bright warm smile wearing an explorer jacket',
  },
  {
    name: 'Tariq Mahmood',
    age: '45 years',
    relation: 'Father',
    voice: 'Charon' as VoicePersona,
    prompt:
      '45-year-old dignified wealthy businessman in a tailored dark charcoal suit, silver-streaked hair, composed gaze',
  },
  {
    name: 'Amina',
    age: '38 years',
    relation: 'Mother',
    voice: 'Kore' as VoicePersona,
    prompt:
      '38-year-old graceful compassionate mother wearing an elegant ivory shawl, warm intelligent eyes, gentle smile',
  },
];

export const AsaanThreeStepStudio: React.FC<AsaanThreeStepStudioProps> = ({
  show,
  showsList,
  onSelectShow,
  onCreateNewShow,
  characters,
  onUpdateShow,
  onSaveCharacter,
  onDeleteCharacter,
  defaultFastMotion,
  onStartAutomatedProduction,
}) => {
  // Section 1 state
  const [suggestingTitles, setSuggestingTitles] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<TitleSuggestion[]>([]);
  const [generatingThumb, setGeneratingThumb] = useState(false);
  const [section1Error, setSection1Error] = useState<string | null>(null);

  // Section 2 state
  const [charName, setCharName] = useState('');
  const [charAge, setCharAge] = useState('10 years');
  const [charRelation, setCharRelation] = useState('Main Hero / Lead');
  const [charVoice, setCharVoice] = useState<VoicePersona>('Kore');
  const [charPrompt, setCharPrompt] = useState('');
  const [generatingFaces, setGeneratingFaces] = useState(false);
  const [faceCandidates, setFaceCandidates] = useState<CharacterFaceCandidate[]>([]);
  const [lockingFaceId, setLockingFaceId] = useState<string | null>(null);
  const [auditioningVoice, setAuditioningVoice] = useState(false);
  const [auditionAudioSrc, setAuditionAudioSrc] = useState<string | null>(null);
  const [section2Error, setSection2Error] = useState<string | null>(null);

  // Section 3 state
  const [isDictating, setIsDictating] = useState(false);
  const [dictationLang, setDictationLang] = useState<'en-US' | 'ur-PK' | 'hi-IN' | 'ar-SA'>('en-US');
  const [enhancingScript, setEnhancingScript] = useState(false);
  const [targetSceneCount, setTargetSceneCount] = useState<number>(4);
  const [useFastMotion, setUseFastMotion] = useState<boolean>(defaultFastMotion);
  const [launchingPipeline, setLaunchingPipeline] = useState(false);
  const [section3Error, setSection3Error] = useState<string | null>(null);

  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const storyPromptRef = useRef<string>(show.storyPrompt);

  // Keep storyPromptRef synced so continuous voice dictation appends cleanly
  useEffect(() => {
    storyPromptRef.current = show.storyPrompt;
  }, [show.storyPrompt]);

  // Sync fast motion default when changed in Studio Preferences
  useEffect(() => {
    setUseFastMotion(defaultFastMotion);
  }, [defaultFastMotion]);

  // Reset transient per-show state and stop active dictation when switching shows
  useEffect(() => {
    setTitleSuggestions([]);
    setFaceCandidates([]);
    setSection1Error(null);
    setSection2Error(null);
    setSection3Error(null);
    setAuditionAudioSrc(null);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
      setIsDictating(false);
    }
  }, [show.id]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  // Tool 3: Live Production Runtime & Deliverable Estimator
  const productionEstimate = useMemo(() => {
    const clipSec = useFastMotion ? 4.5 : 6;
    const introSec = show.includeIntro ? 4 : 0;
    const creditsSec = show.includeEndCredits ? 5 : 0;
    const totalSec = Math.round(targetSceneCount * clipSec + introSec + creditsSec);
    const totalTasks = 1 + targetSceneCount * (2 + show.languages.length) + 4;
    return { totalSec, totalTasks };
  }, [targetSceneCount, useFastMotion, show.includeIntro, show.includeEndCredits, show.languages.length]);

  // --- Section 1 Handlers ---
  const handleSuggestTitles = async () => {
    setSuggestingTitles(true);
    setSection1Error(null);
    try {
      const suggestions = await suggestViralTitles({
        ideaPrompt: show.titleIdeaPrompt || show.title,
        contentMode: show.contentMode,
        visualStyle: show.visualStyle,
        languages: show.languages,
      });
      setTitleSuggestions(suggestions);
      if (suggestions[0]) {
        onUpdateShow({
          title: suggestions[0].title,
          logline: suggestions[0].logline,
        });
      }
    } catch (err) {
      setSection1Error(err instanceof Error ? err.message : String(err));
    } finally {
      setSuggestingTitles(false);
    }
  };

  const handleGenerateThumbnail = async (customThumbPrompt?: string) => {
    setGeneratingThumb(true);
    setSection1Error(null);
    try {
      const promptToUse =
        customThumbPrompt ||
        `Widescreen 1280x720 YouTube & Movie cover art for "${show.title}". ${
          show.logline || show.titleIdeaPrompt || 'Epic emotional cinematic scene'
        }. Style: ${show.visualStyle}. Clean composition without text overlays.`;

      const res = await generateStudioImage({
        prompt: promptToUse,
        aspectRatio: '16:9',
        highRes: show.resolution === '4K' || show.resolution === '8K',
      });

      const assetKey = `thumb_${show.id}_${Date.now()}`;
      await saveAssetToVault(assetKey, res.dataUrl);
      onUpdateShow({ thumbnailAssetId: assetKey });
    } catch (err) {
      setSection1Error(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingThumb(false);
    }
  };

  // --- Section 2 Handlers ---
  const handleAuditionVoice = async () => {
    setAuditioningVoice(true);
    setSection2Error(null);
    try {
      const primaryLang = show.languages[0] || 'English';
      const sampleText = VOICE_AUDITION_LINES[primaryLang] || VOICE_AUDITION_LINES.English;
      const res = await synthesizeSceneVoiceover({
        text: sampleText,
        language: primaryLang,
        voicePersona: charVoice,
        style: 'warm expressive studio narration',
      });
      setAuditionAudioSrc(`data:${res.mimeType};base64,${res.base64Data}`);
    } catch (err) {
      setSection2Error(err instanceof Error ? err.message : String(err));
    } finally {
      setAuditioningVoice(false);
    }
  };

  const handleGenerateCharacterFaces = async () => {
    if (!charName.trim() || !charPrompt.trim()) {
      setSection2Error('Please enter a Character Name and Visual Prompt before generating faces.');
      return;
    }
    setGeneratingFaces(true);
    setSection2Error(null);
    setFaceCandidates([]);
    try {
      const faces = await generateCharacterFaces({
        name: charName.trim(),
        age: charAge.trim() || '25',
        relation: charRelation,
        visualPrompt: charPrompt.trim(),
        visualStyle: show.visualStyle,
        contentMode: show.contentMode,
      });
      setFaceCandidates(faces);
    } catch (err) {
      setSection2Error(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingFaces(false);
    }
  };

  const handleSelectAndLockFace = async (candidate: CharacterFaceCandidate) => {
    setLockingFaceId(candidate.id);
    setSection2Error(null);
    try {
      const charId = `char_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const faceAssetKey = `face_${charId}`;
      await saveAssetToVault(faceAssetKey, candidate.dataUrl);

      const newActor: CharacterActor = {
        id: charId,
        showId: show.id,
        ownerId: show.ownerId,
        name: charName.trim() || 'Lead Actor',
        age: charAge.trim() || '25',
        relation: charRelation,
        visualPrompt: charPrompt.trim(),
        faceLocked: true,
        lockedFaceSignature: candidate.signaturePrompt,
        lockedFaceAssetId: faceAssetKey,
        voicePersona: charVoice,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      };

      await onSaveCharacter(newActor, true);
      setFaceCandidates([]);
      setCharName('');
      setCharPrompt('');
    } catch (err) {
      setSection2Error(err instanceof Error ? err.message : String(err));
    } finally {
      setLockingFaceId(null);
    }
  };

  // --- Section 3 Handlers ---
  const handleEnhanceScript = async () => {
    const seed = show.storyPrompt.trim() || show.titleIdeaPrompt.trim() || show.title.trim();
    if (!seed) {
      setSection3Error('Write a brief story idea or rough notes first so AI Script Enhancer can expand it.');
      return;
    }
    setEnhancingScript(true);
    setSection3Error(null);
    try {
      const enhanced = await enhanceStoryScript({
        title: show.title || 'Untitled Show',
        roughPrompt: seed,
        contentMode: show.contentMode,
        visualStyle: show.visualStyle,
        languages: show.languages,
        characters,
        targetSceneCount,
      });
      if (enhanced.trim()) {
        storyPromptRef.current = enhanced.trim();
        onUpdateShow({ storyPrompt: enhanced.trim() });
      }
    } catch (err) {
      setSection3Error(err instanceof Error ? err.message : String(err));
    } finally {
      setEnhancingScript(false);
    }
  };

  const toggleVoiceDictation = () => {
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }

    setSection3Error(null);
    const SpeechRec =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRec) {
      setSection3Error(
        'Browser speech dictation is unavailable in this window. Please use Chrome or Edge, or type your story prompt directly below.'
      );
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRec as any)();
      recognition.lang = dictationLang;
      recognition.interimResults = false;
      recognition.continuous = true;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let transcriptChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcriptChunk += event.results[i][0].transcript + ' ';
          }
        }
        if (transcriptChunk.trim()) {
          const base = storyPromptRef.current.trim();
          const updated = base ? `${base} ${transcriptChunk.trim()}` : transcriptChunk.trim();
          storyPromptRef.current = updated;
          onUpdateShow({ storyPrompt: updated });
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (e: any) => {
        setIsDictating(false);
        if (e?.error && e.error !== 'no-speech') {
          setSection3Error(`Voice dictation stopped (${e.error}). Check microphone permission.`);
        }
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsDictating(true);
    } catch (err) {
      setIsDictating(false);
      setSection3Error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleLaunchProduction = async () => {
    if (!show.storyPrompt.trim()) {
      setSection3Error(
        'Please write, polish, or dictate your story, plot, or song lyrics in Section 3 first.'
      );
      return;
    }
    setLaunchingPipeline(true);
    setSection3Error(null);
    try {
      await onStartAutomatedProduction({
        targetSceneCount,
        useFastStudioMotion: useFastMotion,
      });
    } catch (err) {
      setSection3Error(err instanceof Error ? err.message : String(err));
    } finally {
      setLaunchingPipeline(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Show Switcher Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800/80">
        <div>
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Asaan 3-Step Prompt Automation Workspace
          </div>
          <h1
            className="font-display text-2xl font-bold text-zinc-950 dark:text-zinc-50 mt-0.5"
            style={{ textWrap: 'balance' }}
          >
            {show.title || 'Untitled Show'}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={show.id}
            onChange={(e) => onSelectShow(e.target.value)}
            aria-label="Switch Active Show Profile"
            className="min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-amber-500 max-w-[220px]"
          >
            {showsList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onCreateNewShow}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] px-3.5 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            New Show
          </button>
        </div>
      </div>

      {/* Universal Production Settings */}
      <ProductionSettingsBar show={show} onUpdateShow={onUpdateShow} />

      {/* ===================================================================== */}
      {/* PROMPT SECTION 1: TITLE & SERIES NAME GENERATOR + 1280x720 THUMBNAIL */}
      {/* ===================================================================== */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/65 backdrop-blur-xl p-5 sm:p-6 space-y-6 shadow-xs dark:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-200 dark:border-zinc-800/80">
          <div>
            <h2 className="font-display text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              01. Title & Series Name Generator
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Enter a rough concept—Gemini suggests viral titles and Imagen generates your 1280×720 cover thumbnail.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold">
            Step 1 of 3
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
                Rough Concept or Topic Prompt
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={show.titleIdeaPrompt}
                  onChange={(e) => onUpdateShow({ titleIdeaPrompt: e.target.value })}
                  placeholder="e.g., A brave little boy with a magical lantern saving his village..."
                  className="flex-1 min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleSuggestTitles}
                  disabled={suggestingTitles}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-4 py-2.5 text-xs font-semibold text-zinc-950 transition-all whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
                >
                  {suggestingTitles ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  <span>{suggestingTitles ? 'Generating...' : 'AI Suggest Titles'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
                Selected Production / Series Title
              </label>
              <input
                type="text"
                value={show.title}
                onChange={(e) => onUpdateShow({ title: e.target.value })}
                placeholder="Official Movie or Series Title"
                className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Suggested Viral Titles List */}
            {titleSuggestions.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Click any AI-generated title below to apply & render its cover art:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {titleSuggestions.map((sug, i) => {
                    const isSelected = show.title === sug.title;
                    return (
                      <div
                        key={`${sug.title}-${i}`}
                        onClick={() =>
                          onUpdateShow({ title: sug.title, logline: sug.logline })
                        }
                        className={`rounded-xl border p-3.5 transition-colors cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 hover:border-zinc-400 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                          {sug.title}
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          {sug.logline}
                        </p>
                        <div className="pt-1 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-amber-700 dark:text-amber-300 truncate max-w-[160px]">
                            {sug.platformHook}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateShow({ title: sug.title, logline: sug.logline });
                              void handleGenerateThumbnail(sug.thumbnailPrompt);
                            }}
                            className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-200 underline hover:text-amber-600 dark:hover:text-amber-300 cursor-pointer shrink-0"
                          >
                            Use + Render Cover
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {section1Error && (
              <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2.5">
                {section1Error}
              </p>
            )}
          </div>

          {/* 1280x720 Cover Thumbnail Preview & Generator */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Cover Thumbnail (1280×720 · thumbnail.jpg)
              </span>
              <button
                type="button"
                onClick={() => handleGenerateThumbnail()}
                disabled={generatingThumb}
                className="min-h-[36px] inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 disabled:opacity-60 cursor-pointer"
              >
                {generatingThumb ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5" />
                )}
                <span>{generatingThumb ? 'Rendering...' : 'Generate Cover Art'}</span>
              </button>
            </div>

            <div className="aspect-video w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 relative">
              <ResilientImage
                assetIdOrUrl={show.thumbnailAssetId}
                alt={`${show.title} cover thumbnail`}
                className="w-full h-full object-cover"
                fallbackLabel="Click Generate Cover Art for 1280×720 Thumbnail"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* PROMPT SECTION 2: AI CHARACTER & ACTOR CREATOR (FACE LOCK)           */}
      {/* ===================================================================== */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/65 backdrop-blur-xl p-5 sm:p-6 space-y-6 shadow-xs dark:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-200 dark:border-zinc-800/80">
          <div>
            <h2 className="font-display text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              02. AI Character & Actor Creator (Prompt-Driven Face Lock)
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Create unlimited heroes, parents, siblings, friends, or villains. Generate 4 faces via Imagen, audition their voice, and lock your choice for 100% scene identity.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-violet-600 dark:text-violet-400 font-semibold">
            Step 2 of 3 · {characters.length} Locked in Cast
          </span>
        </div>

        {/* Quick 1-Click Character Starter Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-1">
            Quick Actor Templates:
          </span>
          {QUICK_CHARACTER_PROMPTS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setCharName(preset.name);
                setCharAge(preset.age);
                setCharRelation(preset.relation);
                setCharVoice(preset.voice);
                setCharPrompt(preset.prompt);
              }}
              className="min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:border-violet-500/60 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors whitespace-nowrap cursor-pointer"
            >
              + {preset.name} ({preset.relation.split(' ')[0]})
            </button>
          ))}
        </div>

        {/* Character Builder Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
              Actor / Character Name
            </label>
            <input
              type="text"
              value={charName}
              onChange={(e) => setCharName(e.target.value)}
              placeholder="e.g., Zayd, Father Tariq, Sara"
              className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2 text-sm text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
              Age
            </label>
            <input
              type="text"
              value={charAge}
              onChange={(e) => setCharAge(e.target.value)}
              placeholder="e.g., 8 years, 45 years"
              className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2 text-sm text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
              Role / Relation
            </label>
            <select
              value={charRelation}
              onChange={(e) => setCharRelation(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-violet-500"
            >
              {RELATION_PRESETS.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Persona + Live Audition Tool */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
                Voice Persona
              </label>
              <button
                type="button"
                onClick={handleAuditionVoice}
                disabled={auditioningVoice}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 disabled:opacity-60 cursor-pointer"
              >
                {auditioningVoice ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
                <span>{auditioningVoice ? 'Synthesizing...' : 'Audition Voice'}</span>
              </button>
            </div>
            <select
              value={charVoice}
              onChange={(e) => {
                setCharVoice(e.target.value as VoicePersona);
                setAuditionAudioSrc(null);
              }}
              className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-violet-500"
            >
              {VOICE_PERSONAS.map((vp) => (
                <option key={vp.value} value={vp.value}>
                  {vp.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Inline Voice Audition Preview Player */}
        {auditionAudioSrc && (
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs font-medium text-violet-900 dark:text-violet-200">
              Voice Audition · <span className="font-mono font-semibold">{charVoice}</span> ({show.languages[0] || 'English'})
            </div>
            <audio controls autoPlay src={auditionAudioSrc} className="h-9 w-full sm:w-72" />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
            Character Visual Prompt (Face, Hair, Clothing, Expression)
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={charPrompt}
              onChange={(e) => setCharPrompt(e.target.value)}
              placeholder="e.g., 8-year-old innocent boy with curly hair and bright smile wearing an amber hoodie"
              className="flex-1 min-h-[46px] rounded-xl border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
            />
            <button
              type="button"
              onClick={handleGenerateCharacterFaces}
              disabled={generatingFaces}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 dark:bg-violet-500 hover:bg-violet-500 dark:hover:bg-violet-400 active:scale-[0.98] px-5 py-2.5 text-xs font-semibold text-white dark:text-zinc-950 transition-all whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
            >
              {generatingFaces ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              <span>
                {generatingFaces ? 'Rendering 4 Faces...' : 'Generate Character Faces'}
              </span>
            </button>
          </div>
        </div>

        {section2Error && (
          <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2.5">
            {section2Error}
          </p>
        )}

        {/* 4 Generated Face Candidates Grid */}
        {faceCandidates.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-violet-700 dark:text-violet-300">
              Choose 1 of the 4 generated portraits below to permanently lock {charName}’s face:
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {faceCandidates.map((cand) => (
                <div
                  key={cand.id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-hidden flex flex-col"
                >
                  <div className="aspect-square w-full overflow-hidden bg-zinc-200 dark:bg-zinc-900">
                    <img
                      src={cand.dataUrl}
                      alt={cand.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 space-y-2.5">
                    <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {cand.label}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectAndLockFace(cand)}
                      disabled={lockingFaceId === cand.id}
                      className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-all whitespace-nowrap cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        {lockingFaceId === cand.id ? 'Locking...' : 'Select & Lock Face'}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locked Character Roster */}
        {characters.length > 0 ? (
          <div className="space-y-3 pt-2">
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Locked Cast Roster for “{show.title}” (automatically injected into every scene):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {characters.map((actor) => (
                <div
                  key={actor.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800">
                      <ResilientImage
                        assetIdOrUrl={actor.lockedFaceAssetId}
                        alt={actor.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-100 truncate">
                          {actor.name}
                        </span>
                        {actor.faceLocked && (
                          <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                        {actor.age} · {actor.relation} · {actor.voicePersona}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteCharacter(actor.id)}
                    aria-label={`Remove ${actor.name}`}
                    className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-900 transition-colors shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-4 text-xs text-zinc-600 dark:text-zinc-400">
            No locked characters added yet. Add cast members above for strict multi-scene face locking, or proceed directly to let Gemini cast scenes automatically.
          </div>
        )}

        {/* Intro & End Credits Sequence Toggles */}
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-3.5 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-100">
                Include Studio & Cast Intro (intro_sequence.mp4)
              </div>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                Generates opening production house & character title clip
              </div>
            </div>
            <input
              type="checkbox"
              checked={show.includeIntro}
              onChange={(e) => onUpdateShow({ includeIntro: e.target.checked })}
              className="w-4 h-4 accent-amber-500 rounded shrink-0"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-3.5 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-100">
                Include Scrolling Credits Roll (end_credits.mp4)
              </div>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                Renders theatrical scrolling cast & music credits roll
              </div>
            </div>
            <input
              type="checkbox"
              checked={show.includeEndCredits}
              onChange={(e) => onUpdateShow({ includeEndCredits: e.target.checked })}
              className="w-4 h-4 accent-amber-500 rounded shrink-0"
            />
          </label>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* PROMPT SECTION 3: STORY, SCRIPT & VIDEO PRODUCTION + VOICE MIC + AI  */}
      {/* ===================================================================== */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/65 backdrop-blur-xl p-5 sm:p-6 space-y-6 shadow-xs dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800/80">
          <div>
            <h2 className="font-display text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              03. Story, Script & Video Production Prompt
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Write, polish with AI, or speak your story, drama episode plot, or song lyrics. Our background queue builds all scenes, voiceovers, .SRT subtitles, music, and your Universal ZIP.
            </p>
          </div>

          {/* Script Enhancer + Voice Dictation Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleEnhanceScript}
              disabled={enhancingScript}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 active:scale-[0.98] px-3.5 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 transition-all whitespace-nowrap disabled:opacity-60 cursor-pointer"
            >
              {enhancingScript ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{enhancingScript ? 'Polishing...' : 'AI Polish Script'}</span>
            </button>

            <select
              value={dictationLang}
              onChange={(e) =>
                setDictationLang(e.target.value as 'en-US' | 'ur-PK' | 'hi-IN' | 'ar-SA')
              }
              aria-label="Voice Dictation Language"
              className="min-h-[42px] rounded-xl border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-300 focus:outline-none focus:border-amber-500"
            >
              <option value="en-US">Mic: English</option>
              <option value="ur-PK">Mic: Urdu (اردو)</option>
              <option value="hi-IN">Mic: Hindi (हिन्दी)</option>
              <option value="ar-SA">Mic: Arabic (العربية)</option>
            </select>

            <button
              type="button"
              onClick={toggleVoiceDictation}
              className={`min-h-[42px] inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer ${
                isDictating
                  ? 'bg-red-500 text-white'
                  : 'border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300'
              }`}
            >
              {isDictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isDictating ? 'Stop Listening' : 'Speak Story'}</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <textarea
            rows={6}
            value={show.storyPrompt}
            onChange={(e) => onUpdateShow({ storyPrompt: e.target.value })}
            placeholder="Write or speak your full episode story, dialogue scenes, moral tale, or song lyrics here..."
            className="w-full rounded-xl border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 text-sm text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 leading-relaxed focus:outline-none focus:border-amber-500"
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-zinc-500 font-mono tabular-nums">
            <span>
              {isDictating
                ? 'Microphone active — speak naturally to append to story...'
                : 'Auto-splits into sequential numbered scenes (scene_01, scene_02...) + .SRT captions'}
            </span>
            <span>{show.storyPrompt.length} / 8000 chars</span>
          </div>
        </div>

        {/* Trailer Toggle, Scene Count & Motion Engine */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-3.5 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-100">
                Official Promo Teaser (trailer.mp4)
              </div>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                Adds dedicated promo teaser clip to ZIP root
              </div>
            </div>
            <input
              type="checkbox"
              checked={show.includeTrailer}
              onChange={(e) => onUpdateShow({ includeTrailer: e.target.checked })}
              className="w-4 h-4 accent-amber-500 rounded shrink-0"
            />
          </label>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-3.5 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-100">
                Sequential Scenes
              </div>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                Numbered clips in video_clips/
              </div>
            </div>
            <select
              value={targetSceneCount}
              onChange={(e) => setTargetSceneCount(Number(e.target.value))}
              className="min-h-[38px] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-mono tabular-nums text-zinc-950 dark:text-zinc-100 focus:outline-none"
            >
              <option value={2}>2 Scenes (Quick)</option>
              <option value={3}>3 Scenes</option>
              <option value={4}>4 Scenes (Standard)</option>
              <option value={6}>6 Scenes (Extended)</option>
              <option value={8}>8 Scenes (Full Episode)</option>
            </select>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-3.5 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-100">
                Video Motion Engine
              </div>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                {useFastMotion ? 'Fast Studio Camera Pan' : 'Veo AI Video Synthesis'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUseFastMotion((v) => !v)}
              className="min-h-[38px] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap cursor-pointer transition-colors"
            >
              {useFastMotion ? 'Studio Fast' : 'Veo AI Full'}
            </button>
          </div>
        </div>

        {section3Error && (
          <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2.5">
            {section3Error}
          </p>
        )}

        {/* Primary Production Launch Bar + Live Runtime/Deliverable Estimator */}
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-900 dark:text-zinc-200 font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Est. Runtime: <span className="font-mono tabular-nums font-semibold">~{productionEstimate.totalSec}s</span>
              </span>
              <span className="text-zinc-400">·</span>
              <span className="font-mono tabular-nums">
                {productionEstimate.totalTasks} Auto-Retried Pipeline Steps
              </span>
            </div>
            <div>
              ZIP Bundles: thumbnail.jpg, video_clips/scene_01..{String(targetSceneCount).padStart(2, '0')}.mp4,{' '}
              {show.languages.map((l) => `audio_${l.toLowerCase()}/`).join(', ')},{' '}
              {show.languages.map((l) => `subtitles_${l.toLowerCase()}/ (.srt)`).join(', ')}, edl_timeline_markers.csv &amp; production_script.txt
            </div>
          </div>

          <button
            type="button"
            onClick={handleLaunchProduction}
            disabled={launchingPipeline}
            className="min-h-[52px] inline-flex items-center justify-center gap-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-6 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/15 transition-all whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
          >
            {launchingPipeline ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5 fill-current" />
            )}
            <span>
              {launchingPipeline
                ? 'Queueing Production...'
                : 'Start Automated Production & Build ZIP'}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
};
