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
    setFailed(false);

    if (!assetIdOrUrl) {
      setResolvedSrc(null);
      return;
    }

    getImageUrlFromVault(assetIdOrUrl)
      .then((url) => {
        if (active) setResolvedSrc(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [assetIdOrUrl]);

  if (!resolvedSrc || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 text-zinc-400 p-4 text-center ${className}`}
      >
        <Clapperboard className="w-7 h-7 text-amber-500/80 mb-2 shrink-0" />
        {fallbackLabel && (
          <span className="text-xs font-medium text-zinc-300 line-clamp-2 max-w-[18ch]">
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
