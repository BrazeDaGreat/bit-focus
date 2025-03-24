"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import { usePomo } from "@/hooks/PomoContext";
import { FocusSession, useFocus } from "@/hooks/useFocus";
import { formatTime } from "@/lib/utils";
import { useTheme } from "next-themes";
import {
  FaCalendar,
  FaFileCsv,
  FaPause,
  FaPlay,
  FaTrash,
} from "react-icons/fa";
import {
  FaForwardFast,
  FaRegClock,
  FaTableList,
} from "react-icons/fa6";
import { RiExpandUpDownLine, RiFocus2Line } from "react-icons/ri";
import { Toaster } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import TagBadge from "@/components/TagBadge";
import { useState } from "react";
import { EditFocusSession } from "./EditFocusSection";
import TagSelector from "@/components/TagSelector";
import GraphDialog from "./Graph";


export default function Focus() {
  const { theme } = useTheme();
  const { state, start, pause, reset } = usePomo();
  const minutes = Math.floor(state.elapsedSeconds / 60);
  const seconds = state.elapsedSeconds % 60;
  const { focusSessions } = useFocus();

  return (
    <div className="flex-1 p-8 gap-8 flex flex-col items-center justify-center">
      {/* Timer */}
      <div className="">
        <Card className="min-w-96">
          <CardTitle className="text-md flex items-center justify-center gap-2 opacity-60">
            <RiFocus2Line />
            <span>Focus Session</span>
          </CardTitle>
          <CardDescription className="text-center flex flex-col gap-6">
            <span className="text-8xl font-semibold">
              {formatTime(minutes, seconds)}
            </span>
            <TagSelector />
          </CardDescription>

          <CardFooter className="flex items-center justify-center gap-2">
            <Button
              size={"lg"}
              className="w-2/3 py-6"
              variant={"default"}
              onClick={state.isRunning ? pause : start}
            >
              {state.isRunning ? <FaPause /> : <FaPlay />}
              {state.isRunning ? <span>Pause</span> : <span>Start</span>}
            </Button>
            {state.elapsedSeconds > 0 && (
              <Button
                size={"icon"}
                className="py-6 w-1/3"
                variant={"destructive"}
                onClick={reset}
              >
                <FaForwardFast />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
      {/* List */}
      <div className="">
        <Card className="min-w-96">
          <CardTitle className="px-6 flex items-center justify-between">
            <div className="flex gap-1 text-sm items-center opacity-70">
              <FaTableList />
              <span>Focus Report</span>
            </div>
            <div className="flex gap-1">
              <Button size={"sm"} variant={"ghost"}>
                <FaFileCsv /> Export
              </Button>
              <GraphDialog />
            </div>
          </CardTitle>
          <CardDescription className="max-h-64 overflow-y-auto flex flex-col gap-2 py-2 px-12">
            {focusSessions.map((session) => (
              <FocusOption key={session.id} item={session} />
            ))}
          </CardDescription>
        </Card>
      </div>
      {/* Toaster */}
      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}

interface FocusOptionProps {
  item: FocusSession;
}

function FocusOption({ item }: FocusOptionProps) {
  const { removeFocusSession } = useFocus()
  const elapsedSeconds = Math.floor(
    (item.endTime.getTime() - item.startTime.getTime()) / 1000
  );
  const onDate = item.startTime.toLocaleDateString("en-GB");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const handleOpenChange = (open: boolean) => {
    setIsDropdownOpen(open);
  };

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="w-full flex justify-between items-center h-12"
        >
          <div className="flex gap-2 items-center">
            <FaRegClock />
            <span className="font-semibold">
              {formatTime(elapsedSeconds / 60, -1, 1)}
            </span>
          </div>
          <div className="flex gap-4 items-center">
            <TagBadge tag={item.tag} />
            <RiExpandUpDownLine />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="flex items-center gap-2">
          <FaCalendar /> {onDate}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <EditFocusSession item={item} setIsDropdownOpen={setIsDropdownOpen} />
        <DropdownMenuItem onClick={() => removeFocusSession(item.id!)}>
          <FaTrash />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
