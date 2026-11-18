import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  Clapperboard,
  FolderArchive,
  Home,
  Layers,
  ListVideo,
  LogOut,
  Sliders,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import type { NavigationTab, StudioNotification, UserSession } from '../types';
import { OfflineIndicator, PWAInstallButton } from './PWAWidgets';

interface StudioLayoutProps {
  user: UserSession;
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  showsCount: number;
  pendingCount: number;
  readyCount: number;
  creditsBalance: number;
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
  activeTab,
  onSelectTab,
  showsCount,
  pendingCount,
  readyCount,
  creditsBalance,
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

  const unreadCount = notifications.filter((n) => !n.read).length;

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

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Fixed Global Top Header */}
      <header className="sticky top-0 z-30 h-16 px-4 sm:px-6 border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur-xl flex items-center justify-between gap-6 pt-safe">
        {/* Left: Animated Studio Clapperboard Logo + Title */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className="flex items-center gap-3 group shrink-0 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center transition-transform duration-150 group-hover:-rotate-6 shadow-sm">
            <Clapperboard className="w-5 h-5" />
          </div>
          <span className="font-display text-base sm:text-lg font-bold tracking-tight text-zinc-50 whitespace-nowrap">
            BOBY AI MOVIE MAKER
          </span>
        </button>

        {/* Right: Install PWA + Notification Bell + Account Avatar */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <PWAInstallButton />

          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((prev) => !prev);
                setProfileOpen(false);
              }}
              aria-label="Render Notifications"
              className="relative min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold tabular-nums flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-xl shadow-2xl p-4 z-50">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <span className="text-sm font-semibold text-zinc-100">
                    Studio Render Alerts
                  </span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={onMarkAllNotificationsRead}
                        className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={onClearNotifications}
                        className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/70">
                  {notifications.length === 0 ? (
                    <p className="py-8 text-center text-xs text-zinc-400">
                      No render alerts yet. Completed episodes and checkpoints appear here.
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
                        className="w-full text-left py-3 px-1 hover:bg-zinc-800/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-zinc-100 truncate">
                            {n.title}
                          </span>
                          <span className="text-[11px] font-mono tabular-nums text-zinc-500 shrink-0">
                            {new Date(n.timestampMs).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{n.detail}</p>
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
            className="min-h-[42px] flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 px-3 py-1.5 transition-colors cursor-pointer"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 flex items-center justify-center">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
            <div className="hidden sm:flex flex-col items-start text-left">
              <span className="text-xs font-semibold text-zinc-100 leading-tight max-w-[120px] truncate">
                {user.displayName}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-amber-400 leading-tight">
                {creditsBalance.toLocaleString()} Credits
              </span>
            </div>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex min-h-0">
        {/* Desktop Left Sidebar Navigation (260px) */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-zinc-800/80 bg-zinc-950/60 p-4">
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-zinc-950 font-semibold shadow-sm'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100'
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

          {/* Quiet Studio Packaging Readiness Summary */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 space-y-2">
            <div className="text-xs font-semibold text-zinc-200">
              Universal Editor Export
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Premiere Pro · DaVinci Resolve · CapCut · Filmora · InShot · Vegas Pro
            </p>
            <div className="pt-1 text-[11px] font-mono tabular-nums text-zinc-500">
              {user.isDemo ? 'Demo Vault Mode' : 'Firebase Cloud Synced'}
            </div>
          </div>
        </aside>

        {/* Scrollable Content Viewport */}
        <main className="flex-1 min-w-0 pb-24 lg:pb-12 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< lg) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-800/90 bg-[#09090b]/95 backdrop-blur-xl pb-safe">
        <div className="grid grid-cols-5 h-16 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isActive ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium whitespace-nowrap">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Account & Studio Preferences Modal */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-semibold text-zinc-100">
                  Studio Account & Engine Preferences
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-y border-zinc-800">
              <div>
                <div className="text-sm font-semibold text-zinc-100">{user.displayName}</div>
                <div className="text-xs text-zinc-400">{user.email}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono font-semibold tabular-nums text-amber-400">
                  {creditsBalance.toLocaleString()}
                </div>
                <div className="text-[11px] text-zinc-400">Studio Credits</div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    Fast Cinema Motion Mode (Default)
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Encodes 24–60 FPS Ken-Burns motion clips directly from face-locked Imagen keyframes for rapid multi-scene exports. Turn off to request full Veo AI video synthesis per scene.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={defaultFastMotion}
                  onChange={(e) => onToggleDefaultFastMotion(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-amber-500 rounded shrink-0"
                />
              </label>

              <div className="pt-2 text-xs text-zinc-400 space-y-1">
                <div>
                  Server AI Pipeline · Connected via server-side Gemini, Imagen, Veo, TTS & Lyria routes
                </div>
                <div>
                  Cross-Platform Targets · PWA Standalone · CapacitorJS (Android/iOS) · Electron (Windows)
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  onLogout();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>

              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-xs font-semibold text-zinc-950 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
};
