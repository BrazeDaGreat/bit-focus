/**
 * YouTube Player Component - Embedded Background Music/Study Videos
 *
 * This component allows users to embed YouTube videos (like study with me,
 * lo-fi beats, background noise) directly in the focus page without needing
 * a separate browser tab.
 *
 * Features:
 * - Paste YouTube URL or video ID
 * - Persistent video storage across sessions
 * - Collapsible player UI
 * - Basic playback controls
 *
 * @fileoverview Embedded YouTube player for focus sessions
 * @author BIT Focus Development Team
 */

"use client";

import { useState, useEffect, useCallback, useRef, type JSX } from "react";
import YouTube, { type YouTubeProps, type YouTubePlayer as YTPlayer } from "react-youtube";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FaYoutube, FaPlay, FaPause, FaVolumeMute, FaVolumeUp, FaTimes } from "react-icons/fa";
import { FaChevronDown, FaChevronUp, FaXmark } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { SOUND_EVENTS } from "@/lib/sound";

/**
 * Storage key for persisting the video ID
 */
const STORAGE_KEY = "focus-youtube-video";

/**
 * Extracts YouTube video ID from various URL formats
 *
 * Supports:
 * - Standard URLs: https://www.youtube.com/watch?v=VIDEO_ID
 * - Short URLs: https://youtu.be/VIDEO_ID
 * - Embed URLs: https://www.youtube.com/embed/VIDEO_ID
 * - Direct video IDs
 *
 * @param {string} input - URL or video ID
 * @returns {string | null} Extracted video ID or null if invalid
 */
function extractVideoId(input: string): string | null {
  if (!input) return null;

  // Clean the input
  const trimmed = input.trim();

  // Check if it's already a video ID (11 characters, alphanumeric with - and _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Try to extract from URL
  try {
    const url = new URL(trimmed);

    // Standard youtube.com/watch?v= format
    if (url.hostname.includes("youtube.com")) {
      const videoId = url.searchParams.get("v");
      if (videoId) return videoId;

      // Embed format: youtube.com/embed/VIDEO_ID
      const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) return embedMatch[1];
    }

    // Short youtu.be format
    if (url.hostname === "youtu.be") {
      const videoId = url.pathname.slice(1);
      if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return videoId;
      }
    }
  } catch {
    // Not a valid URL, might be a partial ID
  }

  return null;
}

/**
 * YouTube Player Component
 *
 * Renders an embedded YouTube player with URL input and basic controls.
 *
 * @component
 * @returns {JSX.Element} YouTube player card interface
 */
export default function YouTubePlayer({
  onClose,
}: {
  /** Optional close handler; renders a dismiss control when provided. */
  onClose?: () => void;
} = {}): JSX.Element {
  const [videoUrl, setVideoUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [player, setPlayer] = useState<YTPlayer | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  // Track if video was playing before notification sound interrupted
  const wasPlayingBeforeSound = useRef(false);

  /**
   * Load saved video ID from localStorage on mount
   */
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setVideoId(saved);
      setVideoUrl(`https://youtu.be/${saved}`);
      setIsCollapsed(false);
    }
  }, []);

  /**
   * Listen for notification sound events to pause/resume playback
   * Pauses the video when Pomodoro sound starts, resumes when it ends
   */
  useEffect(() => {
    const handleSoundStart = () => {
      if (player && isPlaying) {
        wasPlayingBeforeSound.current = true;
        player.pauseVideo();
      }
    };

    const handleSoundEnd = () => {
      if (player && wasPlayingBeforeSound.current) {
        wasPlayingBeforeSound.current = false;
        player.playVideo();
      }
    };

    window.addEventListener(SOUND_EVENTS.START, handleSoundStart);
    window.addEventListener(SOUND_EVENTS.END, handleSoundEnd);

    return () => {
      window.removeEventListener(SOUND_EVENTS.START, handleSoundStart);
      window.removeEventListener(SOUND_EVENTS.END, handleSoundEnd);
    };
  }, [player, isPlaying]);

  /**
   * Handles URL submission and video loading
   */
  const handleLoadVideo = useCallback(() => {
    const id = extractVideoId(videoUrl);
    if (id) {
      setVideoId(id);
      localStorage.setItem(STORAGE_KEY, id);
      setIsCollapsed(false);
    }
  }, [videoUrl]);

  /**
   * Clears the current video
   */
  const handleClearVideo = useCallback(() => {
    setVideoId(null);
    setVideoUrl("");
    setIsPlaying(false);
    setPlayer(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /**
   * Handle player ready event
   */
  const onPlayerReady: YouTubeProps["onReady"] = (event) => {
    setPlayer(event.target);
    // Set a reasonable default volume
    event.target.setVolume(50);
  };

  /**
   * Toggle play/pause
   */
  const togglePlayPause = useCallback(() => {
    if (!player) return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
    setIsPlaying(!isPlaying);
  }, [player, isPlaying]);

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    if (!player) return;
    if (isMuted) {
      player.unMute();
    } else {
      player.mute();
    }
    setIsMuted(!isMuted);
  }, [player, isMuted]);

  /**
   * Handle player state changes
   */
  const onStateChange: YouTubeProps["onStateChange"] = (event) => {
    // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
    setIsPlaying(event.data === 1);
  };

  /**
   * YouTube player options
   */
  const opts: YouTubeProps["opts"] = {
    height: "144",
    width: "100%",
    playerVars: {
      autoplay: 0,
      modestbranding: 1,
      rel: 0,
    },
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-card p-2 shadow-xs">
      {videoId ? (
        <div
          className={cn(
            "flex items-center gap-3",
            isCollapsed ? "flex-row" : "flex-col sm:flex-row sm:items-start"
          )}
        >
          {/* The player itself. Kept small: this is background sound, not video. */}
          <div
            className={cn(
              "overflow-hidden rounded-xl bg-black/80 transition-all",
              isCollapsed ? "h-0 w-0 opacity-0" : "w-full sm:w-64"
            )}
          >
            <YouTube
              videoId={videoId}
              opts={opts}
              onReady={onPlayerReady}
              onStateChange={onStateChange}
              className="w-full"
            />
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <button
              onClick={togglePlayPause}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
              title={isPlaying ? "Pause music" : "Play music"}
              aria-label={isPlaying ? "Pause music" : "Play music"}
            >
              {isPlaying ? (
                <FaPause className="size-3" />
              ) : (
                <FaPlay className="size-3 translate-x-px" />
              )}
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
              <FaYoutube className="size-3.5 shrink-0 text-red-500" />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {isPlaying ? "Playing" : "Paused"} · {videoId}
              </span>
            </div>

            <BarIconButton
              onClick={toggleMute}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <FaVolumeMute className="size-3.5" />
              ) : (
                <FaVolumeUp className="size-3.5" />
              )}
            </BarIconButton>

            <BarIconButton
              onClick={() => setIsCollapsed((v) => !v)}
              title={isCollapsed ? "Show video" : "Hide video"}
            >
              {isCollapsed ? (
                <FaChevronDown className="size-3" />
              ) : (
                <FaChevronUp className="size-3" />
              )}
            </BarIconButton>

            <BarIconButton onClick={handleClearVideo} title="Remove this video">
              <FaTimes className="size-3" />
            </BarIconButton>

            {onClose && (
              <BarIconButton onClick={onClose} title="Close music">
                <FaXmark className="size-3.5" />
              </BarIconButton>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
            <FaYoutube className="size-3.5 text-red-500" />
          </span>
          <Input
            type="text"
            placeholder="Paste a YouTube link for background sound"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleLoadVideo();
              }
            }}
            className="h-9 flex-1 rounded-lg border-0 bg-muted/60 text-sm shadow-none focus-visible:bg-muted"
          />
          <Button
            size="sm"
            className="h-9 shrink-0 rounded-lg"
            onClick={handleLoadVideo}
            disabled={!videoUrl.trim()}
          >
            Load
          </Button>
          {onClose && (
            <BarIconButton onClick={onClose} title="Close music">
              <FaXmark className="size-3.5" />
            </BarIconButton>
          )}
        </div>
      )}
    </div>
  );
}

/** Quiet icon button used across the music bar. */
function BarIconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
