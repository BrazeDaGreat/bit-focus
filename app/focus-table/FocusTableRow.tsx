/**
 * Focus Table Row
 *
 * One session row in the Focus Table: selection checkbox, tag badge,
 * start/end timestamps, duration, and a per-row actions dropdown reusing
 * the shared edit dialog from the Focus page.
 *
 * @fileoverview Table row with selection and per-row actions
 * @author BIT Focus Development Team
 * @since v0.18.11
 */

"use client";

import { useState, type JSX } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TagBadge from "@/components/TagBadge";
import { EditFocusSession } from "@/app/focus/EditFocusSection";
import { useFocus, type FocusSession } from "@/hooks/useFocus";
import { calculateTime, formatTimeNew } from "@/lib/utils";
import { FaTrash } from "react-icons/fa";
import { FaEllipsis } from "react-icons/fa6";
import dayjs from "dayjs";

interface FocusTableRowProps {
  session: FocusSession;
  selected: boolean;
  onToggle: (id: number) => void;
}

export default function FocusTableRow({
  session,
  selected,
  onToggle,
}: FocusTableRowProps): JSX.Element {
  const { removeFocusSession } = useFocus();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const duration = calculateTime(
    new Date(session.startTime),
    new Date(session.endTime)
  );
  const durationText = formatTimeNew(duration, "H:M:S", "text");
  const start = dayjs(session.startTime);
  const end = dayjs(session.endTime);
  const sameDay = start.isSame(end, "day");

  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell className="w-10">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(session.id!)}
          aria-label="Select session"
        />
      </TableCell>

      <TableCell>
        <TagBadge tag={session.tag} />
      </TableCell>

      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
        <span className="text-foreground">{start.format("MMM D, YYYY")}</span>{" "}
        {start.format("HH:mm")}
      </TableCell>

      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
        {sameDay ? (
          end.format("HH:mm")
        ) : (
          <>
            <span className="text-foreground">{end.format("MMM D, YYYY")}</span>{" "}
            {end.format("HH:mm")}
          </>
        )}
      </TableCell>

      <TableCell className="font-mono text-sm font-medium tabular-nums text-right">
        {durationText}
      </TableCell>

      <TableCell className="w-10 text-right">
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="size-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Actions"
            >
              <FaEllipsis className="size-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs font-mono text-muted-foreground">
              {start.format("MMM D, YYYY")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <EditFocusSession
              item={session}
              setIsDropdownOpen={setDropdownOpen}
            />
            <DropdownMenuItem
              onClick={() => removeFocusSession(session.id!)}
              className="text-destructive focus:text-destructive gap-2"
            >
              <FaTrash className="size-3" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
