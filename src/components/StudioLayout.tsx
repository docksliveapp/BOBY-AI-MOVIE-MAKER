import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Clapperboard,
  Cloud,
  CloudOff,
  Database,
  Download,
  FolderArchive,
  HardDrive,
  Home,
  Layers,
  ListVideo,
  LogOut,
  Moon,
  RefreshCw,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import type { NavigationTab, StudioNotification, UserSession } from '../types';
import type { SyncEngineState } from '../services/offlineSyncEngine';
import { clearCachedRenderBundles, getVaultStorageStats } from '../services/mediaVault';
import { OfflineIndicator, PWAInstallButton } from './PWAWidgets';
import { StudioModal } from './StudioModal';

interface StudioLayoutProps {
  user: UserSession;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  showsCount: number;
  pendingCount: number;
  readyCount: number;
  creditsBalance: number;
  syncState: SyncEngineState;
  pendingSyncCount: number;
  onSyncNow: () => Promise<void>;
  onExportStudioBackup: () => void;
  notifications: StudioNotification[];
  onMarkAllNotificationsRead: () => void;
  onClearNotifications: () => void;
  defaultFastMotion: boolean;
  onToggleDefaultFastMotion: (val: boolean) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const StudioLayout: React.FC<StudioLayoutProps> = ({
  user,
  theme,
  onToggleTheme,
  activeTab,
  onSelectTab,
  showsCount,
  pendingCount,
  readyCount,
  creditsBalance,
  syncState,
  pendingSyncCount,
  onSyncNow,
  onExportStudioBackup,
  notifications,
  onMarkAllNotificationsRead,
  onClearNotifications,
  defaultFastMotion,
  onToggleDefaultFastMotion,
  onLogout,
  children,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [vaultStats, setVaultStats] = useState<{
    usedMb: number;
    quotaMb: number;
    assetCount: number;
    checkpointCount: number;
  } | null>(null);
  const [cleaningCache, setCleaningCache] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  const notifWrapRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Dismiss notification drawer on outside click or Escape key
  useEffect(() => {
    if (!notifOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (notifWrapRef.current && !notifWrapRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [notifOpen]);

  // Load real IndexedDB storage telemetry whenever preferences modal opens
  useEffect(() => {
    if (!profileOpen) return;
    setCacheMessage(null);
    void getVaultStorageStats().then(setVaultStats);
  }, [profileOpen]);

  const handleClearRenderCache = async () => {
    setCleaningCache(true);
    setCacheMessage(null);
    try {
      const removed = await clearCachedRenderBundles();
      const updated = await getVaultStorageStats();
      setVaultStats(updated);
      setCacheMessage(
        removed > 0
          ? `Cleared ${removed} cached render archive${removed === 1 ? '' : 's'} & checkpoints. Show profiles and locked faces remain untouched.`
          : 'Render cache is already clean. Show profiles and locked faces remain intact.'
      );
    } finally {
      setCleaningCache(false);
    }
  };

  const navItems: Array<{
    id: NavigationTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'dashboard', label: 'Dashboard Home', shortLabel: 'Home', icon: Home },
    { id: 'shows', label: 'Shows Profiles', shortLabel: 'Shows', icon: Layers, count: showsCount },
    { id: 'studio', label: '3-Step Studio', shortLabel: 'Studio', icon: Sparkles },
    {
      id: 'queue',
      label: 'Pending Generations',
      shortLabel: 'Queue',
      icon: ListVideo,
      count: pendingCount,
    },
    {
      id: 'downloads',
      label: 'Ready Downloads',
      shortLabel: 'ZIPs',
      icon: FolderArchive,
      count: readyCount,
    },
  ];

  const syncSummaryText =
    user.isDemo || syncState === 'local_only'
      ? 'Offline Local Vault'
      : syncState === 'syncing'
        ? 'Syncing to Cloud...'
        : syncState === 'offline_pending'
          ? `${pendingSyncCount} Queued Offline`
          : 'Cloud + Offline Synced';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors duration-200">
      {/* Fixed Global Top Header (56px mobile / 64px desktop to stay under 15% mobile sticky cap) */}
      <header className="sticky top-0 z-30 h-14 sm:h-16 px-3.5 sm:px-6 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl flex items-center justify-between gap-3 sm:gap-6 pt-safe">
        {/* Left: Studio Clapperboard Logo + Title */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className="flex items-center gap-2.5 sm:gap-3 group shrink-0 cursor-pointer min-h-[44px]"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center transition-transform duration-150 group-hover:-rotate-6 shadow-sm">
            <Clapperboard className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="font-display text-sm sm:text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50 whitespace-nowrap">
            BOBY AI MOVIE MAKER
          </span>
        </button>

        {/* Right: Install PWA + Theme Switch + Notification Bell + Account Avatar */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <PWAInstallButton />

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Daylight theme' : 'Switch to Dark Studio theme'}
            title={theme === 'dark' ? 'Daylight Mode' : 'Obsidian Dark Mode'}
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notification Bell */}
          <div className="relative" ref={notifWrapRef}>
            <button
              type="button"
              onClick={() => {
                setNotifOpen((prev) => !prev);
                setProfileOpen(false);
              }}
              aria-label="Render Notifications"
              aria-expanded={notifOpen}
              className="relative min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold tabular-nums flex items-center justify-center shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="animate-modal-settle absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl p-4 z-50">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Studio Render Alerts
                  </span>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={onMarkAllNotificationsRead}
                        className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={onClearNotifications}
                        className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-zinc-200/80 dark:divide-zinc-800/70">
                  {notifications.length === 0 ? (
                    <p className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                      No render alerts yet. Completed episodes and sync updates appear here.
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          if (n.targetTab) onSelectTab(n.targetTab);
                          setNotifOpen(false);
                        }}
                        className={`w-full text-left py-3 px-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                          !n.read ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {n.title}
                          </span>
                          <span className="text-[11px] font-mono tabular-nums text-zinc-500 shrink-0">
                            {new Date(n.timestampMs).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          {n.detail}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Account Profile Avatar & Preferences Trigger */}
          <button
            type="button"
            onClick={() => {
              setProfileOpen(true);
              setNotifOpen(false);
            }}
            aria-label="Open Studio Preferences and Sync Tools"
            className="min-h-[42px] flex items-center gap-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-2.5 sm:px-3 py-1.5 transition-colors cursor-pointer"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-violet-500/15 border border-violet-500/40 text-violet-700 dark:text-violet-300 flex items-center justify-center">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
            <div className="hidden sm:flex flex-col items-start text-left">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-tight max-w-[120px] truncate">
                {user.displayName}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-amber-700 dark:text-amber-400 leading-tight">
                {creditsBalance.toLocaleString()} Credits
              </span>
            </div>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex min-h-0">
        {/* Desktop Left Sidebar Navigation (256px) */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/60 p-4">
          <nav className="space-y-1.5" aria-label="Studio navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-zinc-950 font-semibold shadow-sm'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-950 dark:hover:text-zinc-100'
                  }`}
                >
                  <span className="flex items-center gap-3 whitespace-nowrap">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {typeof item.count === 'number' && (
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isActive ? 'text-zinc-950/80 font-bold' : 'text-zinc-500'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quiet Offline Sync & Editor Export Summary */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-2.5">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
              Universal Editor Export
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Premiere Pro · DaVinci Resolve · CapCut · Filmora · InShot · Vegas Pro
            </p>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="w-full pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5 truncate">
                {syncState === 'offline_pending' ? (
                  <CloudOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : (
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <span className="truncate">{syncSummaryText}</span>
              </span>
              <Sliders className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </aside>

        {/* Scrollable Content Viewport */}
        <main className="flex-1 min-w-0 pb-20 lg:pb-12 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< lg, compact 56px height to keep total sticky chrome <= 15%) */}
      <nav
        aria-label="Mobile studio navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 dark:border-zinc-800/90 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-xl pb-safe"
      >
        <div className="grid grid-cols-5 h-14 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] whitespace-nowrap">{item.shortLabel}</span>
                {typeof item.count === 'number' && item.count > 0 && item.id !== 'shows' && (
                  <span className="absolute top-1 right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-zinc-950 text-[9px] font-bold tabular-nums flex items-center justify-center">
                    {item.count > 9 ? '9+' : item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Unified Account, Theme, Offline Database Sync & Storage Tools Modal */}
      <StudioModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Studio Preferences & Offline Sync Tools"
        subtitle="Manage account, theme, offline database sync, and device storage"
        icon={<Sliders className="w-5 h-5 text-amber-500" />}
        maxWidthClass="max-w-lg"
        footer={
          <div className="w-full flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setProfileOpen(false);
                onLogout();
              }}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>

            <button
              type="button"
              onClick={() => setProfileOpen(false)}
              className="min-h-[42px] rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-semibold text-zinc-950 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Account & Credits Summary */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-100 truncate">
                {user.displayName}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user.email}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {creditsBalance.toLocaleString()}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Studio Credits</div>
            </div>
          </div>

          {/* Appearance Theme Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Studio Theme
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Switch between Obsidian Cinema Dark and Daylight Light interface.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-950 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-amber-400" />
                  Obsidian Dark
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-600" />
                  Daylight Light
                </>
              )}
            </button>
          </div>

          {/* Fast Cinema Motion Mode Toggle */}
          <label className="flex items-start justify-between gap-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Fast Cinema Motion Mode (Default)
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                Encodes 24–60 FPS Ken-Burns motion clips directly from face-locked Imagen keyframes for rapid exports. Disable to request full Veo AI video synthesis per scene.
              </p>
            </div>
            <input
              type="checkbox"
              checked={defaultFastMotion}
              onChange={(e) => onToggleDefaultFastMotion(e.target.checked)}
              className="mt-1 w-4 h-4 accent-amber-500 rounded shrink-0 cursor-pointer"
            />
          </label>

          {/* Offline Database & Cloud Auto-Sync Panel */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Offline Database &amp; Cloud Sync
                </span>
              </div>
              <span className="text-xs font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                {syncSummaryText}
              </span>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Includes persistent IndexedDB offline storage for Web PWA, Play Store (Android), App Store (iOS), and Microsoft Store (Windows). Edits made offline automatically sync to Firebase when internet returns.
            </p>

            {!user.isDemo && (
              <button
                type="button"
                onClick={() => void onSyncNow()}
                disabled={syncState === 'syncing'}
                className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition-colors cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
                <span>{syncState === 'syncing' ? 'Syncing Now...' : 'Sync Offline Queue Now'}</span>
              </button>
            )}
          </div>

          {/* Local Device Vault Storage & Backup Tools */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Device Vault &amp; Studio Backup
                </span>
              </div>
              {vaultStats && (
                <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                  {vaultStats.usedMb} MB used · {vaultStats.assetCount} assets
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={onExportStudioBackup}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-500" />
                Export Profiles Backup (.json)
              </button>

              <button
                type="button"
                onClick={handleClearRenderCache}
                disabled={cleaningCache}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {cleaningCache ? 'Cleaning...' : 'Clear Cached Render Blobs'}
              </button>
            </div>

            {cacheMessage && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">{cacheMessage}</p>
            )}
          </div>
        </div>
      </StudioModal>

      <OfflineIndicator
        pendingSyncCount={pendingSyncCount}
        isSyncing={syncState === 'syncing'}
        onSyncNow={!user.isDemo ? () => void onSyncNow() : undefined}
      />
    </div>
  );
};
