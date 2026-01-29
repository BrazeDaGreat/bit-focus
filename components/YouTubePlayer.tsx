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
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FaYoutube, FaPlay, FaPause, FaVolumeMute, FaVolumeUp, FaTimes } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
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
export default function YouTubePlayer(): JSX.Element {
  const [videoUrl, setVideoUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [player, setPlayer] = useState<YTPlayer | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const isMobile = useIsMobile();
  
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
    height: "180",
    width: "100%",
    playerVars: {
      autoplay: 0,
      modestbranding: 1,
      rel: 0,
    },
  };

  return (
    <Card className={cn("min-w-96", isMobile && "w-full")}>
      <CardTitle className="px-6 flex items-center justify-between">
        <div className="flex gap-2 text-sm items-center opacity-70">
          <FaYoutube className="text-red-500" />
          <span>Background Music</span>
        </div>
        {videoId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleClearVideo}
          >
            <FaTimes className="w-3 h-3" />
          </Button>
        )}
      </CardTitle>

      <CardDescription className="px-6 pb-4 flex flex-col gap-3">
        {/* URL Input */}
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Paste YouTube URL or video ID..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleLoadVideo();
              }
            }}
            className="flex-1 text-sm"
          />
          <Button size="sm" onClick={handleLoadVideo} disabled={!videoUrl.trim()}>
            Load
          </Button>
        </div>

        {/* Video Player */}
        {videoId && (
          <div className={cn("flex flex-col gap-2", isCollapsed && "hidden")}>
            <div className="rounded-lg overflow-hidden bg-black/20">
              <YouTube
                videoId={videoId}
                opts={opts}
                onReady={onPlayerReady}
                onStateChange={onStateChange}
                className="w-full"
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePlayPause}
                className="flex-1"
              >
                {isPlaying ? <FaPause className="mr-2" /> : <FaPlay className="mr-2" />}
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleMute}
              >
                {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
              </Button>
            </div>
          </div>
        )}
      </CardDescription>
    </Card>
  );
}
