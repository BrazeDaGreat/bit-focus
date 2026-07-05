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
  FaProjectDiagram,
  FaCoffee,
  FaCalendarAlt,
  FaPenNib,
} from "react-icons/fa";
import { BsStars } from "react-icons/bs";
import { IoIosTimer } from "react-icons/io";
import { FaReadme, FaUser } from "react-icons/fa6";
import { THEMES, type ThemeDefinition } from "@/lib/ThemeManager";
import { useTheme } from "next-themes";
import { EditConfigForm } from "./sidebar/EditConfig";
import { usePathname, useRouter } from "next/navigation";
import { useConfig, type FeatureKey } from "@/hooks/useConfig";
import { useEffect, useRef, useCallback, useState, type JSX } from "react";
import { AmbienceMixer } from "./sidebar/AmbienceMixer";
import { Skeleton } from "./ui/skeleton";
import { VERSION } from "@/app/changelog/CHANGELOG";
import { usePomo } from "@/hooks/PomoContext";
import { useShortcutsDialog } from "@/hooks/useShortcuts";
import { Kbd } from "@/components/ui/kbd";
import { FaRegKeyboard } from "react-icons/fa6";
import { useProjects } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

const items: { title: string; url: string; icon: JSX.Element; feature?: FeatureKey }[] = [
  { title: "Home", url: "/", icon: <FaHome /> },
  { title: "Focus", url: "/focus", icon: <IoIosTimer /> },
  { title: "Calendar", url: "/calendar", icon: <FaCalendarAlt />, feature: "calendar" },
  { title: "AI Chat (BETA)", url: "/ai", icon: <BsStars />, feature: "aiChat" },
  { title: "Excalidraw", url: "/excalidraw", icon: <FaPenNib />, feature: "excalidraw" },
  { title: "Projects", url: "/projects", icon: <FaProjectDiagram />, feature: "projects" },
  { title: "Rewards", url: "/rewards", icon: <FaCoffee />, feature: "rewards" },
  { title: "Changelog", url: "/changelog", icon: <FaReadme /> },
];

export function AppSidebar(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { pause, state, start } = usePomo();
  const { loadConfig, loadingConfig, featureToggles } = useConfig();
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
              {items
                .filter((item) => !item.feature || featureToggles[item.feature])
                .map((item) => {
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

        {/* ── Ambience mixer ── */}
        <SidebarGroup className="px-2 pb-2 pt-0 mt-auto">
          <SidebarGroupContent>
            <AmbienceMixer />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="p-0">
        {/* Footer row: theme + user config + version */}
        <div className="flex items-center justify-between px-3 py-2 border-t">
          <div className="flex items-center gap-1">
            <ThemeIconButton />
            <ShortcutsButton />
          </div>
          <span className="text-xs text-muted-foreground/50 select-none py-1.5">
            {VERSION}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// ── Keyboard shortcuts button (bottom-left) that opens the help dialog ──

function ShortcutsButton(): JSX.Element {
  const { setHelpOpen } = useShortcutsDialog();
  return (
    <Button
      variant="secondary"
      size="icon"
      className="size-8 relative group/kbd"
      title="Keyboard shortcuts (?)"
      onClick={() => setHelpOpen(true)}
    >
      <FaRegKeyboard className="size-3.5 group-hover/kbd:opacity-0 transition-opacity" />
      <Kbd className="absolute inset-0 m-auto size-fit opacity-0 group-hover/kbd:opacity-100 transition-opacity bg-transparent border-0">
        ?
      </Kbd>
    </Button>
  );
}

// ── Theme icon button that opens a popover of theme options ──

function ThemeIcon({ theme: t }: { theme: ThemeDefinition }): JSX.Element {
  const Icon = t.icon;
  return <Icon className={cn("size-3.5", t.iconClass)} />;
}

function ThemeIconButton(): JSX.Element {
  const { setTheme, theme } = useTheme();
  const [ currentTheme, setCurrentTheme ] = useState<ThemeDefinition | null>(null);

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
          <ThemeIcon theme={currentTheme} />
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
              <ThemeIcon theme={t} />
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

function UserConfigButton({ loadingConfig }: { loadingConfig: boolean }): JSX.Element {
  const { name, dob } = useConfig();
  const [open, setOpen] = useState(false);

  const hasName = name && name !== "NULL" && name.trim() !== "";
  const hasDob = !!dob;
  const age = dob ? calculateAge(new Date(dob)) : null;

  if (loadingConfig) {
    return <Skeleton className="w-full h-11 rounded-md" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex justify-start h-11 px-2.5 gap-2"
        >
          {hasName ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`https://api.dicebear.com/9.x/shapes/svg?seed=${name}`}
              alt="avatar"
              className="w-8 h-8 rounded-full shadow-md shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border shadow-xs shrink-0">
              <FaUser className="size-3.5 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-col items-start text-left min-w-0">
            {hasName ? (
              <span className="text-sm font-medium text-foreground truncate w-full">
                {name}
              </span>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">
                Guest Profile
              </span>
            )}
            {hasDob && age ? (
              <span className="text-xs text-muted-foreground truncate w-full">
                {age.years}y {age.months}m {age.days}d
              </span>
            ) : hasName ? (
              <span className="text-[10px] text-primary/80 hover:text-primary transition-colors font-medium">
                Set DOB
              </span>
            ) : (
              <span className="text-[10px] text-primary/80 hover:text-primary transition-colors font-medium">
                Set details
              </span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-0">
        <EditConfigForm onSave={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
