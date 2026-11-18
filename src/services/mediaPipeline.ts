import type {
  CharacterActor,
  PipelineCheckpoint,
  RenderJob,
  ShowProfile,
  SupportedLanguage,
  VoicePersona,
} from '../types';
import {
  composeSceneBackgroundMusic,
  generateStudioImage,
  generateVeoMotionClip,
  planStoryScenes,
  synthesizeSceneVoiceover,
  withAutoRetry,
} from './geminiService';
import {
  getAssetFromVault,
  getCheckpointFromVault,
  saveAssetToVault,
  saveCheckpointToVault,
} from './mediaVault';
import {
  renderKeyframeMotionClip,
  renderScrollingEndCreditsClip,
} from '../utils/canvasMotionRenderer';
import { buildUniversalProductionZip } from '../utils/zipExporter';

function extractBase64AndMime(dataUrl: string): { mimeType: string; data: string } | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

export interface PipelineCallbacks {
  onJobProgress: (updatedJob: RenderJob) => Promise<void> | void;
  onJobCompleted: (completedJob: RenderJob) => Promise<void> | void;
  onJobFailed: (failedJob: RenderJob, errorMsg: string) => Promise<void> | void;
}

class UnstoppablePipelineEngine {
  private pausedJobIds = new Set<string>();
  private activeJobIds = new Set<string>();

  public isJobRunning(jobId: string): boolean {
    return this.activeJobIds.has(jobId);
  }

  public pauseJob(jobId: string): void {
    this.pausedJobIds.add(jobId);
  }

  public async startOrResumeJob(params: {
    job: RenderJob;
    show: ShowProfile;
    characters: CharacterActor[];
    targetSceneCount: number;
    useFastStudioMotion: boolean;
    callbacks: PipelineCallbacks;
  }): Promise<void> {
    const { show, characters, targetSceneCount, useFastStudioMotion, callbacks } = params;
    let currentJob: RenderJob = { ...params.job };

    if (this.activeJobIds.has(currentJob.id)) {
      return;
    }

    this.pausedJobIds.delete(currentJob.id);
    this.activeJobIds.add(currentJob.id);

    const checkPauseGate = (): boolean => {
      return this.pausedJobIds.has(currentJob.id);
    };

    const bumpRetry = async (attempt: number, reason: string) => {
      currentJob = {
        ...currentJob,
        retryCount: currentJob.retryCount + 1,
        currentStepLabel: `Auto-retrying (attempt ${attempt + 1}/3) — ${reason.slice(0, 90)}`,
        updatedAtMs: Date.now(),
      };
      await callbacks.onJobProgress(currentJob);
    };

    try {
      // Load or initialize crash-proof checkpoint
      let checkpoint: PipelineCheckpoint = (await getCheckpointFromVault(
        currentJob.checkpointKey
      )) || {
        jobId: currentJob.id,
        showId: show.id,
        scenes: {},
        completedStepIds: [],
        useFastStudioMotion,
      };

      const isStepDone = (stepId: string) => checkpoint.completedStepIds.includes(stepId);
      const markStepDone = async (stepId: string, stepLabel: string) => {
        if (!checkpoint.completedStepIds.includes(stepId)) {
          checkpoint.completedStepIds.push(stepId);
        }
        await saveCheckpointToVault(currentJob.checkpointKey, checkpoint);
        currentJob = {
          ...currentJob,
          status: 'running',
          completedSteps: Math.min(currentJob.totalSteps, checkpoint.completedStepIds.length),
          currentStepLabel: stepLabel,
          updatedAtMs: Date.now(),
        };
        await callbacks.onJobProgress(currentJob);
      };

      // Gather locked character reference images for visual consistency
      const lockedRefImages: Array<{ mimeType: string; data: string }> = [];
      for (const c of characters) {
        if (c.faceLocked && c.lockedFaceAssetId) {
          const stored = await getAssetFromVault(c.lockedFaceAssetId);
          if (typeof stored === 'string') {
            const parsed = extractBase64AndMime(stored);
            if (parsed) lockedRefImages.push(parsed);
          }
        }
      }

      // STEP 1: Screenplay & Multi-Language Scene Breakdown
      if (!checkpoint.plan || !isStepDone('plan_scenes')) {
        currentJob = {
          ...currentJob,
          status: 'running',
          currentStepLabel: 'Breaking story prompt into sequential scenes via Gemini...',
          updatedAtMs: Date.now(),
        };
        await callbacks.onJobProgress(currentJob);

        const plan = await withAutoRetry(
          () =>
            planStoryScenes({
              title: show.title,
              storyPrompt: show.storyPrompt,
              contentMode: show.contentMode,
              visualStyle: show.visualStyle,
              aspectRatio: show.aspectRatio,
              languages: show.languages,
              characters,
              targetSceneCount,
            }),
          3,
          bumpRetry
        );

        checkpoint.plan = plan;

        // Recompute exact total steps now that scene count is finalized
        const numScenes = plan.scenes.length;
        const perSceneSteps = 2 + show.languages.length; // keyframe + video + N language voiceovers
        const optionalSteps =
          1 + // thumbnail
          1 + // master BGM
          (show.includeIntro ? 1 : 0) +
          (show.includeTrailer ? 1 : 0) +
          (show.includeEndCredits ? 1 : 0) +
          1; // ZIP packaging
        currentJob = {
          ...currentJob,
          episodeTitle: plan.episodeTitle || currentJob.episodeTitle,
          sceneCount: numScenes,
          totalSteps: 1 + numScenes * perSceneSteps + optionalSteps,
        };

        await markStepDone('plan_scenes', `Planned ${numScenes} sequential scenes`);
      }

      if (checkPauseGate()) {
        currentJob = { ...currentJob, status: 'paused', currentStepLabel: 'Paused by user' };
        await callbacks.onJobProgress(currentJob);
        return;
      }

      const plan = checkpoint.plan!;

      // STEP 2: Cover Thumbnail (1280x720)
      if (!isStepDone('cover_thumbnail')) {
        const existingThumb = show.thumbnailAssetId
          ? await getAssetFromVault(show.thumbnailAssetId)
          : null;
        if (typeof existingThumb === 'string' && existingThumb.length > 0) {
          checkpoint.thumbnailDataUrl = existingThumb;
        } else {
          currentJob = {
            ...currentJob,
            currentStepLabel: 'Rendering 1280x720 cover thumbnail...',
          };
          await callbacks.onJobProgress(currentJob);

          const thumbRes = await withAutoRetry(
            () =>
              generateStudioImage({
                prompt: `High-impact cinematic cover thumbnail for "${show.title}": ${
                  plan.scenes[0]?.visualPrompt || show.logline
                }. Clean widescreen composition without text.`,
                aspectRatio: '16:9',
                referenceImages: lockedRefImages.slice(0, 2),
              }),
            3,
            bumpRetry
          );
          checkpoint.thumbnailDataUrl = thumbRes.dataUrl;
          const thumbKey = `job_thumb_${currentJob.id}`;
          await saveAssetToVault(thumbKey, thumbRes.dataUrl);
          currentJob = { ...currentJob, thumbnailAssetId: thumbKey };
        }
        await markStepDone('cover_thumbnail', 'Cover thumbnail verified');
      }

      if (checkPauseGate()) {
        currentJob = { ...currentJob, status: 'paused', currentStepLabel: 'Paused by user' };
        await callbacks.onJobProgress(currentJob);
        return;
      }

      // STEP 3: Mood-Matched Background Music (Lyria 30s Score)
      if (!isStepDone('master_bgm')) {
        currentJob = {
          ...currentJob,
          currentStepLabel: 'Composing mood-matched orchestral background score...',
        };
        await callbacks.onJobProgress(currentJob);

        const bgmRes = await withAutoRetry(
          () => composeSceneBackgroundMusic({ prompt: plan.bgmPrompt }),
          3,
          bumpRetry
        );
        checkpoint.masterBgmBase64 = bgmRes.base64Data;
        checkpoint.masterBgmMimeType = bgmRes.mimeType;
        await markStepDone('master_bgm', 'Background score composed');
      }

      // STEP 4: Optional intro_sequence.mp4
      if (show.includeIntro && !isStepDone('intro_sequence')) {
        if (checkPauseGate()) {
          currentJob = { ...currentJob, status: 'paused', currentStepLabel: 'Paused by user' };
          await callbacks.onJobProgress(currentJob);
          return;
        }
        currentJob = {
          ...currentJob,
          currentStepLabel: 'Producing intro_sequence.mp4 opening title...',
        };
        await callbacks.onJobProgress(currentJob);

        const introImg = await withAutoRetry(
          () =>
            generateStudioImage({
              prompt: plan.introPrompt,
              aspectRatio: show.aspectRatio,
              referenceImages: lockedRefImages.slice(0, 2),
            }),
          3,
          bumpRetry
        );

        const introClip = await renderKeyframeMotionClip({
          imageDataUrl: introImg.dataUrl,
          aspectRatio: show.aspectRatio,
          fps: show.fps,
          durationSeconds: 4,
          overlayTitle: show.title,
          overlaySubtitle: plan.episodeTitle,
        });

        checkpoint.introVideoBase64 = introClip.base64Data;
        checkpoint.introVideoMimeType = introClip.mimeType;
        await markStepDone('intro_sequence', 'Rendered intro_sequence.mp4');
      }

      // STEP 5: Optional trailer.mp4
      if (show.includeTrailer && !isStepDone('official_trailer')) {
        if (checkPauseGate()) {
          currentJob = { ...currentJob, status: 'paused', currentStepLabel: 'Paused by user' };
          await callbacks.onJobProgress(currentJob);
          return;
        }
        currentJob = {
          ...currentJob,
          currentStepLabel: 'Rendering official promo trailer.mp4...',
        };
        await callbacks.onJobProgress(currentJob);

        const trailerImg = await withAutoRetry(
          () =>
            generateStudioImage({
              prompt: plan.trailerPrompt,
              aspectRatio: show.aspectRatio,
              referenceImages: lockedRefImages.slice(0, 2),
            }),
          3,
          bumpRetry
        );

        if (checkpoint.useFastStudioMotion) {
          const clip = await renderKeyframeMotionClip({
            imageDataUrl: trailerImg.dataUrl,
            aspectRatio: show.aspectRatio,
            fps: show.fps,
            durationSeconds: 5,
            overlayTitle: `${show.title} — Official Teaser`,
          });
          checkpoint.trailerVideoBase64 = clip.base64Data;
          checkpoint.trailerVideoMimeType = clip.mimeType;
        } else {
          const veoRes = await withAutoRetry(
            () =>
              generateVeoMotionClip({
                prompt: plan.trailerPrompt,
                aspectRatio: show.aspectRatio,
                resolution: show.resolution,
                duration: '5s',
                startImageBase64: trailerImg.base64Data,
                startImageMimeType: trailerImg.mimeType,
              }),
            3,
            bumpRetry
          );
          checkpoint.trailerVideoBase64 = veoRes.base64Data;
          checkpoint.trailerVideoMimeType = veoRes.mimeType;
        }
        await markStepDone('official_trailer', 'Rendered trailer.mp4');
      }

      // STEP 6: Sequential Scenes (Keyframe -> Motion Video -> Multi-Language Voiceovers)
      for (let idx = 0; idx < plan.scenes.length; idx++) {
        const scene = plan.scenes[idx];
        const code = `scene_${String(idx + 1).padStart(2, '0')}`;
        if (!checkpoint.scenes[code]) {
          checkpoint.scenes[code] = {
            sceneCode: code,
            voiceByLang: {},
          };
        }
        const sceneState = checkpoint.scenes[code];

        if (checkPauseGate()) {
          currentJob = { ...currentJob, status: 'paused', currentStepLabel: 'Paused by user' };
          await callbacks.onJobProgress(currentJob);
          return;
        }

        // 6A. Scene Keyframe with Face-Locked References
        const kfStepId = `${code}_keyframe`;
        if (!isStepDone(kfStepId) || !sceneState.keyframeDataUrl) {
          currentJob = {
            ...currentJob,
            currentStepLabel: `[${code}] Generating face-locked scene frame...`,
          };
          await callbacks.onJobProgress(currentJob);

          const kfRes = await withAutoRetry(
            () =>
              generateStudioImage({
                prompt: scene.visualPrompt,
                aspectRatio: show.aspectRatio,
                highRes: show.resolution === '4K' || show.resolution === '8K',
                referenceImages: lockedRefImages,
              }),
            3,
            bumpRetry
          );
          sceneState.keyframeDataUrl = kfRes.dataUrl;
          await markStepDone(kfStepId, `[${code}] Keyframe locked`);
        }

        if (checkPauseGate()) {
          currentJob = { ...currentJob, status: 'paused', currentStepLabel: 'Paused by user' };
          await callbacks.onJobProgress(currentJob);
          return;
        }

        // 6B. Scene Motion Video Clip (Veo Omni Flash OR Studio Motion)
        const vidStepId = `${code}_video`;
        if (!isStepDone(vidStepId) || !sceneState.videoBase64) {
          currentJob = {
            ...currentJob,
            currentStepLabel: checkpoint.useFastStudioMotion
              ? `[${code}] Encoding ${show.fps} FPS cinema camera motion...`
              : `[${code}] Synthesizing Veo AI motion video clip...`,
          };
          await callbacks.onJobProgress(currentJob);

          if (checkpoint.useFastStudioMotion) {
            const motionClip = await renderKeyframeMotionClip({
              imageDataUrl: sceneState.keyframeDataUrl!,
              aspectRatio: show.aspectRatio,
              fps: show.fps,
              durationSeconds: 5,
            });
            sceneState.videoBase64 = motionClip.base64Data;
            sceneState.videoMimeType = motionClip.mimeType;
          } else {
            const parsedKf = extractBase64AndMime(sceneState.keyframeDataUrl!);
            const veoClip = await withAutoRetry(
              () =>
                generateVeoMotionClip({
                  prompt: `${scene.motionPrompt}. Maintain identical character faces and lighting.`,
                  aspectRatio: show.aspectRatio,
                  resolution: show.resolution,
                  duration: '5s',
                  startImageBase64: parsedKf?.data,
                  startImageMimeType: parsedKf?.mimeType || 'image/png',
                }),
              3,
              bumpRetry
            );
            sceneState.videoBase64 = veoClip.base64Data;
            sceneState.videoMimeType = veoClip.mimeType;
          }
          sceneState.bgmBase64 = checkpoint.masterBgmBase64;
          sceneState.bgmMimeType = checkpoint.masterBgmMimeType;
          await markStepDone(vidStepId, `[${code}] Video clip rendered`);
        }

        // 6C. Multi-Language Voiceovers
        for (const lang of show.languages) {
          if (checkPauseGate()) {
            currentJob = { ...currentJob, status: 'paused', currentStepLabel: 'Paused by user' };
            await callbacks.onJobProgress(currentJob);
            return;
          }

          const voiceStepId = `${code}_voice_${lang}`;
          if (!isStepDone(voiceStepId) || !sceneState.voiceByLang[lang]) {
            currentJob = {
              ...currentJob,
              currentStepLabel: `[${code}] Synthesizing ${lang} voiceover (${scene.speakerName})...`,
            };
            await callbacks.onJobProgress(currentJob);

            const matchedDialogue =
              scene.dialogues.find(
                (d) => d.language.toLowerCase() === lang.toLowerCase()
              )?.line ||
              scene.dialogues[0]?.line ||
              scene.heading;

            const voiceRes = await withAutoRetry(
              () =>
                synthesizeSceneVoiceover({
                  text: matchedDialogue,
                  language: lang as SupportedLanguage,
                  voicePersona: (scene.voicePersona || 'Kore') as VoicePersona,
                  style: `Expressive cinematic ${show.contentMode} delivery`,
                }),
              3,
              bumpRetry
            );

            sceneState.voiceByLang[lang] = {
              base64: voiceRes.base64Data,
              mimeType: voiceRes.mimeType,
            };
            await markStepDone(voiceStepId, `[${code}] ${lang} voiceover ready`);
          }
        }
      }

      // STEP 7: Optional Scrolling End Credits (end_credits.mp4)
      if (show.includeEndCredits && !isStepDone('end_credits')) {
        currentJob = {
          ...currentJob,
          currentStepLabel: 'Rendering scrolling end_credits.mp4...',
        };
        await callbacks.onJobProgress(currentJob);

        const creditsClip = await renderScrollingEndCreditsClip({
          showTitle: show.title,
          creditLines: plan.endCreditsRoll || [],
          aspectRatio: show.aspectRatio,
          fps: show.fps,
        });
        checkpoint.endCreditsVideoBase64 = creditsClip.base64Data;
        checkpoint.endCreditsVideoMimeType = creditsClip.mimeType;
        await markStepDone('end_credits', 'Rendered end_credits.mp4');
      }

      // STEP 8: Universal NLE ZIP Packaging
      currentJob = {
        ...currentJob,
        currentStepLabel: 'Packaging Universal NLE ZIP archive...',
      };
      await callbacks.onJobProgress(currentJob);

      const zipBlob = await buildUniversalProductionZip({
        show,
        characters,
        checkpoint,
      });

      const zipAssetId = `zip_bundle_${currentJob.id}`;
      await saveAssetToVault(zipAssetId, zipBlob);
      await markStepDone('zip_bundle', 'Universal ZIP package ready for download');

      currentJob = {
        ...currentJob,
        status: 'completed',
        zipAssetId,
        completedSteps: currentJob.totalSteps,
        currentStepLabel: 'Completed · Universal ZIP ready for Premiere, DaVinci & CapCut',
        updatedAtMs: Date.now(),
      };
      await callbacks.onJobCompleted(currentJob);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      currentJob = {
        ...currentJob,
        status: 'error',
        errorMessage: msg,
        currentStepLabel: `Paused on error (checkpoint saved): ${msg.slice(0, 110)}`,
        updatedAtMs: Date.now(),
      };
      await callbacks.onJobFailed(currentJob, msg);
    } finally {
      this.activeJobIds.delete(currentJob.id);
    }
  }
}

export const mediaPipeline = new UnstoppablePipelineEngine();
