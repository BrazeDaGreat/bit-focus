/**
 * Account Avatar - Profile Picture With Fallback
 *
 * Shows the connected account's real profile picture, and falls back to the
 * generated mark the app has always used for local-only profiles. Provider
 * pictures are hosted elsewhere and can disappear or fail to load, so a broken
 * image quietly becomes the generated one rather than an empty circle.
 *
 * @fileoverview Single source of truth for rendering a user's avatar.
 * @author BIT Focus Development Team
 * @since v0.19.0
 */

"use client";

import { useEffect, useState, type JSX } from "react";
import { useAuth } from "@/hooks/useAuth";
import { resolveAvatarUrl } from "@/lib/pocketbase";
import { cn } from "@/lib/utils";

/**
 * Account Avatar
 *
 * @param props.seed - Local profile name, used to generate the stand-in mark.
 * @param props.className - Sizing and shape classes for the image.
 */
export default function AccountAvatar({
  seed,
  className,
}: {
  seed: string;
  className?: string;
}): JSX.Element {
  const { user } = useAuth();
  const preferred = resolveAvatarUrl(user, seed);
  const generated = resolveAvatarUrl(null, user?.name || seed);

  const [src, setSrc] = useState(preferred);

  // Follow the account: signing in or out swaps the picture immediately.
  useEffect(() => setSrc(preferred), [preferred]);

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      onError={() => {
        if (src !== generated) setSrc(generated);
      }}
      className={cn("rounded-full object-cover", className)}
    />
  );
}
