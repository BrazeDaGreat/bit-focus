import { PipFunctionProps, usePipSpace } from "@/hooks/usePip";
import { formatTimeNew } from "@/lib/utils";
import { FaPause, FaPlay } from "react-icons/fa";
// import { useEffect, useState } from "react";

// const FETCH_RATE = 1; // Fetch Rate in seconds

export interface PipTimer {
    time: number,
    running: false,
    inc: {
        pause: 0,
        resume: 0
    },
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function PipTimer(props: PipFunctionProps) {
    const { data, update } = usePipSpace("piptimer", {
        time: 0,
        running: false,
        inc: {
            pause: 0,
            resume: 0,
        }
    })

  return (
    <div>
      <h1>
        {formatTimeNew(
          { minutes: Math.floor(data.time / 60), seconds: data.time % 60 },
          "M:S",
          "digital"
        )}
      </h1>

      {
        data.running && <button className="button primary" onClick={() => update({ inc: {pause: 1, resume: 0}})}><FaPause /></button>
      }
      { !data.running && <button className="button primary" onClick={() => update({ inc: {pause: 0, resume: 1}})}><FaPlay /></button>}
    </div>
  );
}