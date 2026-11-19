import React, { useMemo, useState } from 'react';
import {
  Copy,
  Film,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { ContentMode, ShowProfile } from '../types';
import { ResilientImage } from './ResilientImage';
import { StudioModal } from './StudioModal';

interface ShowsProfilesViewProps {
  shows: ShowProfile[];
  activeShowId: string;
  onOpenInStudio: (showId: string) => void;
  onCreateNewShow: () => void;
  onDuplicateShow: (show: ShowProfile) => Promise<void>;
  onDeleteShow: (showId: string) => Promise<void>;
}

const MODE_LABELS: Record<ContentMode, string> = {
  cartoon_3d: '3D Cartoon',
  human_movie: 'Movie / Web Drama',
  music_video: 'Music Video',
  social_reel: 'Social Reel',
};

export const ShowsProfilesView: React.FC<ShowsProfilesViewProps> = ({
  shows,
  activeShowId,
  onOpenInStudio,
  onCreateNewShow,
  onDuplicateShow,
  onDeleteShow,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | ContentMode>('all');
  const [confirmDeleteShow, setConfirmDeleteShow] = useState<ShowProfile | null>(null);

  const filteredShows = useMemo(() => {
    return shows.filter((s) => {
      const matchesMode = modeFilter === 'all' || s.contentMode === modeFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.logline.toLowerCase().includes(q) ||
        s.languages.some((l) => l.toLowerCase().includes(q));
      return matchesMode && matchesQuery;
    });
  }, [shows, modeFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800/80">
        <div>
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Unlimited Series · Movies · Web Dramas · Reels
          </div>
          <h1
            className="font-display text-2xl font-bold text-zinc-950 dark:text-zinc-50 mt-0.5"
            style={{ textWrap: 'balance' }}
          >
            Shows & Production Profiles
          </h1>
        </div>

        <button
          type="button"
          onClick={onCreateNewShow}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-4 py-2.5 text-xs font-semibold text-zinc-950 transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create New Profile
        </button>
      </div>

      {/* Search & Segmented Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shows by title, logline, or language..."
            className="w-full min-h-[44px] rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 pl-10 pr-4 py-2 text-sm text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All Formats' },
              { id: 'cartoon_3d', label: '3D Cartoons' },
              { id: 'human_movie', label: 'Movies & Dramas' },
              { id: 'social_reel', label: 'Reels' },
              { id: 'music_video', label: 'Music Videos' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setModeFilter(tab.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                modeFilter === tab.id
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 font-semibold shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shows Grid */}
      {filteredShows.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-12 text-center space-y-4">
          <Film className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-200">
              No matching show profiles found
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
              Create a dedicated show profile to store your locked character faces, visual filter, and recurring episode settings.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateNewShow}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-4 py-2.5 text-xs font-semibold text-zinc-950 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create First Show Profile
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShows.map((show) => {
            const isCurrent = show.id === activeShowId;
            return (
              <div
                key={show.id}
                className={`rounded-2xl border bg-white dark:bg-zinc-900/60 backdrop-blur-xl overflow-hidden flex flex-col justify-between transition-colors shadow-xs dark:shadow-none ${
                  isCurrent
                    ? 'border-amber-500/70 ring-1 ring-amber-500/20'
                    : 'border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="aspect-video w-full bg-zinc-200 dark:bg-zinc-950 relative overflow-hidden">
                    <ResilientImage
                      assetIdOrUrl={show.thumbnailAssetId}
                      alt={show.title}
                      className="w-full h-full object-cover"
                      fallbackLabel={show.title}
                    />
                  </div>

                  <div className="p-5 space-y-2">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                      {MODE_LABELS[show.contentMode]} · {show.aspectRatio} · {show.fps} FPS ·{' '}
                      {show.resolution}
                    </div>
                    <h3 className="font-display text-lg font-semibold text-zinc-950 dark:text-zinc-100 truncate">
                      {show.title}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 min-h-[32px]">
                      {show.logline || show.storyPrompt || 'Ready for 3-step prompt production.'}
                    </p>
                    <div className="pt-1 text-xs text-zinc-500">
                      Languages: {show.languages.join(' · ')}
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenInStudio(show.id)}
                    className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-3.5 py-2 text-xs font-semibold text-zinc-950 transition-all whitespace-nowrap cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Open in Studio
                  </button>

                  <button
                    type="button"
                    onClick={() => onDuplicateShow(show)}
                    title="Duplicate Show Profile"
                    aria-label="Duplicate Show Profile"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmDeleteShow(show)}
                    title="Delete Show Profile"
                    aria-label="Delete Show Profile"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:bg-red-500/15 hover:text-red-500 dark:hover:text-red-400 text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accessible Confirmation Modal for Deleting a Show Profile */}
      <StudioModal
        open={Boolean(confirmDeleteShow)}
        onClose={() => setConfirmDeleteShow(null)}
        title="Delete Show Profile?"
        maxWidthClass="max-w-sm"
      >
        {confirmDeleteShow && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Are you sure you want to permanently remove{' '}
              <strong className="text-zinc-950 dark:text-zinc-100">
                {confirmDeleteShow.title}
              </strong>
              ? Completed ZIP downloads already exported to your device remain untouched.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteShow(null)}
                className="min-h-[42px] rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const idToRemove = confirmDeleteShow.id;
                  setConfirmDeleteShow(null);
                  await onDeleteShow(idToRemove);
                }}
                className="min-h-[42px] rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                Delete Profile
              </button>
            </div>
          </div>
        )}
      </StudioModal>
    </div>
  );
};
