"use client";

import { Toaster } from "@/components/ui/sonner";
import { useConfig } from "@/hooks/useConfig";
import { useEffect } from "react";



export default function Home() {

  const { loadConfig } = useConfig()
  useEffect(() => { loadConfig() }, [loadConfig])

  return <div className="">
    what&apos;s up chat

    <Toaster />
  </div>
}
