import { Badge } from "@/components/ui/badge";
import { Project } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import { type JSX } from "react";
import { MdCheck, MdPlayArrow, MdSchedule } from "react-icons/md";

/**
 * Status Badge Component
 *
 * Renders a status badge with appropriate colors and icons for project status.
 *
 * @param {Object} props - Component props
 * @param {Project["status"]} props.status - The project status
 * @returns {JSX.Element} Styled status badge
 */
export default function StatusBadge({ status }: { status: Project["status"] }): JSX.Element {
  const configs = {
    Scheduled: {
      icon: <MdSchedule />,
      variant: "outline" as const,
      color: "text-yellow-600",
    },
    Active: {
      icon: <MdPlayArrow />,
      variant: "outline" as const,
      color: "text-green-600",
    },
    Closed: {
      icon: <MdCheck />,
      variant: "outline" as const,
      color: "text-gray-600",
    },
  };

  const config = configs[status];

  return (
    <Badge variant={config.variant} className={cn("gap-1", config.color)}>
      {config.icon}
      {status}
    </Badge>
  );
}