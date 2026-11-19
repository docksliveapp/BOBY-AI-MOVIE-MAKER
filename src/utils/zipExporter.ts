import JSZip from 'jszip';
import type {
  CharacterActor,
  PipelineCheckpoint,
  ShowProfile,
} from '../types';
import { getAssetFromVault, isSafeMediaUrl } from '../services/mediaVault';

function stripDataUrlPrefix(input: string): string {
  const commaIndex = input.indexOf(',');
  return commaIndex >= 0 ? input.slice(commaIndex + 1) : input;
}

function blobToBase64Str(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(stripDataUrlPrefix(String(reader.result || '')));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function resolveImageToBase64(urlOrAssetId: string): Promise<string> {
  if (!urlOrAssetId) return '';
  if (urlOrAssetId.startsWith('data:')) {
    return stripDataUrlPrefix(urlOrAssetId);
  }
  // Check IndexedDB MediaVault first for stored generated thumbnails
  if (!urlOrAssetId.startsWith('/') && !urlOrAssetId.startsWith('https://')) {
    const vaultVal = await getAssetFromVault(urlOrAssetId);
    if (!vaultVal) return '';
    if (typeof vaultVal === 'string') {
      return vaultVal.startsWith('data:') ? stripDataUrlPrefix(vaultVal) : '';
    }
    return blobToBase64Str(vaultVal);
  }

  if (!isSafeMediaUrl(urlOrAssetId)) return '';
  const resp = await fetch(urlOrAssetId);
  if (!resp.ok) return '';
  const blob = await resp.blob();
  return blobToBase64Str(blob);
}

function formatSrtTime(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  const ms = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )},${String(ms).padStart(3, '0')}`;
}

function buildSrtForLanguage(
  checkpoint: PipelineCheckpoint,
  language: string,
  hasIntro: boolean
): string {
  const scenes = checkpoint.plan?.scenes || [];
  let cursorSec = hasIntro ? 4 : 0;
  const blocks: string[] = [];

  scenes.forEach((sc, idx) => {
    const start = cursorSec;
    const end = cursorSec + 5;
    cursorSec = end;
    const line =
      sc.dialogues.find((d) => d.language.toLowerCase() === language.toLowerCase())?.line ||
      sc.dialogues[0]?.line ||
      sc.heading;

    blocks.push(
      `${idx + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${sc.speakerName}: ${line}\n`
    );
  });

  return blocks.join('\n');
}

function buildNleMarkersCsv(show: ShowProfile, checkpoint: PipelineCheckpoint): string {
  const rows: string[] = [
    'Marker Name,Description,In Time,Out Time,Track,File Reference',
  ];
  let cursor = 0;

  const esc = (s: string) => `"${String(s || '').replace(/"/g, '""')}"`;

  if (show.includeIntro && checkpoint.introVideoBase64) {
    rows.push(
      `${esc('Studio Intro')},${esc(show.title)},${formatSrtTime(cursor).replace(',', '.')},${formatSrtTime(cursor + 4).replace(',', '.')},V1,intro_sequence.mp4`
    );
    cursor += 4;
  }

  for (let idx = 0; idx < (checkpoint.plan?.scenes || []).length; idx++) {
    const sc = checkpoint.plan!.scenes[idx];
    const code = `scene_${String(idx + 1).padStart(2, '0')}`;
    rows.push(
      `${esc(sc.heading)},${esc(sc.motionPrompt)},${formatSrtTime(cursor).replace(',', '.')},${formatSrtTime(cursor + 5).replace(',', '.')},V1,video_clips/${code}.mp4`
    );
    cursor += 5;
  }

  if (show.includeEndCredits && checkpoint.endCreditsVideoBase64) {
    rows.push(
      `${esc('End Credits')},${esc('Scrolling Theatrical Credits')},${formatSrtTime(cursor).replace(',', '.')},${formatSrtTime(cursor + 4.5).replace(',', '.')},V1,end_credits.mp4`
    );
  }

  return rows.join('\n');
}

function buildProductionScriptTxt(
  show: ShowProfile,
  characters: CharacterActor[],
  checkpoint: PipelineCheckpoint
): string {
  const plan = checkpoint.plan;
  const lines: string[] = [];

  lines.push('====================================================================');
  lines.push('BOBY AI MOVIE MAKER — UNIVERSAL PRODUCTION PACKAGE');
  lines.push('====================================================================');
  lines.push(`Production Title : ${show.title}`);
  lines.push(`Episode Title    : ${plan?.episodeTitle || 'Episode 01'}`);
  lines.push(`Content Format   : ${show.contentMode}`);
  lines.push(`Visual Style     : ${show.visualStyle}`);
  lines.push(`Frame Specs      : ${show.aspectRatio} | ${show.fps} FPS | ${show.resolution}`);
  lines.push(`Audio Languages  : ${show.languages.join(', ')}`);
  lines.push('');
  lines.push('UNIVERSAL VIDEO EDITOR IMPORT GUIDE');
  lines.push('(Compatible with Premiere Pro, DaVinci Resolve, CapCut, Filmora, InShot, Vegas Pro)');
  lines.push('1. Create a new sequence matching the Frame Specs above.');
  lines.push('2. Place intro_sequence.mp4 first, then drag video_clips/scene_01.mp4..scene_NN.mp4 sequentially onto Video Track V1.');
  lines.push('3. Place end_credits.mp4 at the end of Video Track V1 (and trailer.mp4 for social promotion).');
  lines.push('4. Drag your preferred language voiceover folder (e.g., audio_urdu/ or audio_english/) onto Dialogue Track A1.');
  lines.push('5. Drag background_music/scene_01_bgm.mp3.. onto Music Track A2 at -16 dB.');
  lines.push('6. Drop subtitles_<lang>/episode_<lang>.srt directly onto your Captions Track for instant multi-language subtitles.');
  lines.push('');

  lines.push('--------------------------------------------------------------------');
  lines.push('LOCKED CHARACTER & ACTOR ROSTER');
  lines.push('--------------------------------------------------------------------');
  if (characters.length === 0) {
    lines.push('Auto-cast ensemble generated directly from screenplay.');
  } else {
    characters.forEach((c, i) => {
      lines.push(
        `${String(i + 1).padStart(2, '0')}. ${c.name} (${c.age} · ${c.relation}) [Voice: ${c.voicePersona}] ${
          c.faceLocked ? '[FACE LOCKED]' : '[UNLOCKED]'
        }`
      );
      lines.push(`    Visual Prompt: ${c.visualPrompt}`);
    });
  }
  lines.push('');

  lines.push('--------------------------------------------------------------------');
  lines.push('SEQUENTIAL SCENE BREAKDOWN & MULTI-LANGUAGE SCRIPT');
  lines.push('--------------------------------------------------------------------');
  for (const scene of plan?.scenes || []) {
    lines.push(`[${scene.sceneCode.toUpperCase()}] ${scene.heading}`);
    lines.push(`Speaker    : ${scene.speakerName} (${scene.voicePersona})`);
    lines.push(`Visual     : ${scene.visualPrompt}`);
    lines.push(`Camera/Act : ${scene.motionPrompt}`);
    lines.push(`BGM Mood   : ${scene.bgmMood}`);
    for (const dlg of scene.dialogues || []) {
      lines.push(`  • ${dlg.language}: "${dlg.line}"`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Compiles the Universal NLE-Ready ZIP archive with strictly numbered folders & files:
 * - thumbnail.jpg
 * - intro_sequence.mp4
 * - trailer.mp4
 * - video_clips/scene_01.mp4, scene_02.mp4...
 * - end_credits.mp4
 * - audio_<lang>/scene_01_<lang>.mp3...
 * - subtitles_<lang>/episode_<lang>.srt
 * - background_music/scene_01_bgm.mp3...
 * - edl_timeline_markers.csv
 * - production_script.txt
 */
export async function buildUniversalProductionZip(params: {
  show: ShowProfile;
  characters: CharacterActor[];
  checkpoint: PipelineCheckpoint;
}): Promise<Blob> {
  const { show, characters, checkpoint } = params;
  const zip = new JSZip();

  // 1. Cover Thumbnail (thumbnail.jpg)
  const thumbSrc = checkpoint.thumbnailDataUrl || show.thumbnailAssetId;
  if (thumbSrc) {
    try {
      const thumbB64 = await resolveImageToBase64(thumbSrc);
      if (thumbB64) {
        zip.file('thumbnail.jpg', thumbB64, { base64: true });
      }
    } catch {
      // Skip if unreachable
    }
  }

  // 2. Optional Intro Sequence (intro_sequence.mp4)
  if (show.includeIntro && checkpoint.introVideoBase64) {
    zip.file('intro_sequence.mp4', checkpoint.introVideoBase64, { base64: true });
  }

  // 3. Optional Official Promo Trailer (trailer.mp4)
  if (show.includeTrailer && checkpoint.trailerVideoBase64) {
    zip.file('trailer.mp4', checkpoint.trailerVideoBase64, { base64: true });
  }

  // 4. Sequential Scene Video Clips, Multi-Language Voiceovers, and Scene BGM
  const videoFolder = zip.folder('video_clips');
  const bgmFolder = zip.folder('background_music');

  const plannedScenes = checkpoint.plan?.scenes || [];
  for (let idx = 0; idx < plannedScenes.length; idx++) {
    const scene = plannedScenes[idx];
    const code = `scene_${String(idx + 1).padStart(2, '0')}`;
    const rendered = checkpoint.scenes[scene.sceneCode] || checkpoint.scenes[code];

    if (rendered?.videoBase64 && videoFolder) {
      videoFolder.file(`${code}.mp4`, rendered.videoBase64, { base64: true });
    }

    // Multi-language voiceover folders: audio_urdu/scene_01_urdu.mp3, audio_english/scene_01_english.mp3...
    for (const lang of show.languages) {
      const langSlug = lang.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const voiceEntry = rendered?.voiceByLang?.[lang];
      if (voiceEntry?.base64) {
        const langFolder = zip.folder(`audio_${langSlug}`);
        langFolder?.file(`${code}_${langSlug}.mp3`, voiceEntry.base64, { base64: true });
      }
    }

    // Mood-matched background music per scene
    const bgmBytes = rendered?.bgmBase64 || checkpoint.masterBgmBase64;
    if (bgmBytes && bgmFolder) {
      bgmFolder.file(`${code}_bgm.mp3`, bgmBytes, { base64: true });
    }
  }

  // 5. Multi-Language Synchronized Subtitles (.srt) for Premiere Pro, CapCut, DaVinci & Filmora
  if (plannedScenes.length > 0) {
    for (const lang of show.languages) {
      const langSlug = lang.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const srtContent = buildSrtForLanguage(
        checkpoint,
        lang,
        Boolean(show.includeIntro && checkpoint.introVideoBase64)
      );
      if (srtContent.trim()) {
        const subFolder = zip.folder(`subtitles_${langSlug}`);
        subFolder?.file(`episode_${langSlug}.srt`, srtContent);
      }
    }
  }

  // 6. Optional Scrolling End Credits (end_credits.mp4)
  if (show.includeEndCredits && checkpoint.endCreditsVideoBase64) {
    zip.file('end_credits.mp4', checkpoint.endCreditsVideoBase64, { base64: true });
  }

  // 7. NLE Timeline Markers CSV & Full Production Script
  zip.file('edl_timeline_markers.csv', buildNleMarkersCsv(show, checkpoint));
  zip.file('production_script.txt', buildProductionScriptTxt(show, characters, checkpoint));

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export function triggerZipDownload(blob: Blob, showTitle: string, episodeTitle?: string): void {
  const safeBase = `${showTitle}_${episodeTitle || 'Master_Pack'}`
    .replace(/[^a-zA-Z0-9_\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeBase}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
