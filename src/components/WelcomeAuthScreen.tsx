import React, { useState } from 'react';
import { Clapperboard, Film, Play, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { ResilientImage } from './ResilientImage';
import { PWAInstallButton } from './PWAWidgets';

const HERO_STUDIO_IMAGE = '/src/assets/images/studio_hero_backdrop_1795041189982.jpg';

interface WelcomeAuthScreenProps {
  onGoogleLogin: () => Promise<void>;
  onDemoMode: () => void;
}

export const WelcomeAuthScreen: React.FC<WelcomeAuthScreenProps> = ({
  onGoogleLogin,
  onDemoMode,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleClick = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await onGoogleLogin();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(
        msg.includes('popup-closed-by-user')
          ? 'Google sign-in popup was closed. Try again or enter 1-Click Demo Mode below.'
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Clean 3-Zone Top Bar */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-zinc-950 shadow-sm">
            <Clapperboard className="w-5 h-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-zinc-100 whitespace-nowrap">
            BOBY AI MOVIE MAKER
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400">
          <a href="#workflow" className="hover:text-zinc-100 transition-colors whitespace-nowrap">
            3-Step Flow
          </a>
          <a href="#formats" className="hover:text-zinc-100 transition-colors whitespace-nowrap">
            Formats & 8K
          </a>
          <a href="#editors" className="hover:text-zinc-100 transition-colors whitespace-nowrap">
            Universal ZIP
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={onDemoMode}
            className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Instant Demo
          </button>
        </div>
      </header>

      {/* Main Split Studio Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 lg:py-14 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          {/* Left Sign-In & Studio Value Column */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="text-xs font-medium text-amber-400 tracking-wide">
              Prompt-Driven Cinema · Web Series · 3D Cartoons · Reels
            </div>

            <h1
              className="font-display text-3xl sm:text-5xl font-bold text-zinc-50 leading-[1.12]"
              style={{ textWrap: 'balance' }}
            >
              Turn Any Written or Spoken Story Into a Ready-to-Edit Movie Pack.
            </h1>

            <p className="text-base text-zinc-300 leading-relaxed max-w-xl">
              Generate viral titles, lock 100% consistent character faces across scenes, synthesize multi-language voiceovers in Urdu, English, Arabic, and Hindi, and export a numbered ZIP ready for Premiere Pro, DaVinci Resolve, CapCut, and Filmora.
            </p>

            {/* Auth Card */}
            <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/65 backdrop-blur-xl p-6 space-y-4 max-w-lg">
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={loading}
                className="w-full min-h-[48px] flex items-center justify-center gap-3 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 font-semibold text-sm px-5 py-3 transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span className="whitespace-nowrap">
                  {loading ? 'Connecting Google Account...' : 'Continue with Google'}
                </span>
              </button>

              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <div className="h-px flex-1 bg-zinc-800" />
                <span>or instant preview</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              <button
                type="button"
                onClick={onDemoMode}
                className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold text-sm px-5 py-2.5 transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span className="whitespace-nowrap">1-Click Demo Studio Bypass</span>
              </button>

              {errorMsg && (
                <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              <div className="pt-1 flex items-center gap-2 text-xs text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Cloud sync powered by Firebase · Works offline via PWA & IndexedDB checkpoints
                </span>
              </div>
            </div>
          </div>

          {/* Right Cinema Showcase Visual */}
          <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-zinc-800/80 min-h-[340px] lg:min-h-[480px]">
            <ResilientImage
              assetIdOrUrl={HERO_STUDIO_IMAGE}
              alt="BOBY AI MOVIE MAKER cinema production stage"
              className="w-full h-full object-cover"
              fallbackLabel="BOBY AI MOVIE MAKER Soundstage"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent flex flex-col justify-end p-6 sm:p-8">
              <div className="space-y-2">
                <div className="text-xs text-amber-300 font-medium">
                  Asaan 3-Step Automation · Premiere, DaVinci, CapCut & Filmora Ready
                </div>
                <p className="text-lg sm:text-xl font-display font-semibold text-white">
                  16:9 Cinema · 9:16 Reels · 24/30/60 FPS · Up to 8K Master Settings
                </p>
                <div className="text-xs text-zinc-300">
                  Web PWA · Google Play Store (Android) · Apple App Store (iOS) · Microsoft Store (Windows)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width 3-Step Capability Strip Below Hero */}
        <section
          id="workflow"
          className="mt-12 pt-8 border-t border-zinc-800/80 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
              <Wand2 className="w-4 h-4" />
              <span>01. Viral Title & 1280×720 Thumbnail</span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Type a 1-line idea and let Gemini craft high-CTR titles plus a widescreen YouTube or Social cover thumbnail automatically.
            </p>
          </div>

          <div className="space-y-2" id="formats">
            <div className="flex items-center gap-2 text-violet-400 text-sm font-semibold">
              <Sparkles className="w-4 h-4" />
              <span>02. Prompt-Driven Character Face Lock</span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Generate 4 distinct character portraits for heroes, parents, friends, or villains—then lock your favorite face for 100% scene identity.
            </p>
          </div>

          <div className="space-y-2" id="editors">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
              <Film className="w-4 h-4" />
              <span>03. Voice-Dictated Story to Universal ZIP</span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Speak or type your plot. Our fail-safe queue renders numbered scenes, multi-language voiceovers, BGM, intro, credits, and a clean ZIP archive.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};
