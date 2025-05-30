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
import { calculateTime, formatTime, formatTimeNew } from "@/lib/utils";
import { useTheme } from "next-themes";
import {
  FaCalendar,
  FaExternalLinkAlt,
  FaFileCsv,
  FaPause,
  FaPlay,
  FaTrash,
} from "react-icons/fa";
import {
  FaFileExport,
  FaFileImport,
  FaForwardFast,
  FaRegClock,
  FaTableList,
} from "react-icons/fa6";
import { RiExpandUpDownLine, RiFocus2Line } from "react-icons/ri";
import { toast, Toaster } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import TagBadge from "@/components/TagBadge";
import { useEffect, useRef, useState } from "react";
import { EditFocusSession } from "./EditFocusSection";
import TagSelector from "@/components/TagSelector";
import GraphDialog from "./Graph";
import { usePip, usePipSpace } from "@/hooks/usePip";
import PipTimer from "@/components/PipTimer";
import SaveManager from "@/lib/SaveManager";

export default function Focus() {
  const { theme } = useTheme();
  const { state, start, pause, reset } = usePomo();

  const minutes = Math.floor(state.elapsedSeconds / 60);
  const seconds = state.elapsedSeconds % 60;
  const { focusSessions } = useFocus();

  const { show } = usePip(PipTimer, {
    injectStyles: `
    * {
      padding: 0;
      margin: 0;
      box-sizing: border-box;
      font-family: JetBrains Mono, monospace;
    }
    div {
      width: 100vw;
      height: 100vh;
      background-color: black;
      color: oklch(87% 0 0);

      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 0.5rem;
    }
    h1 {
      font-size: 2.25rem;
      font-weight: 800;
    }

    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem;
      border-radius: 0.5rem;
      font-size: 1rem;
      line-height: 1;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }
    `,
  });
  const { data, update } = usePipSpace("piptimer", {
    time: state.elapsedSeconds,
    running: state.isRunning,
    inc: {
      pause: 0,
      resume: 0,
    },
  });
  useEffect(() => {
    if (state.isRunning) {
      update({ time: state.elapsedSeconds, running: true });
    } else {
      update({ time: state.elapsedSeconds, running: false });
    }
  }, [state, update]);
  useEffect(() => {
    if (data.inc.pause === 1) {
      pause();
      update({ running: false, inc: { pause: 0, resume: 0 } });
    }
    if (data.inc.resume === 1) {
      start();
      update({ running: true, inc: { pause: 0, resume: 0 } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, update]);

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
                className="py-6 w-1/6"
                variant={"destructive"}
                onClick={reset}
              >
                <FaForwardFast />
              </Button>
            )}
            <Button
              onClick={show}
              size={"icon"}
              className="py-6 w-1/6"
              variant={"secondary"}
            >
              <FaExternalLinkAlt />
            </Button>
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
              <BITFdata />
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

function BITFdata() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleExport = async () => {
    try {
      await SaveManager.exportData();
      toast.success("Backup exported successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Export failed.");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await SaveManager.importData(file);
      toast.success("Backup imported successfully!");
      toast.info("Reloading in 2 seconds to apply changes...");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error(err);
      toast.error("Import failed. Check file format.");
    } finally {
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const listener = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA")
      )
        return;

      if (e.key.toLowerCase() === "w") {
        e.preventDefault();
        handleExport();
      } else if (e.key.toLowerCase() === "q") {
        e.preventDefault();
        handleImportClick();
      }
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [isOpen]);

  return (
    <>
      <input
        type="file"
        accept=".bitf.json"
        onChange={handleFileChange}
        ref={fileInputRef}
        className="hidden"
      />
      <DropdownMenu onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost">
            <FaFileCsv className="mr-2" />
            BITF Data
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={handleExport}>
            <FaFileExport className="mr-2" />
            <span>Export</span>
            <DropdownMenuShortcut>W</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick}>
            <FaFileImport className="mr-2" />
            <span>Import</span>
            <DropdownMenuShortcut>Q</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}


interface FocusOptionProps {
  item: FocusSession;
}

function FocusOption({ item }: FocusOptionProps) {
  const { removeFocusSession } = useFocus();

  const time = calculateTime(item.startTime, item.endTime);
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
              {formatTimeNew(time, "H:M:S", "text")}
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
