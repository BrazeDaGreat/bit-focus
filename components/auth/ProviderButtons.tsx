/**
 * Provider Buttons - OAuth2 Sign-In Options
 *
 * The one place a person actually connects an account. Providers are read from
 * the backend rather than hardcoded, so the buttons always reflect what is
 * genuinely available — a provider that has not been configured never shows a
 * button that would fail.
 *
 * Auth is not the moment for invention: each provider keeps its own mark and
 * name so the row is scannable at a glance.
 *
 * @fileoverview Provider sign-in buttons with live availability.
 * @author BIT Focus Development Team
 * @since v0.19.0
 */

"use client";

import { useEffect, type JSX } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FaGoogle, FaDiscord, FaGithub, FaKey } from "react-icons/fa6";
import type { IconType } from "react-icons";

/** Provider marks, keyed by the slug PocketBase reports. */
const PROVIDER_ICONS: Record<string, IconType> = {
  google: FaGoogle,
  discord: FaDiscord,
  github: FaGithub,
};

/**
 * Provider Buttons
 *
 * @param props.onConnected - Called after a successful sign-in.
 * @param props.className - Extra classes for the button stack.
 */
export default function ProviderButtons({
  onConnected,
  className,
}: {
  onConnected?: () => void;
  className?: string;
}): JSX.Element {
  const {
    providers,
    loadProviders,
    loadingProviders,
    signIn,
    signingIn,
    pendingProvider,
    error,
  } = useAuth();

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handle = async (provider: string) => {
    const ok = await signIn(provider);
    if (ok) onConnected?.();
  };

  if (loadingProviders && providers.length === 0) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed bg-card/40 p-4 text-center",
          className,
        )}
      >
        <span className="grid place-items-center size-9 mx-auto rounded-lg bg-muted text-muted-foreground">
          <FaKey className="size-3.5" />
        </span>
        <p className="mt-3 text-sm font-medium">No sign-in options yet</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Sign-in providers have not been switched on for this server. BIT Focus
          keeps working on this device in the meantime.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {providers.map((provider) => {
        const Icon = PROVIDER_ICONS[provider.name] ?? FaKey;
        const busy = signingIn && pendingProvider === provider.name;
        return (
          <Button
            key={provider.name}
            type="button"
            variant="outline"
            disabled={signingIn}
            onClick={() => handle(provider.name)}
            className="h-11 justify-start gap-3 px-4 font-medium"
          >
            <Icon
              className={cn(
                "size-4 shrink-0",
                busy && "motion-safe:animate-pulse",
              )}
            />
            <span>
              {busy ? "Waiting for" : "Continue with"} {provider.displayName}
            </span>
          </Button>
        );
      })}

      {error && (
        <p className="text-xs text-destructive leading-relaxed pt-1">{error}</p>
      )}
    </div>
  );
}
