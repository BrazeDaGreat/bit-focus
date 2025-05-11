// import { useStopwatch } from "react-timer-hook"
import { Card, CardFooter, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { usePomo } from "@/hooks/PomoContext";
import { FaPause, FaPlay } from "react-icons/fa";
import { FaForwardFast, FaX } from "react-icons/fa6";
import { cn, formatTime } from "@/lib/utils";
import { useState } from "react";
import TagSelector from "../TagSelector";
import { RiFocus2Line } from "react-icons/ri";

interface FocusModeProps {
  setFocusMode: (focusMode: boolean) => void;
  minutes: number;
  seconds: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  isRunning: boolean;
}
const FocusMode = ({ setFocusMode, start, pause, reset, isRunning, minutes, seconds }: FocusModeProps) => (
  <div className="fixed bg-black w-screen h-screen top-0 left-0 z-50 flex flex-col items-center justify-center gap-12 _animate_in">
    <div className="absolute top-4 right-4">
      <Button
        size={"icon"}
        className=""
        variant={"default"}
        onClick={() => setFocusMode(false)}
      >
        <FaX />
      </Button>
    </div>
    <div className="text-8xl font-bold text-white">
      {formatTime(minutes, seconds)}
    </div>
    <TagSelector noHover />
    {/* Controls */}
    <div className={cn("w-80 h-16", "flex", "gap-2")}>
      <Button
        size={"icon"}
        className="flex-2/3 h-full"
        variant={"default"}
        onClick={isRunning ? pause : start}
      >
        {isRunning ? <FaPause /> : <FaPlay />}
      </Button>
      <Button
        size={"icon"}
        className="flex-1/3 h-full"
        variant={"default"}
        onClick={reset}
      >
        <FaForwardFast />
      </Button>
    </div>
  </div>
);

export default function PomoFooterTimer() {
  const { state, start, pause, reset } = usePomo();
  const [focusMode, setFocusMode] = useState<boolean>(false);
  const minutes = Math.floor(state.elapsedSeconds / 60);
  const seconds = state.elapsedSeconds % 60;

  return (
    <>
      {focusMode && <FocusMode setFocusMode={setFocusMode} start={start} pause={pause} reset={reset} isRunning={state.isRunning} minutes={minutes} seconds={seconds} />}
      <Card className="min-w-60">
        <CardTitle className="text-3xl text-center">
          {formatTime(minutes, seconds)}
        </CardTitle>
        <CardFooter className="flex items-center justify-center gap-2">
          <Button
            size={"icon"}
            className="w-1/3"
            variant={"secondary"}
            onClick={state.isRunning ? pause : start}
          >
            {state.isRunning ? <FaPause /> : <FaPlay />}
          </Button>
          <Button size={"icon"} variant={"destructive"} onClick={reset}>
            <FaForwardFast />
          </Button>
          <Button size={"icon"} variant={"default"} onClick={() => setFocusMode(true)}>
            <RiFocus2Line />
          </Button>

        </CardFooter>
      </Card>
    </>
  );
}
