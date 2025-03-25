"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export default function Home() {
  const { theme } = useTheme();

  return (
    <div className="">
      <h1>This feature is under development.</h1>

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}
