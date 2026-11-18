import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please verify your API key in the AI Studio Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || raw.includes('403')) {
    return {
      status: 403,
      message:
        'Gemini API permission denied or invalid key. Please check your selected API key in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message:
        'API quota reached (429). Upgrading to a billing-enabled key in Settings > Secrets increases production render quota.',
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 404,
      message: `Requested AI model endpoint was not found: ${raw}`,
    };
  }
  return {
    status: 500,
    message: raw || 'Unexpected server error during AI generation.',
  };
}

function normalizeImageAspectRatio(ratio?: string): '1:1' | '3:4' | '4:3' | '9:16' | '16:9' {
  if (ratio === '1:1' || ratio === '3:4' || ratio === '4:3' || ratio === '9:16' || ratio === '16:9') {
    return ratio;
  }
  // 2.39:1 anamorphic widescreen uses 16:9 container with cinematic framing prompt
  return '16:9';
}

const VALID_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] as const;
type ValidVoice = (typeof VALID_VOICES)[number];

function sanitizeVoiceName(v?: string): ValidVoice {
  if (v && (VALID_VOICES as readonly string[]).includes(v)) {
    return v as ValidVoice;
  }
  return 'Kore';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ),
      elevenlabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
    });
  });

  // 1. Prompt Section 1: Suggest Viral Titles & Thumbnail Prompts
  app.post('/api/ai/suggest-titles', async (req: Request, res: Response) => {
    try {
      const ai = getAiClient();
      const {
        ideaPrompt = '',
        contentMode = 'cartoon_3d',
        visualStyle = 'pixar_3d',
        languages = ['Urdu', 'English'],
      } = req.body || {};

      const promptText = `You are a viral film producer and showrunner.
Content Mode: ${contentMode}
Visual Style: ${visualStyle}
Target Languages: ${Array.isArray(languages) ? languages.join(', ') : 'English'}
User Concept / Rough Idea: ${ideaPrompt.trim() || 'An inspiring emotional adventure with unforgettable characters and high audience retention.'}

Generate 4 distinct, catchy, high-CTR titles suitable for YouTube, Web Series, Cinema, or Reels. For each title, include a 1-sentence emotional logline, a short platform audience hook, and a rich visual prompt for a 1280x720 cover thumbnail without embedded text.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Catchy production or series title.' },
                logline: { type: Type.STRING, description: 'Compelling 1-sentence story hook.' },
                platformHook: { type: Type.STRING, description: 'Target audience appeal.' },
                thumbnailPrompt: {
                  type: Type.STRING,
                  description: 'Detailed visual scene description for 16:9 cover thumbnail.',
                },
              },
              required: ['title', 'logline', 'platformHook', 'thumbnailPrompt'],
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '[]').trim());
      res.json({ suggestions: parsed });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2. Universal Image Generator (Cover Thumbnail 1280x720 & Scene Keyframes with Face Lock)
  app.post('/api/ai/generate-image', async (req: Request, res: Response) => {
    try {
      const ai = getAiClient();
      const {
        prompt,
        aspectRatio = '16:9',
        highRes = false,
        referenceImages = [],
      } = req.body || {};

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Image prompt is required.' });
        return;
      }

      const mappedRatio = normalizeImageAspectRatio(aspectRatio);
      const anamorphicPrefix =
        aspectRatio === '2.39:1'
          ? 'Anamorphic 2.39:1 widescreen cinema framing, subtle horizontal film composition: '
          : '';

      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (Array.isArray(referenceImages)) {
        for (const ref of referenceImages.slice(0, 4)) {
          if (ref?.data && ref?.mimeType) {
            parts.push({
              inlineData: {
                mimeType: String(ref.mimeType),
                data: String(ref.data),
              },
            });
          }
        }
      }

      parts.push({
        text: `${anamorphicPrefix}${prompt}`,
      });

      const modelName = highRes ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: mappedRatio,
            ...(highRes ? { imageSize: '1K' } : {}),
          },
        },
      });

      let base64Data = '';
      let mimeType = 'image/png';
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          base64Data = part.inlineData.data;
          mimeType = part.inlineData.mimeType ?? 'image/png';
          break;
        }
      }

      if (!base64Data) {
        throw new Error('Image model returned no image data for this prompt.');
      }

      res.json({
        mimeType,
        base64Data,
        dataUrl: `data:${mimeType};base64,${base64Data}`,
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. Prompt Section 2: Generate 4 Distinct Character Face Options for Face-Lock
  app.post('/api/ai/generate-faces', async (req: Request, res: Response) => {
    try {
      const ai = getAiClient();
      const {
        name = 'Character',
        age = '25',
        relation = 'Lead',
        visualPrompt = '',
        visualStyle = 'pixar_3d',
      } = req.body || {};

      if (!visualPrompt || typeof visualPrompt !== 'string') {
        res.status(400).json({ error: 'Character visual prompt is required.' });
        return;
      }

      const styleMap: Record<string, string> = {
        pixar_3d: '3D Pixar animated feature film character design, tactile skin & fabric shading, expressive eyes',
        hollywood_live: 'Photorealistic Hollywood cinema portrait, Arri Alexa 35mm lens, natural skin texture',
        anime: 'High-detail theatrical anime character portrait, Makoto Shinkai studio lighting, crisp linework',
        hyper_drama: 'Hyper-realistic dramatic television portrait, shallow depth of field, warm key light',
        film_noir: 'Classic high-contrast monochrome & amber film noir character portrait, dramatic rim shadow',
        cyberpunk_neon: 'Futuristic cinematic character portrait, subtle neon rim reflection, moody obsidian studio',
      };

      const styleDescriptor = styleMap[visualStyle] || styleMap.pixar_3d;
      const variations = [
        {
          id: 'opt_1',
          label: 'Option A · Warm Heroic',
          lighting: 'warm golden key light, confident welcoming expression, front-facing 3/4 studio portrait',
        },
        {
          id: 'opt_2',
          label: 'Option B · Expressive Cinematic',
          lighting: 'soft balanced three-point studio lighting, vivid emotional eyes, clean neutral dark backdrop',
        },
        {
          id: 'opt_3',
          label: 'Option C · Crisp Editorial',
          lighting: 'subtle cool rim light with warm fill, poised natural expression, sharp facial bone structure',
        },
        {
          id: 'opt_4',
          label: 'Option D · Dramatic Rim',
          lighting: 'cinematic amber backlight, charismatic distinct facial features, head-and-shoulders framing',
        },
      ];

      const faces = await Promise.all(
        variations.map(async (variant) => {
          const fullSignature = `${styleDescriptor}. Character ${name} (${age}, ${relation}): ${visualPrompt}. ${variant.lighting}. Consistent canonical face reference sheet portrait, no text.`;
          const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-image',
            contents: { parts: [{ text: fullSignature }] },
            config: {
              imageConfig: { aspectRatio: '1:1' },
            },
          });

          let base64Data = '';
          let mimeType = 'image/png';
          for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.inlineData?.data) {
              base64Data = part.inlineData.data;
              mimeType = part.inlineData.mimeType ?? 'image/png';
              break;
            }
          }

          if (!base64Data) {
            throw new Error(`Could not render character face ${variant.label}.`);
          }

          return {
            id: variant.id,
            label: variant.label,
            signaturePrompt: fullSignature,
            dataUrl: `data:${mimeType};base64,${base64Data}`,
          };
        })
      );

      res.json({ faces });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4. Prompt Section 3: Story -> Sequential Multi-Scene Screenplay & Production Plan
  app.post('/api/ai/plan-scenes', async (req: Request, res: Response) => {
    try {
      const ai = getAiClient();
      const {
        title = 'Untitled Production',
        storyPrompt = '',
        contentMode = 'cartoon_3d',
        visualStyle = 'pixar_3d',
        aspectRatio = '16:9',
        languages = ['Urdu', 'English'],
        characters = [],
        targetSceneCount = 4,
      } = req.body || {};

      if (!storyPrompt || typeof storyPrompt !== 'string') {
        res.status(400).json({ error: 'Story or script prompt is required.' });
        return;
      }

      const clampedCount = Math.max(2, Math.min(8, Number(targetSceneCount) || 4));
      const langList: string[] =
        Array.isArray(languages) && languages.length > 0 ? languages : ['English'];

      const castRosterText =
        Array.isArray(characters) && characters.length > 0
          ? characters
              .map(
                (c: Record<string, unknown>, idx: number) =>
                  `${idx + 1}. ${c.name} (Age: ${c.age}, Role: ${c.relation}, Voice: ${c.voicePersona || 'Kore'}) — Locked Face Descriptor: ${c.lockedFaceSignature || c.visualPrompt}`
              )
              .join('\n')
          : 'Create consistent lead characters matching the story.';

      const prompt = `You are an elite film director and screenplay architect for "${title}".
Content Format: ${contentMode}
Visual Filter Style: ${visualStyle}
Frame Aspect Ratio: ${aspectRatio}
Required Voiceover Languages (MUST provide localized spoken line for EVERY language listed): ${langList.join(', ')}

LOCKED CHARACTER ROSTER (embed exact physical descriptors in every visualPrompt and motionPrompt where that character appears so their face remains 100% identical):
${castRosterText}

STORY / SCRIPT / LYRICS PROMPT:
${storyPrompt}

Break this story into exactly ${clampedCount} sequential numbered scenes (scene_01, scene_02, ...).
For each scene, provide:
- sceneNumber (1..${clampedCount})
- sceneCode ("scene_01", "scene_02", ...)
- heading (concise scene title)
- visualPrompt (complete visual keyframe prompt incorporating the visual style + exact locked character facial descriptors, no text overlays)
- motionPrompt (5-10s camera movement + subtle natural character action for video synthesis)
- bgmMood (musical mood description for this scene)
- speakerName (character speaking or "Narrator")
- voicePersona (one of: "Puck", "Charon", "Kore", "Fenrir", "Zephyr")
- dialogues: array with one entry per language in [${langList.join(', ')}] containing natural, idiomatic spoken script/narration in that language.

Also provide:
- episodeTitle
- introPrompt (visual prompt for the studio & character intro sequence)
- trailerPrompt (high-impact 1-minute official promo teaser visual & motion prompt)
- endCreditsRoll (array of 6-10 clean production credit lines including cast names)
- bgmPrompt (30-second instrumental background score prompt matching the overall story mood).`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              episodeTitle: { type: Type.STRING },
              introPrompt: { type: Type.STRING },
              trailerPrompt: { type: Type.STRING },
              endCreditsRoll: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              bgmPrompt: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.INTEGER },
                    sceneCode: { type: Type.STRING },
                    heading: { type: Type.STRING },
                    visualPrompt: { type: Type.STRING },
                    motionPrompt: { type: Type.STRING },
                    bgmMood: { type: Type.STRING },
                    speakerName: { type: Type.STRING },
                    voicePersona: { type: Type.STRING },
                    dialogues: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          language: { type: Type.STRING },
                          line: { type: Type.STRING },
                        },
                        required: ['language', 'line'],
                      },
                    },
                  },
                  required: [
                    'sceneNumber',
                    'sceneCode',
                    'heading',
                    'visualPrompt',
                    'motionPrompt',
                    'bgmMood',
                    'speakerName',
                    'voicePersona',
                    'dialogues',
                  ],
                },
              },
            },
            required: [
              'episodeTitle',
              'introPrompt',
              'trailerPrompt',
              'endCreditsRoll',
              'bgmPrompt',
              'scenes',
            ],
          },
        },
      });

      const plan = JSON.parse((response.text ?? '{}').trim());
      res.json({ plan });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 5. Veo / Omni Flash Motion Video Clip Synthesis (via Interactions API)
  app.post('/api/ai/generate-video', async (req: Request, res: Response) => {
    try {
      const ai = getAiClient();
      const {
        prompt,
        aspectRatio = '16:9',
        resolution = '720p',
        duration = '5s',
        startImageBase64,
        startImageMimeType = 'image/png',
      } = req.body || {};

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Video motion prompt is required.' });
        return;
      }

      const videoAspect: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
      const videoRes: '720p' | '1080p' | '4k' =
        resolution === '4K' || resolution === '8K'
          ? '4k'
          : resolution === '1080p'
            ? '1080p'
            : '720p';

      const inputPayload = startImageBase64
        ? [
            {
              type: 'image' as const,
              mime_type: String(startImageMimeType),
              data: String(startImageBase64),
            },
            {
              type: 'text' as const,
              text: prompt,
            },
          ]
        : prompt;

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: inputPayload,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: videoAspect,
            duration: String(duration),
            resolution: videoRes,
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (videoPart?.data) {
        res.json({
          mimeType: videoPart.mime_type || 'video/mp4',
          base64Data: videoPart.data,
        });
        return;
      }

      if (videoPart?.uri) {
        const videoResp = await fetch(videoPart.uri, {
          headers: {
            'x-goog-api-key': process.env.GEMINI_API_KEY || '',
          },
        });
        if (!videoResp.ok) {
          throw new Error(`Failed to fetch generated video URI (${videoResp.status}).`);
        }
        const arrBuf = await videoResp.arrayBuffer();
        res.json({
          mimeType: videoPart.mime_type || 'video/mp4',
          base64Data: Buffer.from(arrBuf).toString('base64'),
        });
        return;
      }

      throw new Error('Video model completed without returning video bytes.');
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 6. Multi-Language Voiceover Synthesis (ElevenLabs Multilingual v2 if configured -> Gemini 3.8 TTS)
  app.post('/api/ai/generate-voice', async (req: Request, res: Response) => {
    try {
      const {
        text,
        language = 'English',
        voicePersona = 'Kore',
        style = 'Expressive cinematic narration',
      } = req.body || {};

      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Dialogue text is required for voice synthesis.' });
        return;
      }

      const elevenKey = process.env.ELEVENLABS_API_KEY?.trim();
      if (elevenKey) {
        const voiceIdMap: Record<string, string> = {
          Puck: 'pNInz6obpgDQGcFmaJgB',
          Charon: 'VR6AewLTigWG4xSOukaG',
          Kore: 'EXAVITQu4vr4xnSDxMaL',
          Fenrir: 'TxGEqnHWrfWFTfGW9XjX',
          Zephyr: '21m00Tcm4TlvDq8ikWAM',
        };
        const chosenVoiceId = voiceIdMap[voicePersona] || voiceIdMap.Kore;
        const elResp = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${chosenVoiceId}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': elevenKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
              text,
              model_id: 'eleven_multilingual_v2',
            }),
          }
        );

        if (elResp.ok) {
          const audioBuf = Buffer.from(await elResp.arrayBuffer());
          res.json({
            mimeType: 'audio/mpeg',
            extension: 'mp3',
            base64Data: audioBuf.toString('base64'),
          });
          return;
        }
      }

      const ai = getAiClient();
      const persona = sanitizeVoiceName(voicePersona);
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: `${style} in natural ${language}`,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: persona,
              },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error(`No speech audio returned for ${language} dialogue.`);
      }

      res.json({
        mimeType: 'audio/wav',
        extension: 'wav',
        base64Data: base64Audio,
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 7. Mood-Matched Background Music Composition via Lyria Clip (30s)
  app.post('/api/ai/generate-music', async (req: Request, res: Response) => {
    try {
      const ai = getAiClient();
      const { prompt = 'Cinematic emotional instrumental film score, warm strings and piano, 30 seconds.' } =
        req.body || {};

      const response = await ai.models.generateContentStream({
        model: 'lyria-3-clip-preview',
        contents: `Generate a 30-second instrumental cinematic background score (no vocals): ${prompt}`,
      });

      const audioChunks: Buffer[] = [];
      let mimeType = 'audio/mpeg';
      let lyrics = '';

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (audioChunks.length === 0 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
          }
          if (part.text) {
            lyrics += part.text;
          }
        }
      }

      if (audioChunks.length === 0) {
        throw new Error('Music composition stream returned no audio bytes.');
      }

      res.json({
        mimeType,
        base64Data: Buffer.concat(audioChunks).toString('base64'),
        lyrics,
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const httpServer = http.createServer(app);

  // Vite Dev Middleware or Production Static Bundle
  if (process.env.NODE_ENV !== 'production') {
    if (process.env.DISABLE_HMR === undefined) {
      process.env.DISABLE_HMR = 'true';
    }
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: hmrDisabled ? false : undefined,
        hmr: hmrDisabled ? false : { server: httpServer },
        watch: hmrDisabled ? null : {},
      },
      appType: 'spa',
    });

    // When HMR is disabled in middlewareMode, Vite 8's built-in /@vite/client still
    // attempts to connect a WebSocket to port 24678. Serve a clean CSS-capable shim
    // with the exact same exports and zero WebSocket connections.
    if (hmrDisabled) {
      app.get('/@vite/client', (_req: Request, res: Response) => {
        res.type('application/javascript').send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) {
  return url;
}
export class ErrorOverlay extends HTMLElement {}
`);
      });
    }

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Production build not found. Run npm run build first.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`BOBY AI MOVIE MAKER studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
