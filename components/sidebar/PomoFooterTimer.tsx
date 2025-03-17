// import { useStopwatch } from "react-timer-hook"
import { Card, CardFooter, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { usePomo } from "@/hooks/PomoContext"
import { FaPause, FaPlay } from "react-icons/fa"
import { FaForwardFast } from "react-icons/fa6"

const formatTime = (minutes: number, seconds: number) => {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

}

export default function PomoFooterTimer() {
    const { state, start, pause, reset } = usePomo();
  const minutes = Math.floor(state.elapsedSeconds / 60);
  const seconds = state.elapsedSeconds % 60;

    return <Card className="min-w-60">
        <CardTitle className="text-3xl text-center">
            {formatTime(minutes, seconds)}
        </CardTitle>
        <CardFooter className="flex items-center justify-center gap-2">

            <Button size={"icon"} className="w-1/3" variant={"secondary"} onClick={state.isRunning ? pause : start}>{state.isRunning ? <FaPause /> : <FaPlay />}</Button>
            <Button size={"icon"} variant={"destructive"} onClick={reset}><FaForwardFast /></Button>
        </CardFooter>
    </Card>
}

// import { usePomo } from "@/hooks/usePomo";

// export default function PomoFooterTimer() {
//   const { minutes, seconds, isRunning, start, pause, reset } = usePomo();

//   return (
//     <div>
//       <h1>{minutes}:{seconds < 10 ? `0${seconds}` : seconds}</h1>
//       <button onClick={isRunning ? pause : start}>{isRunning ? "Pause" : "Start"}</button>
//       <button onClick={reset}>Reset</button>
//     </div>
//   );
// }
