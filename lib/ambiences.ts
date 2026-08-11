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
  FaFan,
  FaCloudRain,
  FaHouseChimneyWindow,
  FaTree,
  FaLeaf,
  FaWater,
  FaUmbrellaBeach,
  FaPlane,
  FaTrainSubway,
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
    id: "coffee",
    label: "Coffee Shop",
    url: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
    icon: FaMugHot,
  },
  {
    id: "air-conditioner",
    label: "Air Conditioner",
    url: "https://actions.google.com/sounds/v1/ambiences/ambient_hum_air_conditioner.ogg",
    icon: FaFan,
  },
  {
    id: "light-rain",
    label: "Light Rain",
    url: "https://actions.google.com/sounds/v1/weather/light_rain.ogg",
    icon: FaCloudRain,
  },
  {
    id: "rain-on-roof",
    label: "Rain on Roof",
    url: "https://actions.google.com/sounds/v1/weather/rain_on_roof.ogg",
    icon: FaHouseChimneyWindow,
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
    id: "stream",
    label: "Flowing Stream",
    url: "https://actions.google.com/sounds/v1/water/small_stream_flowing.ogg",
    icon: FaWater,
  },
  {
    id: "shoreline",
    label: "Water Lapping",
    url: "https://actions.google.com/sounds/v1/water/water_lapping_wind.ogg",
    icon: FaUmbrellaBeach,
  },
  {
    id: "ocean-waves",
    label: "Rock Beach Waves",
    url: "https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg",
    icon: FaUmbrellaBeach,
  },
  {
    id: "summer-forest",
    label: "Summer Forest",
    url: "https://actions.google.com/sounds/v1/ambiences/summer_forest.ogg",
    icon: FaTree,
  },
  {
    id: "jungle-morning",
    label: "Jungle Morning",
    url: "https://actions.google.com/sounds/v1/ambiences/jungle_atmosphere_morning.ogg",
    icon: FaLeaf,
  },
  {
    id: "crickets",
    label: "Crickets & Traffic",
    url: "https://actions.google.com/sounds/v1/ambiences/crickets_with_distant_traffic.ogg",
    icon: FaMoon,
  },
  {
    id: "cicada",
    label: "Cicadas",
    url: "https://actions.google.com/sounds/v1/animals/cicada_chirp.ogg",
    icon: FaBug,
  },
  {
    id: "farm",
    label: "Morning Farm",
    url: "https://actions.google.com/sounds/v1/ambiences/farm_morning_with_sheep.ogg",
    icon: FaTractor,
  },
  {
    id: "airplane-cabin",
    label: "Airplane Cabin",
    url: "https://actions.google.com/sounds/v1/transportation/airplane_in_flight.ogg",
    icon: FaPlane,
  },
  {
    id: "subway-ride",
    label: "Subway Ride",
    url: "https://actions.google.com/sounds/v1/transportation/subway_nyc_in_motion.ogg",
    icon: FaTrainSubway,
  },
  {
    id: "highway",
    label: "Waterfront Highway",
    url: "https://actions.google.com/sounds/v1/ambiences/highway_near_waterfront.ogg",
    icon: FaCarSide,
  },
];

/** Default starting volume (0–1) for a freshly enabled track. */
export const DEFAULT_AMBIENCE_VOLUME = 0.6;
