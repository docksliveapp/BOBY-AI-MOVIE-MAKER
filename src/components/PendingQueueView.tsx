import React, { useState } from 'react';
import {
  AlertCircle,
  FastForward,
  ListVideo,
  Loader2,
  Pause,
  Play,
  RotateCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { RenderJob } from '../types';
import { ResilientImage } from './ResilientImage';

interface PendingQueueViewProps {
  jobs: RenderJob[];
  onPauseJob: (job: RenderJob) => void;
  onResumeJob: (job: RenderJob, forceFastMotion?: boolean) => void;
  onDeleteJob: (jobId: string) => Promise<void>;
  onGoToStudio: () => void;
}

export const PendingQueueView: React.FC<PendingQueueViewProps> = ({
  jobs,
  onPauseJob,
  onResumeJob,
  onDeleteJob,
  onGoToStudio,
}) => {
  const [confirmRemoveJob, setConfirmRemoveJob] = useState<RenderJob | null>(null);

  const pendingJobs = jobs.filter((j) => j.status !== 'completed');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div>
          <div className="text-xs font-medium text-amber-400">
            Zero-Interruption Render Engine · 3x Auto-Retry & Checkpoint Recovery
          </div>
          <h1 className="font-display text-2xl font-bold text-zinc-50 mt-0.5">
            Pending Generations Queue
          </h1>
        </div>

        <button
          type="button"
          onClick={onGoToStudio}
          className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Queue Another Production
        </button>
      </div>

      {pendingJobs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-12 text-center space-y-4">
          <ListVideo className="w-10 h-10 text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-200">
              No Pending Generations in Queue
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Start an episode or video render in the 3-Step Studio. Completed jobs move automatically to Ready Downloads with a 1-click Universal ZIP archive.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToStudio}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition-colors cursor-pointer"
          >
            Open 3-Step Studio
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingJobs.map((job) => {
            const pct = Math.min(
              99,
              Math.max(2, Math.round((job.completedSteps / Math.max(1, job.totalSteps)) * 100))
            );
            const isRunning = job.status === 'running' || job.status === 'queued';
            const isError = job.status === 'error';
            const isPaused = job.status === 'paused';

            return (
              <div
                key={job.id}
                className="rounded-2xl border border-zinc-800/90 bg-zinc-900/65 backdrop-blur-xl p-5 space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-24 h-14 rounded-xl overflow-hidden border border-zinc-800 shrink-0">
                      <ResilientImage
                        assetIdOrUrl={job.thumbnailAssetId}
                        alt={job.showTitle}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-zinc-400">
                        <span>{job.aspectRatio}</span>
                        <span>·</span>
                        <span>{job.fps} FPS</span>
                        <span>·</span>
                        <span>{job.resolution}</span>
                        <span>·</span>
                        <span>{job.sceneCount} Scenes</span>
                        {job.retryCount > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-amber-400">
                              Auto-Retries: {job.retryCount}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="font-display text-base font-semibold text-zinc-100 truncate">
                        {job.showTitle} — {job.episodeTitle}
                      </h3>
                      <div className="text-xs text-zinc-400 flex items-center gap-2">
                        {isRunning && (
                          <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                        )}
                        {isError && (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="truncate">{job.currentStepLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Queue Controls */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isRunning && (
                      <button
                        type="button"
                        onClick={() => onPauseJob(job)}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-200 whitespace-nowrap cursor-pointer"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        Pause
                      </button>
                    )}

                    {(isPaused || isError) && (
                      <button
                        type="button"
                        onClick={() => onResumeJob(job, false)}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-2 text-xs font-semibold text-zinc-950 whitespace-nowrap cursor-pointer"
                      >
                        {isError ? (
                          <RotateCw className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>{isError ? 'Retry From Checkpoint' : 'Resume'}</span>
                      </button>
                    )}

                    {isError && (
                      <button
                        type="button"
                        onClick={() => onResumeJob(job, true)}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-2 text-xs font-semibold text-emerald-300 whitespace-nowrap cursor-pointer"
                      >
                        <FastForward className="w-3.5 h-3.5" />
                        Switch to Fast Motion & Resume
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setConfirmRemoveJob(job)}
                      aria-label="Cancel and remove job"
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-red-500/15 hover:text-red-400 text-zinc-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums text-zinc-400">
                    <span>
                      Step {job.completedSteps} of {job.totalSteps} · Languages:{' '}
                      {job.languages.join(', ')}
                    </span>
                    <span className="text-amber-400 font-semibold">{pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-950 overflow-hidden border border-zinc-800">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-transform duration-200 origin-left"
                      style={{ transform: `scaleX(${pct / 100})` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Job Removal Modal */}
      {confirmRemoveJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-zinc-100">
              Cancel Render Job?
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Remove <strong>{confirmRemoveJob.showTitle}</strong> from the render queue? You can pause instead if you want to resume later from the saved checkpoint.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRemoveJob(null)}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 cursor-pointer"
              >
                Keep Job
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = confirmRemoveJob.id;
                  setConfirmRemoveJob(null);
                  await onDeleteJob(id);
                }}
                className="rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                Remove Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
