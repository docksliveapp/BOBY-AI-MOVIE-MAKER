import React from 'react';
import { Check, Film, Globe, Monitor, SlidersHorizontal } from 'lucide-react';
import type {
  AspectRatioOption,
  ContentMode,
  FpsOption,
  ResolutionOption,
  ShowProfile,
  SupportedLanguage,
  VisualStyle,
} from '../types';

interface ProductionSettingsBarProps {
  show: ShowProfile;
  onUpdateShow: (patch: Partial<ShowProfile>) => void;
}

const CONTENT_MODES: Array<{ value: ContentMode; label: string }> = [
  { value: 'cartoon_3d', label: '3D Animated Cartoon' },
  { value: 'human_movie', label: 'Real Human Movie / Drama' },
  { value: 'music_video', label: 'Music Video' },
  { value: 'social_reel', label: 'Social Media Reel / Short' },
];

const VISUAL_STYLES: Array<{ value: VisualStyle; label: string }> = [
  { value: 'pixar_3d', label: '3D Pixar Animation' },
  { value: 'hollywood_live', label: 'Cinematic Hollywood Live-Action' },
  { value: 'anime', label: 'Anime Studio' },
  { value: 'hyper_drama', label: 'Hyper-Realistic Drama' },
  { value: 'film_noir', label: 'Vintage Film Noir' },
  { value: 'cyberpunk_neon', label: 'Cyberpunk Neon' },
];

const ASPECT_RATIOS: Array<{ value: AspectRatioOption; label: string; sub: string }> = [
  { value: '16:9', label: '16:9', sub: 'YouTube / TV' },
  { value: '9:16', label: '9:16', sub: 'Reels / TikTok' },
  { value: '1:1', label: '1:1', sub: 'Square Feed' },
  { value: '2.39:1', label: '2.39:1', sub: 'Cinema Movie' },
];

const FPS_OPTIONS: FpsOption[] = [24, 30, 60];

const RESOLUTIONS: Array<{ value: ResolutionOption; label: string }> = [
  { value: '720p', label: '720p HD' },
  { value: '1080p', label: '1080p Full HD' },
  { value: '4K', label: '4K Ultra HD' },
  { value: '8K', label: '8K Master' },
];

const ALL_LANGUAGES: SupportedLanguage[] = [
  'Urdu',
  'English',
  'Arabic',
  'Hindi',
  'Spanish',
  'Turkish',
  'French',
  'Chinese',
];

export const ProductionSettingsBar: React.FC<ProductionSettingsBarProps> = ({
  show,
  onUpdateShow,
}) => {
  const toggleLanguage = (lang: SupportedLanguage) => {
    const exists = show.languages.includes(lang);
    if (exists) {
      if (show.languages.length <= 1) return; // Keep at least 1 language
      onUpdateShow({ languages: show.languages.filter((l) => l !== lang) });
    } else {
      onUpdateShow({ languages: [...show.languages, lang] });
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/65 backdrop-blur-xl p-5 sm:p-6 space-y-6 shadow-xs dark:shadow-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h2 className="font-display text-base font-semibold text-zinc-950 dark:text-zinc-100">
            Universal Production & Platform Settings
          </h2>
        </div>
        <div className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
          Active Spec · {show.aspectRatio} · {show.fps} FPS · {show.resolution} ·{' '}
          {show.languages.join(' / ')}
        </div>
      </div>

      {/* Row 1: Content Mode & Visual Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Content Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CONTENT_MODES.map((m) => {
              const active = show.contentMode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => onUpdateShow({ contentMode: m.value })}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium text-left transition-all active:scale-[0.98] cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-zinc-950 font-semibold shadow-xs'
                      : 'border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-700'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="visual-style-select"
            className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
          >
            <Monitor className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            Visual Filter Style
          </label>
          <select
            id="visual-style-select"
            value={show.visualStyle}
            onChange={(e) => onUpdateShow({ visualStyle: e.target.value as VisualStyle })}
            className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            {VISUAL_STYLES.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Aspect Ratio, FPS, Resolution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Aspect Ratio */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
            Frame Size / Aspect Ratio
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {ASPECT_RATIOS.map((ar) => {
              const active = show.aspectRatio === ar.value;
              return (
                <button
                  key={ar.value}
                  type="button"
                  onClick={() => onUpdateShow({ aspectRatio: ar.value })}
                  className={`min-h-[48px] rounded-xl px-2 py-1.5 flex flex-col items-center justify-center transition-all active:scale-[0.98] cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-zinc-950 font-semibold shadow-xs'
                      : 'border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-700'
                  }`}
                >
                  <span className="text-xs font-mono tabular-nums">{ar.label}</span>
                  <span
                    className={`text-[10px] truncate max-w-full ${
                      active ? 'text-zinc-900' : 'text-zinc-500'
                    }`}
                  >
                    {ar.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Frame Rate (FPS) */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
            Frame Rate (FPS)
          </span>
          <div className="grid grid-cols-3 gap-2">
            {FPS_OPTIONS.map((fpsVal) => {
              const active = show.fps === fpsVal;
              return (
                <button
                  key={fpsVal}
                  type="button"
                  onClick={() => onUpdateShow({ fps: fpsVal })}
                  className={`min-h-[48px] rounded-xl px-3 py-2 text-xs font-mono tabular-nums transition-all active:scale-[0.98] cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-zinc-950 font-semibold shadow-xs'
                      : 'border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-700'
                  }`}
                >
                  {fpsVal} FPS
                </button>
              );
            })}
          </div>
        </div>

        {/* Resolution Quality */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
            Resolution Quality
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {RESOLUTIONS.map((res) => {
              const active = show.resolution === res.value;
              return (
                <button
                  key={res.value}
                  type="button"
                  onClick={() => onUpdateShow({ resolution: res.value })}
                  className={`min-h-[48px] rounded-xl px-2 py-2 text-xs font-mono tabular-nums transition-all active:scale-[0.98] cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-zinc-950 font-semibold shadow-xs'
                      : 'border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-700'
                  }`}
                >
                  {res.value}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Multi-Language Voiceover Selector */}
      <div className="space-y-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            Multi-Language Voiceover &amp; .SRT Subtitle Tracks (Dedicated folder per language in ZIP)
          </span>
          <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
            {show.languages.length} selected
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_LANGUAGES.map((lang) => {
            const checked = show.languages.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLanguage(lang)}
                className={`min-h-[42px] inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer ${
                  checked
                    ? 'border border-emerald-500/50 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold'
                    : 'border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded flex items-center justify-center border ${
                    checked
                      ? 'bg-emerald-500 border-emerald-500 text-zinc-950'
                      : 'border-zinc-400 dark:border-zinc-700'
                  }`}
                >
                  {checked && <Check className="w-3 h-3 stroke-[3]" />}
                </span>
                <span>{lang}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
