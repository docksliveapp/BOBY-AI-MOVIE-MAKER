import React from 'react';
import {
  ArrowRight,
  Clapperboard,
  Film,
  Music,
  Plus,
  Smartphone,
  Sparkles,
  Tv,
} from 'lucide-react';
import type {
  AspectRatioOption,
  ContentMode,
  FpsOption,
  NavigationTab,
  RenderJob,
  ShowProfile,
  VisualStyle,
} from '../types';
import { ResilientImage } from './ResilientImage';

interface DashboardHomeProps {
  shows: ShowProfile[];
  jobs: RenderJob[];
  totalCharactersCount: number;
  onQuickLaunchFormat: (preset: {
    contentMode: ContentMode;
    visualStyle: VisualStyle;
    aspectRatio: AspectRatioOption;
    fps: FpsOption;
    defaultTitle: string;
  }) => void;
  onUseInspirationPrompt: (preset: {
    title: string;
    ideaPrompt: string;
    storyPrompt: string;
    contentMode: ContentMode;
    visualStyle: VisualStyle;
    aspectRatio: AspectRatioOption;
  }) => void;
  onOpenShowInStudio: (showId: string) => void;
  onNavigateTab: (tab: NavigationTab) => void;
}

const FORMAT_CARDS: Array<{
  mode: ContentMode;
  style: VisualStyle;
  ratio: AspectRatioOption;
  fps: FpsOption;
  title: string;
  subtitle: string;
  specs: string;
  defaultShowTitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    mode: 'cartoon_3d',
    style: 'pixar_3d',
    ratio: '16:9',
    fps: 30,
    title: '3D Animated Cartoon',
    subtitle: 'Kids stories, moral episodes & animated family adventures',
    specs: '16:9 · 30 FPS · Pixar 3D',
    defaultShowTitle: 'Adventures of Little Zayd',
    icon: Sparkles,
  },
  {
    mode: 'human_movie',
    style: 'hollywood_live',
    ratio: '2.39:1',
    fps: 24,
    title: 'Real Human Movie / Drama',
    subtitle: 'Web dramas, feature films & emotional serial episodes',
    specs: '2.39:1 · 24 FPS · Cinema Live',
    defaultShowTitle: 'Shadows Over Clifton',
    icon: Film,
  },
  {
    mode: 'social_reel',
    style: 'hyper_drama',
    ratio: '9:16',
    fps: 60,
    title: 'Social Media Reel / Short',
    subtitle: 'Vertical viral stories for Instagram Reels, TikTok & Shorts',
    specs: '9:16 · 60 FPS · Vertical HD',
    defaultShowTitle: '60-Second Mystery Reel',
    icon: Smartphone,
  },
  {
    mode: 'music_video',
    style: 'cyberpunk_neon',
    ratio: '16:9',
    fps: 24,
    title: 'AI Music Video',
    subtitle: 'Turn song lyrics or nasheeds into synchronized visual scenes',
    specs: '16:9 · 24 FPS · Lyria Score',
    defaultShowTitle: 'Neon Horizon Anthem',
    icon: Music,
  },
];

const INSPIRATION_IDEAS: Array<{
  title: string;
  meta: string;
  ideaPrompt: string;
  storyPrompt: string;
  contentMode: ContentMode;
  visualStyle: VisualStyle;
  aspectRatio: AspectRatioOption;
  previewImage: string;
}> = [
  {
    title: 'The Clockwork Skykeeper',
    meta: '3D Cartoon · Urdu & English · 16:9',
    ideaPrompt:
      'An 8-year-old curious boy discovers his grandfather’s brass observatory controls the town sunrise.',
    storyPrompt:
      'Eight-year-old Zayd climbs into his grandfather’s golden brass observatory before dawn. When the giant pendulum freezes, Zayd bravely repairs the smallest star-gear with his pocket compass, bringing warm sunlight back over the mountain valley while his mother and grandfather cheer.',
    contentMode: 'cartoon_3d',
    visualStyle: 'pixar_3d',
    aspectRatio: '16:9',
    previewImage: '/src/assets/images/demo_cartoon_thumb_1795041191481.jpg',
  },
  {
    title: 'The Last Boardroom Verdict',
    meta: 'Web Drama · Urdu, Hindi & English · 2.39:1',
    ideaPrompt:
      'A wealthy businessman faces a life-changing truth when his estranged younger brother returns.',
    storyPrompt:
      'At twilight on the 40th floor, industrialist Tariq Mahmood stands by the glass overlooking the city lights. His younger brother Bilal enters holding their late father’s handwritten ledger, revealing who truly saved the family company twenty years ago.',
    contentMode: 'human_movie',
    visualStyle: 'hollywood_live',
    aspectRatio: '2.39:1',
    previewImage: '/src/assets/images/demo_drama_thumb_1795041193052.jpg',
  },
];

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  shows,
  jobs,
  totalCharactersCount,
  onQuickLaunchFormat,
  onUseInspirationPrompt,
  onOpenShowInStudio,
  onNavigateTab,
}) => {
  const activeJobsCount = jobs.filter(
    (j) => j.status === 'running' || j.status === 'queued' || j.status === 'paused'
  ).length;
  const completedZipsCount = jobs.filter((j) => j.status === 'completed').length;

  return (
    <div className="space-y-10">
      {/* Top Studio Welcome & Primary Action */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Zero-Friction Prompt Automation · Asaan 3-Step Studio
          </div>
          <h1
            className="font-display text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-zinc-50"
            style={{ textWrap: 'balance' }}
          >
            What Would You Like to Direct Today?
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Pick any production format below or open an existing show profile. Every title, character face, multi-language voiceover, .SRT subtitle track, and numbered scene clip is bundled into a single editor-ready ZIP.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onQuickLaunchFormat({
              contentMode: 'cartoon_3d',
              visualStyle: 'pixar_3d',
              aspectRatio: '16:9',
              fps: 24,
              defaultTitle: 'New Studio Production',
            })
          }
          className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Movie / Series
        </button>
      </section>

      {/* Clean Studio Metrics Strip (Tabular Numerals) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('shows')}
          className="text-left rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-xl p-5 hover:border-amber-500/40 dark:hover:border-zinc-700 active:scale-[0.99] transition-all cursor-pointer shadow-xs dark:shadow-none"
        >
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Shows & Series Profiles
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
            {shows.length}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Unlimited episodes</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('studio')}
          className="text-left rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-xl p-5 hover:border-violet-500/40 dark:hover:border-zinc-700 active:scale-[0.99] transition-all cursor-pointer shadow-xs dark:shadow-none"
        >
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Registered Cast Actors
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-violet-600 dark:text-violet-300">
            {totalCharactersCount}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Prompt-driven face lock</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('queue')}
          className="text-left rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-xl p-5 hover:border-amber-500/40 dark:hover:border-zinc-700 active:scale-[0.99] transition-all cursor-pointer shadow-xs dark:shadow-none"
        >
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Pending Render Queue
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {activeJobsCount}
          </div>
          <div className="mt-1 text-xs text-zinc-500">3x auto-retry & resume</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('downloads')}
          className="text-left rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-xl p-5 hover:border-emerald-500/40 dark:hover:border-zinc-700 active:scale-[0.99] transition-all cursor-pointer shadow-xs dark:shadow-none"
        >
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Ready ZIP Archives
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {completedZipsCount}
          </div>
          <div className="mt-1 text-xs text-zinc-500">1-click NLE export</div>
        </button>
      </section>

      {/* Quick Format Launchers (Large Intuitive Visual Cards) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            01. Quick Format Launchers
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Click any format to auto-configure frame size & FPS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FORMAT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.mode}
                type="button"
                onClick={() =>
                  onQuickLaunchFormat({
                    contentMode: card.mode,
                    visualStyle: card.style,
                    aspectRatio: card.ratio,
                    fps: card.fps,
                    defaultTitle: card.defaultShowTitle,
                  })
                }
                className="group text-left rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-xl p-5 hover:border-amber-500/60 hover:bg-amber-50/40 dark:hover:bg-zinc-900 active:scale-[0.99] transition-all flex flex-col justify-between gap-4 cursor-pointer shadow-xs dark:shadow-none"
              >
                <div className="space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-zinc-950 transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-semibold text-zinc-950 dark:text-zinc-100">
                      {card.title}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {card.subtitle}
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800/70 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                  <span>{card.specs}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* AI Story Inspiration Templates */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            02. Instant Story Inspiration Starters
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Pre-fills Title, Visual Style & Story Script in 1 click
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {INSPIRATION_IDEAS.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 backdrop-blur-xl overflow-hidden flex flex-col shadow-xs dark:shadow-none"
            >
              <div className="aspect-video w-full relative overflow-hidden bg-zinc-200 dark:bg-zinc-950">
                <ResilientImage
                  assetIdOrUrl={item.previewImage}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  fallbackLabel={item.title}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex items-end p-5">
                  <div>
                    <div className="text-xs text-amber-300 font-medium">{item.meta}</div>
                    <h3 className="font-display text-xl font-bold text-white mt-0.5">
                      {item.title}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-3">
                  {item.storyPrompt}
                </p>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => onUseInspirationPrompt(item)}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 active:scale-[0.98] px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 transition-all whitespace-nowrap cursor-pointer"
                  >
                    <Clapperboard className="w-3.5 h-3.5" />
                    Load Into 3-Step Studio
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Shows Quick Access */}
      {shows.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              03. Your Active Show Profiles
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('shows')}
              className="min-h-[36px] px-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 cursor-pointer"
            >
              View All Shows
            </button>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 overflow-hidden shadow-xs dark:shadow-none">
            {shows.slice(0, 3).map((show) => (
              <div
                key={show.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/80 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-20 h-12 rounded-lg overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800">
                    <ResilientImage
                      assetIdOrUrl={show.thumbnailAssetId}
                      alt={show.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100 truncate">
                      {show.title}
                    </h4>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums mt-0.5 truncate">
                      {show.aspectRatio} · {show.fps} FPS · {show.resolution} ·{' '}
                      {show.languages.join(' / ')}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenShowInStudio(show.id)}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.98] px-4 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Tv className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Open Studio
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
