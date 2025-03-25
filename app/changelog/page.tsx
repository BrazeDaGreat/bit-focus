"use client";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import Markdown from "react-markdown";
import CHANGELOG from "./CHANGELOG";

export default function Changelog() {
  const { theme } = useTheme();
  return (
    <div className="p-2">
      <h1 className="text-4xl font-bold mx-2">Changelog</h1>
      <div className="md">
        <Markdown>{CHANGELOG}</Markdown>
      </div>
      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}
