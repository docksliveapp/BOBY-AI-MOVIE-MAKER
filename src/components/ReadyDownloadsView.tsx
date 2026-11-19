import React, { useState } from 'react';
import {
  Captions,
  Download,
  Eye,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Film,
  FolderArchive,
  Loader2,
  Music,
  PackageCheck,
  Trash2,
  Volume2,
} from 'lucide-react';
import type { PipelineCheckpoint, RenderJob, ShowProfile } from '../types';
import { getAssetFromVault, getCheckpointFromVault } from '../services/mediaVault';
import {
  renderKeyframeMotionClip,
  renderScrollingEndCreditsClip,
} from '../utils/canvasMotionRenderer';
import {
  buildUniversalProductionZip,
  triggerZipDownload,
} from '../utils/zipExporter';
import { ResilientImage } from './ResilientImage';
import { StudioModal } from './StudioModal';

interface ReadyDownloadsViewProps {
  jobs: RenderJob[];
  shows: ShowProfile[];
  onDeleteJob: (jobId: string) => Promise<void>;
  onGoToStudio: () => void;
}

export const ReadyDownloadsView: React.FC<ReadyDownloadsViewProps> = ({
  jobs,
  shows,
  onDeleteJob,
  onGoToStudio,
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [buildingSampleZip, setBuildingSampleZip] = useState(false);
  const [inspectJob, setInspectJob] = useState<RenderJob | null>(null);
  const [inspectCheckpoint, setInspectCheckpoint] = useState<PipelineCheckpoint | null>(null);
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<RenderJob | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const completedJobs = jobs.filter((j) => j.status === 'completed');

  const handleDownloadJobZip = async (job: RenderJob) => {
    setDownloadingId(job.id);
    setStatusToast(null);
    try {
      const storedZip = await getAssetFromVault(job.zipAssetId);
      if (storedZip instanceof Blob) {
        triggerZipDownload(storedZip, job.showTitle, job.episodeTitle);
        return;
      }

      // Re-pack on the fly from checkpoint if Blob was cleared
      const cp = await getCheckpointFromVault(job.checkpointKey);
      const matchedShow = shows.find((s) => s.id === job.showId);
      if (cp && matchedShow) {
        const rebuiltBlob = await buildUniversalProductionZip({
          show: matchedShow,
          characters: [],
          checkpoint: cp,
        });
        triggerZipDownload(rebuiltBlob, job.showTitle, job.episodeTitle);
        return;
      }

      setStatusToast(
        'Local ZIP cache was cleared on this browser. Click "Download Sample NLE Test ZIP" or re-run from Studio.'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const handleOpenInspector = async (job: RenderJob) => {
    setInspectJob(job);
    const cp = await getCheckpointFromVault(job.checkpointKey);
    setInspectCheckpoint(cp);
  };

  // Builds a genuine, playable NLE-ready sample ZIP in ~5 seconds using our studio showcase assets
  const handleBuildSampleTestPack = async () => {
    setBuildingSampleZip(true);
    setStatusToast(null);
    try {
      const sampleShow: ShowProfile = shows[0] || {
        id: 'sample_show',
        ownerId: 'demo',
        title: 'The Clockwork Skykeeper',
        titleIdeaPrompt: 'Young boy repairs the sunset observatory',
        logline: 'Eight-year-old Zayd restores golden daylight to his mountain village.',
        contentMode: 'cartoon_3d',
        visualStyle: 'pixar_3d',
        aspectRatio: '16:9',
        fps: 24,
        resolution: '1080p',
        languages: ['Urdu', 'English'],
        includeIntro: true,
        includeEndCredits: true,
        includeTrailer: true,
        storyPrompt: 'Zayd climbs the brass observatory and restarts the sun pendulum.',
        thumbnailAssetId: '/src/assets/images/demo_cartoon_thumb_1795041191481.jpg',
        characterCount: 1,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      };

      const introClip = await renderKeyframeMotionClip({
        imageDataUrl: '/src/assets/images/studio_hero_backdrop_1795041189982.jpg',
        aspectRatio: '16:9',
        fps: 24,
        durationSeconds: 3,
        overlayTitle: sampleShow.title,
        overlaySubtitle: 'BOBY AI MOVIE MAKER · Official Studio Pack',
      });

      const scene01Clip = await renderKeyframeMotionClip({
        imageDataUrl: '/src/assets/images/demo_cartoon_thumb_1795041191481.jpg',
        aspectRatio: '16:9',
        fps: 24,
        durationSeconds: 3,
      });

      const creditsClip = await renderScrollingEndCreditsClip({
        showTitle: sampleShow.title,
        creditLines: [
          'Directed & Automated by BOBY AI MOVIE MAKER',
          'Lead Character: Zayd (Face-Locked)',
          'Format: 16:9 Cinema · 24 FPS',
        ],
        aspectRatio: '16:9',
        fps: 24,
      });

      const sampleCheckpoint: PipelineCheckpoint = {
        jobId: 'sample_pack',
        showId: sampleShow.id,
        thumbnailDataUrl: '/src/assets/images/demo_cartoon_thumb_1795041191481.jpg',
        introVideoBase64: introClip.base64Data,
        introVideoMimeType: introClip.mimeType,
        trailerVideoBase64: scene01Clip.base64Data,
        trailerVideoMimeType: scene01Clip.mimeType,
        endCreditsVideoBase64: creditsClip.base64Data,
        endCreditsVideoMimeType: creditsClip.mimeType,
        useFastStudioMotion: true,
        completedStepIds: [],
        plan: {
          episodeTitle: 'Episode 01 — Dawn Over the Gears',
          introPrompt: 'Studio intro',
          trailerPrompt: 'Official promo teaser',
          endCreditsRoll: ['Directed with BOBY AI MOVIE MAKER'],
          bgmPrompt: 'Warm orchestral strings',
          scenes: [
            {
              sceneNumber: 1,
              sceneCode: 'scene_01',
              heading: 'EXT. BRASS OBSERVATORY - SUNSET',
              visualPrompt: 'Zayd inside the golden clockwork observatory',
              motionPrompt: 'Slow cinema push-in',
              bgmMood: 'Warm wonder',
              speakerName: 'Zayd',
              voicePersona: 'Puck',
              dialogues: [
                {
                  language: 'Urdu',
                  line: 'آج سورج کی روشنی دوبارہ پورے گاؤں کو جگمگا دے گی!',
                },
                {
                  language: 'English',
                  line: 'Today the golden sunlight will shine across our entire valley again!',
                },
              ],
            },
          ],
        },
        scenes: {
          scene_01: {
            sceneCode: 'scene_01',
            videoBase64: scene01Clip.base64Data,
            videoMimeType: scene01Clip.mimeType,
            voiceByLang: {},
          },
        },
      };

      const blob = await buildUniversalProductionZip({
        show: sampleShow,
        characters: [],
        checkpoint: sampleCheckpoint,
      });

      triggerZipDownload(blob, sampleShow.title, 'NLE_Editor_Test_Pack');
    } catch (err) {
      setStatusToast(err instanceof Error ? err.message : String(err));
    } finally {
      setBuildingSampleZip(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800/80">
        <div>
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Compatible with Premiere Pro · DaVinci Resolve · CapCut · Filmora · InShot · Vegas Pro
          </div>
          <h1
            className="font-display text-2xl font-bold text-zinc-950 dark:text-zinc-50 mt-0.5"
            style={{ textWrap: 'balance' }}
          >
            Ready Downloads (Universal ZIP Archives)
          </h1>
        </div>

        <button
          type="button"
          onClick={handleBuildSampleTestPack}
          disabled={buildingSampleZip}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] px-4 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-200 transition-all whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
        >
          {buildingSampleZip ? (
            <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
          ) : (
            <PackageCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          )}
          <span>
            {buildingSampleZip
              ? 'Encoding Sample Clips...'
              : 'Download Sample NLE Test ZIP'}
          </span>
        </button>
      </div>

      {statusToast && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          {statusToast}
        </div>
      )}

      {/* Standard ZIP Structure Reference Strip */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-5 shadow-xs dark:shadow-none">
        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 mb-3">
          Included in Every Universal Studio ZIP Export:
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-1.5">
            <FileArchive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">thumbnail.jpg</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="truncate">intro_sequence.mp4</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">video_clips/scene_01..</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">audio_urdu/ &amp; english/</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Captions className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">subtitles_&lt;lang&gt;/ (.srt)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="truncate">edl_timeline_markers.csv</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="truncate">background_music/</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300 shrink-0" />
            <span className="truncate">production_script.txt</span>
          </div>
        </div>
      </div>

      {/* Completed Archives List */}
      {completedJobs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-12 text-center space-y-4">
          <FolderArchive className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-200">
              No Completed Production Archives Yet
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
              Once your background queue finishes rendering all scenes, voiceovers, .SRT subtitles, and music, your 1-click downloadable ZIP bundle appears right here.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToStudio}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-4 py-2.5 text-xs font-semibold text-zinc-950 transition-all cursor-pointer"
          >
            Produce Your First Episode
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {completedJobs.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/65 backdrop-blur-xl overflow-hidden flex flex-col justify-between shadow-xs dark:shadow-none"
            >
              <div>
                <div className="aspect-video w-full bg-zinc-200 dark:bg-zinc-950 relative overflow-hidden">
                  <ResilientImage
                    assetIdOrUrl={job.thumbnailAssetId}
                    alt={job.showTitle}
                    className="w-full h-full object-cover"
                    fallbackLabel={job.showTitle}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex items-end p-4">
                    <div>
                      <div className="text-xs font-mono tabular-nums text-emerald-300">
                        {job.aspectRatio} · {job.fps} FPS · {job.resolution} · {job.sceneCount} Scenes
                      </div>
                      <h3 className="font-display text-lg font-bold text-white mt-0.5">
                        {job.showTitle}
                      </h3>
                      <div className="text-xs text-zinc-200">{job.episodeTitle}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                  <span>Audio &amp; SRT: {job.languages.join(' · ')}</span>
                  <span className="font-mono tabular-nums">
                    {new Date(job.updatedAtMs).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="px-4 py-3.5 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadJobZip(job)}
                  disabled={downloadingId === job.id}
                  className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-4 py-2 text-xs font-bold text-zinc-950 transition-all whitespace-nowrap cursor-pointer"
                >
                  {downloadingId === job.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>1-Click Download ZIP</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenInspector(job)}
                  title="Preview Rendered Scenes & Audio"
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-200 whitespace-nowrap cursor-pointer transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Preview
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteJob(job)}
                  aria-label="Delete Archive Record"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:bg-red-500/15 hover:text-red-500 dark:hover:text-red-400 text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scene & Audio Preview Inspector Modal */}
      <StudioModal
        open={Boolean(inspectJob)}
        onClose={() => {
          setInspectJob(null);
          setInspectCheckpoint(null);
        }}
        title={inspectJob ? `${inspectJob.showTitle} — ${inspectJob.episodeTitle}` : 'Scene Preview'}
        subtitle="Preview rendered scenes, multi-language voiceovers, and background score"
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-5">
          {!inspectCheckpoint?.plan ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-8">
              Preview assets are stored in the device vault where this render completed. Use 1-Click Download ZIP to export.
            </p>
          ) : (
            <>
              {inspectCheckpoint.masterBgmBase64 && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 space-y-2">
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Master Background Score (background_music/scene_01_bgm.mp3)
                  </div>
                  <audio
                    controls
                    className="w-full h-9"
                    src={`data:${inspectCheckpoint.masterBgmMimeType || 'audio/mpeg'};base64,${inspectCheckpoint.masterBgmBase64}`}
                  />
                </div>
              )}

              <div className="space-y-4">
                {inspectCheckpoint.plan.scenes.map((sc, idx) => {
                  const code = `scene_${String(idx + 1).padStart(2, '0')}`;
                  const rendered =
                    inspectCheckpoint.scenes[sc.sceneCode] ||
                    inspectCheckpoint.scenes[code];

                  return (
                    <div
                      key={code}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
                          video_clips/{code}.mp4
                        </span>
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">
                          {sc.heading}
                        </span>
                      </div>

                      {rendered?.videoBase64 && (
                        <video
                          controls
                          playsInline
                          className="w-full max-h-64 rounded-lg bg-black object-contain"
                          src={`data:${rendered.videoMimeType || 'video/webm'};base64,${rendered.videoBase64}`}
                        />
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(rendered?.voiceByLang || {}).map(([lang, audioObj]) => (
                          <div key={lang} className="space-y-1">
                            <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                              audio_{lang.toLowerCase()}/{code}_{lang.toLowerCase()}.mp3
                            </div>
                            <audio
                              controls
                              className="w-full h-8"
                              src={`data:${audioObj.mimeType};base64,${audioObj.base64}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </StudioModal>

      {/* Delete Archive Confirmation Modal */}
      <StudioModal
        open={Boolean(confirmDeleteJob)}
        onClose={() => setConfirmDeleteJob(null)}
        title="Delete Archive Record?"
        maxWidthClass="max-w-sm"
      >
        {confirmDeleteJob && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Delete{' '}
              <strong className="text-zinc-950 dark:text-zinc-100">
                {confirmDeleteJob.showTitle} — {confirmDeleteJob.episodeTitle}
              </strong>{' '}
              from Ready Downloads?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteJob(null)}
                className="min-h-[42px] rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = confirmDeleteJob.id;
                  setConfirmDeleteJob(null);
                  await onDeleteJob(id);
                }}
                className="min-h-[42px] rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        )}
      </StudioModal>
    </div>
  );
};
