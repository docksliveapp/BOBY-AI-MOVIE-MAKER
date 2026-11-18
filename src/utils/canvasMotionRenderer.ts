import type { AspectRatioOption, FpsOption } from '../types';

function getDimensionsForAspect(ratio: AspectRatioOption): { width: number; height: number } {
  switch (ratio) {
    case '9:16':
      return { width: 720, height: 1280 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '2.39:1':
      return { width: 1280, height: 536 };
    case '16:9':
    default:
      return { width: 1280, height: 720 };
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode keyframe image for motion encoder.'));
    img.src = src;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      const idx = res.indexOf(',');
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function pickRecorderMimeType(): string {
  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  if (typeof MediaRecorder !== 'undefined') {
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c)) {
        return c;
      }
    }
  }
  return 'video/webm';
}

/**
 * Renders a smooth cinema Ken-Burns camera pan/zoom clip from a keyframe image
 * or title card, outputting real playable video bytes for NLE timelines.
 */
export async function renderKeyframeMotionClip(params: {
  imageDataUrl: string;
  aspectRatio: AspectRatioOption;
  fps: FpsOption;
  durationSeconds?: number;
  overlayTitle?: string;
  overlaySubtitle?: string;
}): Promise<{ base64Data: string; mimeType: string }> {
  const { width, height } = getDimensionsForAspect(params.aspectRatio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable.');
  }

  const img = await loadHtmlImage(params.imageDataUrl);
  const mimeType = pickRecorderMimeType();
  const fps = Math.min(params.fps || 24, 30);
  const durationMs = (params.durationSeconds || 4) * 1000;

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_500_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();
  const startTime = performance.now();

  await new Promise<void>((resolve) => {
    const drawFrame = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Smooth ease-in-out zoom 1.0 -> 1.10
      const scale = 1 + 0.1 * (0.5 - 0.5 * Math.cos(Math.PI * progress));

      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      const imgRatio = img.width / img.height;
      const canvasRatio = width / height;
      let drawW = width;
      let drawH = height;
      if (imgRatio > canvasRatio) {
        drawH = height * scale;
        drawW = drawH * imgRatio;
      } else {
        drawW = width * scale;
        drawH = drawW / imgRatio;
      }

      const dx = (width - drawW) / 2 - progress * (width * 0.02);
      const dy = (height - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);

      if (params.overlayTitle) {
        const grad = ctx.createLinearGradient(0, height * 0.55, 0, height);
        grad.addColorStop(0, 'rgba(9,9,11,0)');
        grad.addColorStop(1, 'rgba(9,9,11,0.88)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, height * 0.55, width, height * 0.45);

        ctx.fillStyle = '#fafafa';
        ctx.textAlign = 'center';
        ctx.font = `700 ${Math.round(width * 0.042)}px Outfit, sans-serif`;
        ctx.fillText(params.overlayTitle, width / 2, height * 0.82);

        if (params.overlaySubtitle) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = `500 ${Math.round(width * 0.02)}px "Plus Jakarta Sans", sans-serif`;
          ctx.fillText(params.overlaySubtitle, width / 2, height * 0.88);
        }
      }

      if (elapsed < durationMs) {
        requestAnimationFrame(drawFrame);
      } else {
        recorder.stop();
        resolve();
      }
    };
    requestAnimationFrame(drawFrame);
  });

  const videoBlob = await finished;
  const base64Data = await blobToBase64(videoBlob);
  return { base64Data, mimeType };
}

/**
 * Renders an authentic theatrical scrolling end_credits.mp4 roll.
 */
export async function renderScrollingEndCreditsClip(params: {
  showTitle: string;
  creditLines: string[];
  aspectRatio: AspectRatioOption;
  fps: FpsOption;
}): Promise<{ base64Data: string; mimeType: string }> {
  const { width, height } = getDimensionsForAspect(params.aspectRatio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable.');
  }

  const mimeType = pickRecorderMimeType();
  const fps = Math.min(params.fps || 24, 30);
  const durationMs = 4500;

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 3_500_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();
  const startTime = performance.now();
  const allLines = [
    params.showTitle.toUpperCase(),
    '',
    ...params.creditLines,
    '',
    'Produced with BOBY AI MOVIE MAKER Studio',
  ];

  await new Promise<void>((resolve) => {
    const drawFrame = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      const lineHeight = Math.max(28, Math.round(height * 0.055));
      const totalBlockH = allLines.length * lineHeight;
      const startY = height * 0.9 - progress * (height * 0.7 + totalBlockH * 0.65);

      ctx.textAlign = 'center';
      allLines.forEach((line, idx) => {
        const y = startY + idx * lineHeight;
        if (y < -40 || y > height + 40) return;
        if (idx === 0) {
          ctx.fillStyle = '#f59e0b';
          ctx.font = `700 ${Math.round(lineHeight * 0.82)}px Outfit, sans-serif`;
        } else {
          ctx.fillStyle = '#e4e4e7';
          ctx.font = `500 ${Math.round(lineHeight * 0.54)}px "Plus Jakarta Sans", sans-serif`;
        }
        ctx.fillText(line, width / 2, y);
      });

      if (elapsed < durationMs) {
        requestAnimationFrame(drawFrame);
      } else {
        recorder.stop();
        resolve();
      }
    };
    requestAnimationFrame(drawFrame);
  });

  const videoBlob = await finished;
  const base64Data = await blobToBase64(videoBlob);
  return { base64Data, mimeType };
}
