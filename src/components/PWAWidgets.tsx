import React, { useState } from 'react';
import { CloudUpload, Download, RefreshCw, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { StudioModal } from './StudioModal';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 sm:px-3.5 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Install Studio App</span>
        <span className="sm:hidden">Install</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Install iOS</span>
        </button>

        <StudioModal
          open={showGuide}
          onClose={() => setShowGuide(false)}
          title="Install on iPhone or iPad"
          subtitle="Full-screen standalone app with offline studio database"
          icon={<Smartphone className="w-5 h-5 text-amber-500" />}
          maxWidthClass="max-w-sm"
          footer={
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors cursor-pointer"
            >
              Got It
            </button>
          }
        >
          <ol className="space-y-2.5 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed list-decimal list-inside">
            <li>
              Tap the <strong className="text-zinc-950 dark:text-zinc-100">Share</strong> button in your Safari toolbar.
            </li>
            <li>
              Scroll down and tap{' '}
              <strong className="text-zinc-950 dark:text-zinc-100">Add to Home Screen</strong>.
            </li>
            <li>
              Launch <strong className="text-zinc-950 dark:text-zinc-100">BobyStudio</strong> directly from your home screen—your shows and checkpoints stay saved offline and auto-sync when online.
            </li>
          </ol>
        </StudioModal>
      </>
    );
  }

  return null;
};

interface OfflineIndicatorProps {
  pendingSyncCount?: number;
  isSyncing?: boolean;
  onSyncNow?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  pendingSyncCount = 0,
  isSyncing = false,
  onSyncNow,
}) => {
  const isOnline = useOnlineStatus();

  if (isOnline && !isSyncing && pendingSyncCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-[4.5rem] lg:bottom-5 left-4 z-40 flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3.5 py-2.5 text-xs font-medium text-amber-800 dark:text-amber-300 shadow-xl max-w-[calc(100vw-2rem)]">
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="truncate">
            Offline Mode · Saving locally
            {pendingSyncCount > 0 ? ` (${pendingSyncCount} queued for cloud sync)` : ''}
          </span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin shrink-0" />
          <span className="text-emerald-700 dark:text-emerald-300 truncate">
            Syncing offline changes to Firebase Cloud...
          </span>
        </>
      ) : (
        <>
          <CloudUpload className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="truncate">
            {pendingSyncCount} offline change{pendingSyncCount === 1 ? '' : 's'} ready to sync
          </span>
          {onSyncNow && (
            <button
              type="button"
              onClick={onSyncNow}
              className="ml-1 rounded-lg bg-amber-500 hover:bg-amber-400 px-2.5 py-1 text-[11px] font-semibold text-zinc-950 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sync Now
            </button>
          )}
        </>
      )}
    </div>
  );
};
