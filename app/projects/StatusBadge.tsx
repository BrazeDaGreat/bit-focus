import type { Project } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import { type JSX } from "react";
import { Check, Play, Clock3 } from "lucide-react";

/**
 * Status Badge Component
 *
 * Renders a status badge with appropriate colors and icons for project status.
 *
 * @param {Object} props - Component props
 * @param {Project["status"]} props.status - The project status
 * @returns {JSX.Element} Styled status badge
 */
export default function StatusBadge({
  status,
}: {
  status: Project["status"];
}): JSX.Element {
  const configs = {
    Scheduled: {
      icon: <Clock3 className="size-3" />,
      color: "bg-muted/60 text-muted-foreground",
    },
    Active: {
      icon: <Play className="size-3" />,
      color: "bg-primary/12 text-primary",
    },
    Closed: {
      icon: <Check className="size-3" />,
      color: "bg-muted/60 text-muted-foreground",
    },
  };

  const config = configs[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs",
        config.color,
      )}
    >
      {config.icon}
      {status}
    </span>
  );
}
