"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  FaHome,
  FaMoon,
  FaSun,
  FaProjectDiagram,
  FaCoffee,
  FaCalendarAlt,
  FaPenNib,
} from "react-icons/fa";
import { BsStars } from "react-icons/bs";
import { IoIosTimer } from "react-icons/io";
import {
  FaGear,
  FaGem,
  FaPaintbrush,
  FaReadme,
  FaWater,
  FaUser,
} from "react-icons/fa6";
import { IoColorPalette } from "react-icons/io5";
import { useTheme } from "next-themes";
import { EditConfigForm } from "./sidebar/EditConfig";
import { usePathname, useRouter } from "next/navigation";
import { useConfig } from "@/hooks/useConfig";
import { useEffect, useRef, useCallback, useState, type JSX } from "react";
import PomoFooterTimer from "./sidebar/PomoFooterTimer";
import { Skeleton } from "./ui/skeleton";
import { VERSION } from "@/app/changelog/CHANGELOG";
import { usePomo } from "@/hooks/PomoContext";
import { useProjects } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

const items = [
  { title: "Home", url: "/", icon: <FaHome /> },
  { title: "Focus", url: "/focus", icon: <IoIosTimer /> },
  { title: "Calendar", url: "/calendar", icon: <FaCalendarAlt /> },
  { title: "AI Chat (BETA)", url: "/ai", icon: <BsStars /> },
  { title: "Excalidraw", url: "/excalidraw", icon: <FaPenNib /> },
  { title: "Projects", url: "/projects", icon: <FaProjectDiagram /> },
  { title: "Rewards", url: "/rewards", icon: <FaCoffee /> },
  { title: "Changelog", url: "/changelog", icon: <FaReadme /> },
];

export function AppSidebar(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { pause, state, start } = usePomo();
  const { loadConfig, loadingConfig } = useConfig();
  const { loadProjects } = useProjects();

  const isNavigatingRef = useRef(false);
  const wasRunningRef = useRef(false);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const pauseForNavigation = useCallback(() => {
    if (state.isRunning && state.elapsedSeconds > 0 && !isNavigatingRef.current) {
      wasRunningRef.current = true;
      pause();
    }
  }, [state.isRunning, state.elapsedSeconds, pause]);

  const resumeAfterNavigation = useCallback(() => {
    if (wasRunningRef.current && !state.isRunning && state.elapsedSeconds > 0) {
      const timeoutId = setTimeout(() => {
        start();
        wasRunningRef.current = false;
        isNavigatingRef.current = false;
      }, 10);
      return () => clearTimeout(timeoutId);
    } else {
      isNavigatingRef.current = false;
    }
  }, [state.isRunning, state.elapsedSeconds, start]);

  useEffect(() => {
    const cleanup = resumeAfterNavigation();
    return cleanup;
  }, [pathname, resumeAfterNavigation]);

  const handleNavigation = useCallback(
    (url: string, event: React.MouseEvent) => {
      event.preventDefault();
      if (isNavigatingRef.current) return;
      if (pathname === url) return;
      isNavigatingRef.current = true;
      pauseForNavigation();
      setTimeout(() => {
        router.push(url);
      }, 5);
    },
    [pathname, router, pauseForNavigation]
  );

  return (
    <Sidebar>
      {/* ── Header: Brand ── */}
      <SidebarHeader className="h-14 flex flex-row items-center border-b py-0 gap-0">
        <UserConfigButton
          loadingConfig={loadingConfig}
        />
      </SidebarHeader>

      {/* ── Navigation ── */}
      <SidebarContent className="pt-2">
        <SidebarGroup className="p-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      className={cn(
                        "gap-2 h-9",
                        isActive
                          ? "bg-accent text-foreground font-medium border-l-2 border-primary rounded-l-none"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      )}
                      onClick={(e) => handleNavigation(item.url, e)}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="p-0">
        {/* Timer block — only shown when running or paused */}
        <PomoFooterTimer />

        {/* Footer row: theme + user config + version */}
        <div className="flex items-center justify-between px-3 py-2 border-t">
          <div className="flex items-center gap-1">
            <ThemeIconButton />
          </div>
          <span className="text-xs text-muted-foreground/50 select-none py-1.5">
            {VERSION}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// ── Theme icon button that opens a popover of theme options ──

const THEMES = [
  { value: "light", label: "Light", icon: <FaSun className="size-3.5" /> },
  { value: "dark", label: "Dark", icon: <FaMoon className="size-3.5" /> },
  { value: "system", label: "System", icon: <FaGear className="size-3.5" /> },
  { value: "amethyst", label: "Amethyst", icon: <FaGem className="size-3.5 text-purple-400" /> },
  { value: "amethystoverloaded", label: "Amethyst+", icon: <FaGem className="size-3.5 text-purple-700" /> },
  { value: "bluenight", label: "Blue Night", icon: <FaWater className="size-3.5 text-cyan-400" /> },
  { value: "amoled", label: "AMOLED", icon: <IoColorPalette className="size-3.5 text-neutral-400" /> },
  { value: "pastel-blue", label: "Pastel Blue", icon: <FaPaintbrush className="size-3.5 text-blue-300" /> },
  { value: "pastel-orange", label: "Pastel Orange", icon: <FaPaintbrush className="size-3.5 text-orange-300" /> },
  { value: "pastel-purple", label: "Pastel Purple", icon: <FaPaintbrush className="size-3.5 text-purple-300" /> },
];

function ThemeIconButton(): JSX.Element {
  const { setTheme, theme } = useTheme();
  const [ currentTheme, setCurrentTheme ] = useState<typeof THEMES[0] | null>(null);

  useEffect(() => {
    const foundTheme = THEMES.find((t) => t.value === theme);
    setCurrentTheme(foundTheme || THEMES[0]);
  }, [theme, setTheme]);

  if (!currentTheme) {
    return (
      <Skeleton className="size-8 rounded-md" />
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="size-8"
          title="Change theme"
        >
          { currentTheme.icon }
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-44 p-1.5"
      >
        <div className="flex flex-col gap-0.5">
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded text-sm w-full text-left transition-colors",
                theme === t.value
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const calculateAge = (dob: Date) => {
    const today = dayjs();
    const birthDate = dayjs(dob);
  
    const years = today.diff(birthDate, 'year');
    const months = today.diff(birthDate.add(years, 'year'), 'month');
    const days = today.diff(birthDate.add(years, 'year').add(months, 'month'), 'day');
    return { years, months, days}
};

// ── User config button (avatar icon → opens EditConfig popover) ──

function UserConfigButton({ loadingConfig }: { loadingConfig: boolean }): JSX.Element {
  const { name, dob } = useConfig();
  const [open, setOpen] = useState(false);

  const { years, months, days } = calculateAge(new Date(dob || new Date()));

  if (loadingConfig) {
    return <Skeleton className="w-full h-11 rounded-md" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"ghost"}
          className="w-full flex justify-start h-11"
        >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {name ? <img src={`https://api.dicebear.com/9.x/shapes/svg?seed=${name}`} alt="avatar" className="w-8 h-8 rounded-full shadow-md" /> : <FaUser className="size-3.5" />}
        <div className="flex flex-col items-start">
          { name ? <span className="ml-2">{name}</span> : <span className="ml-2 text-muted-foreground">Set your name</span> }
          { dob ? <span className="ml-2 text-xs text-muted-foreground">{years}y {months}m {days}d</span> : <span className="ml-2 text-xs text-muted-foreground">Set your DOB</span> }
        </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-0">
        <EditConfigForm onSave={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
