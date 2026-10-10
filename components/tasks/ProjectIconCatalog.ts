import { icons, type LucideIcon } from "lucide-react";

// This module is only imported on demand. Keep the full icon catalog out of the
// workspace's initial bundle; ordinary project icons use the curated map.
export const projectIconCatalog: Record<string, LucideIcon> = icons;
