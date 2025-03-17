"use client";

import PomoFooterTimer from "@/components/sidebar/PomoFooterTimer";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";


export default function Home() {

  const { theme } = useTheme();

  return <div className="">
    what&apos;s up chat

    <PomoFooterTimer />

    <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
  </div>
}
