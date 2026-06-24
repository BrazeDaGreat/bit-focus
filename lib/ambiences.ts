/**
 * Ambience Sound Catalog
 *
 * Central, editable list of background ambience tracks shown in the sidebar
 * mixer. Add, remove, or re-point any entry here — the UI and audio engine
 * read from this single source of truth.
 *
 * Each track loops seamlessly and is mixed independently with its own volume.
 * Icons come from react-icons/fa6 and are rendered by the mixer component.
 */

import type { IconType } from "react-icons";
import {
  FaFire,
  FaCarSide,
  FaTractor,
  FaBug,
  FaCloudShowersHeavy,
  FaCloudBolt,
  FaMoon,
  FaMugHot,
} from "react-icons/fa6";

/** A single ambience track definition. */
export interface Ambience {
  /** Stable id used as the persistence key — never change once shipped. */
  id: string;
  /** Human label shown in tooltips/labels. */
  label: string;
  /** Looping audio source URL. */
  url: string;
  /** Icon component rendered in the mixer. */
  icon: IconType;
}

/** Ordered list of ambience tracks. Order drives the mixer layout. */
export const AMBIENCES: Ambience[] = [
  {
    id: "fire",
    label: "Fireplace",
    url: "https://actions.google.com/sounds/v1/ambiences/fire.ogg",
    icon: FaFire,
  },
  {
    id: "highway",
    label: "Waterfront Highway",
    url: "https://actions.google.com/sounds/v1/ambiences/highway_near_waterfront.ogg",
    icon: FaCarSide,
  },
  {
    id: "farm",
    label: "Morning Farm",
    url: "https://actions.google.com/sounds/v1/ambiences/farm_morning_with_sheep.ogg",
    icon: FaTractor,
  },
  {
    id: "cicada",
    label: "Cicadas",
    url: "https://actions.google.com/sounds/v1/animals/cicada_chirp.ogg",
    icon: FaBug,
  },
  {
    id: "rain",
    label: "Heavy Rain",
    url: "https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg",
    icon: FaCloudShowersHeavy,
  },
  {
    id: "thunder",
    label: "Thunderstorm",
    url: "https://actions.google.com/sounds/v1/weather/thunderstorm_long.ogg",
    icon: FaCloudBolt,
  },
  {
    id: "crickets",
    label: "Crickets & Traffic",
    url: "https://actions.google.com/sounds/v1/ambiences/crickets_with_distant_traffic.ogg",
    icon: FaMoon,
  },
  {
    id: "coffee",
    label: "Coffee Shop",
    url: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
    icon: FaMugHot,
  },
];

/** Default starting volume (0–1) for a freshly enabled track. */
export const DEFAULT_AMBIENCE_VOLUME = 0.6;
