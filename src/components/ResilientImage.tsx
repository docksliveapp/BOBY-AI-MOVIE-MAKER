import React, { useEffect, useState } from 'react';
import { Clapperboard } from 'lucide-react';
import { getImageUrlFromVault } from '../services/mediaVault';

interface ResilientImageProps {
  assetIdOrUrl?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  assetIdOrUrl,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdObjectUrl: string | null = null;
    setFailed(false);

    if (!assetIdOrUrl) {
      setResolvedSrc(null);
      return;
    }

    getImageUrlFromVault(assetIdOrUrl)
      .then(({ url, isObjectUrl }) => {
        if (!active) {
          if (isObjectUrl && url) URL.revokeObjectURL(url);
          return;
        }
        if (isObjectUrl && url) {
          createdObjectUrl = url;
        }
        setResolvedSrc(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [assetIdOrUrl]);

  if (!resolvedSrc || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-zinc-100 via-zinc-200/80 to-zinc-100 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 text-zinc-500 dark:text-zinc-400 p-4 text-center ${className}`}
      >
        <Clapperboard className="w-7 h-7 text-amber-600 dark:text-amber-500/80 mb-2 shrink-0" />
        {fallbackLabel && (
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 line-clamp-2 max-w-[20ch]">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
