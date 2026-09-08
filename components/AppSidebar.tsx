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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  FaTable,
} from "react-icons/fa";
import { BsStars } from "react-icons/bs";
import { IoIosTimer } from "react-icons/io";
import { FaReadme, FaUser, FaChevronRight } from "react-icons/fa6";
import { THEMES, type ThemeDefinition } from "@/lib/ThemeManager";
import { useTheme } from "next-themes";
import { EditConfigForm } from "./sidebar/EditConfig";
import AccountAvatar from "./auth/AccountAvatar";
import { useAuth } from "@/hooks/useAuth";
import { usePathname, useRouter } from "next/navigation";
import { useConfig, type FeatureKey } from "@/hooks/useConfig";
import { useEffect, useRef, useCallback, useState, type JSX } from "react";
import { AmbienceMixer } from "./sidebar/AmbienceMixer";
import { Skeleton } from "./ui/skeleton";
import { VERSION } from "@/app//changelog/CHANGELOG";
import { usePomo } from "@/hooks/PomoContext";
import { useShortcutsDialog, SHORTCUTS } from "@/hooks/useShortcuts";
import { Kbd } from "@/components/ui/kbd";
import { FaRegKeyboard } from "react-icons/fa6";
import { useProjects } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

type NavItem = {
  title: string;
  url: string;
  icon: JSX.Element;
  feature?: FeatureKey;
};

/** Everyday destinations: always on screen. */
const pinnedItems: NavItem[] = [
  { title: "Home", url: "/", icon: <FaHome /> },
  { title: "Focus", url: "/focus", icon: <IoIosTimer /> },
  { title: "Calendar", url: "/calendar", icon: <FaCalendarAlt />, feature: "calendar" },
  { title: "Projects", url: "/projects", icon: <FaProjectDiagram />, feature: "projects" },
];

/** Occasional destinations: tucked under "More" until needed. */
const moreItems: NavItem[] = [
  { title: "Focus Table", url: "/focus-table", icon: <FaTable /> },
  { title: "AI Chat (BETA)", url: "/ai", icon: <BsStars />, feature: "aiChat" },
  { title: "Excalidraw", url: "/excalidraw", icon: <FaPenNib />, feature: "excalidraw" },
  { title: "Rewards", url: "/rewards", icon: <FaCoffee />, feature: "rewards" },
  { title: "Changelog", url: "/changelog", icon: <FaReadme /> },
];

const MORE_OPEN_KEY = "bitf.sidebar.more-open";

export function AppSidebar(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { pause, state, start } = usePomo();
  const { loadConfig, loadingConfig, featureToggles } = useConfig();
  const { loadProjects } = useProjects();
  const { state: sidebarState } = useSidebar();

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

  const visible = (list: NavItem[]) =>
    list.filter((item) => !item.feature || featureToggles[item.feature]);

  const pinned = visible(pinnedItems);
  const more = visible(moreItems);

  const isActive = (url: string) =>
    url === "/"
      ? pathname === "/"
      : pathname === url || pathname.startsWith(`${url}/`);

  const activeInMore = more.some((item) => isActive(item.url));

  // "More" remembers how it was left, but always opens itself when the current
  // page lives inside it — a hidden active row would be disorienting.
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(MORE_OPEN_KEY) === "1";
    } catch {
      stored = false;
    }
    setMoreOpen(stored || activeInMore);
  }, [activeInMore]);

  const handleMoreOpenChange = (open: boolean) => {
    setMoreOpen(open);
    try {
      localStorage.setItem(MORE_OPEN_KEY, open ? "1" : "0");
    } catch {
      // Storage can be unavailable (private mode); navigation still works.
    }
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item.url);
    const shortcut = SHORTCUTS.find((s) => s.action === "nav" && s.href === item.url);
    const shortcutKey = shortcut ? shortcut.keys[0] : null;

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          isActive={active}
          className={cn(
            "group/nav relative h-9 gap-2.5 rounded-lg px-2.5 transition-colors duration-150",
            "[&>svg]:size-4 [&>svg]:shrink-0",
            active
              ? "font-medium text-foreground data-[active=true]:bg-primary/12 data-[active=true]:hover:bg-primary/12 [&>svg]:text-primary"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          )}
          onClick={(e) => handleNavigation(item.url, e)}
        >
          {active && (
            <span className="pointer-events-none absolute inset-y-1.5 -left-1 w-1 rounded-full bg-primary" />
          )}
          {item.icon}
          <span className="truncate">{item.title}</span>
          {shortcutKey && sidebarState !== "collapsed" && (
            <Kbd
              className={cn(
                "ml-auto pointer-events-none transition-opacity duration-150",
                active ? "opacity-100" : "opacity-0 group-hover/nav:opacity-100"
              )}
            >
              {shortcutKey}
            </Kbd>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r-0">
      {/* ── Header: profile card ── */}
      <SidebarHeader className="p-3 pb-2">
        <UserConfigButton loadingConfig={loadingConfig} />
      </SidebarHeader>

      {/* ── Navigation ── */}
      <SidebarContent className="gap-2 px-3">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 pl-1">{pinned.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {more.length > 0 && (
          <Collapsible open={moreOpen} onOpenChange={handleMoreOpenChange}>
            <SidebarGroup className="p-0">
              <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70 transition-colors hover:text-foreground">
                <FaChevronRight
                  className={cn(
                    "size-2.5 transition-transform duration-200",
                    moreOpen && "rotate-90"
                  )}
                />
                More
                {!moreOpen && activeInMore && (
                  <span className="ml-1 size-1.5 rounded-full bg-primary" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent className="pt-0.5">
                  <SidebarMenu className="gap-0.5 pl-1">{more.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* ── Ambience mixer ── */}
        <SidebarGroup className="mt-auto rounded-xl bg-sidebar-accent/50 p-1.5">
          <SidebarGroupContent>
            <AmbienceMixer />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: theme, shortcuts, version ── */}
      <SidebarFooter className="p-3 pt-2">
        <div className="flex items-center justify-between rounded-xl bg-sidebar-accent/50 px-2 py-1.5">
          <div className="flex items-center gap-1">
            <ThemeIconButton />
            <ShortcutsButton />
          </div>
          <span className="select-none pr-1 font-mono text-[10px] tracking-wider text-muted-foreground/60">
            {VERSION}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// ── Keyboard shortcuts button that opens the help dialog ──

function ShortcutsButton(): JSX.Element {
  const { setHelpOpen } = useShortcutsDialog();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="group/kbd relative size-8 rounded-lg hover:bg-background"
      title="Keyboard shortcuts (?)"
      onClick={() => setHelpOpen(true)}
    >
      <FaRegKeyboard className="size-3.5 transition-opacity group-hover/kbd:opacity-0" />
      <Kbd className="absolute inset-0 m-auto size-fit border-0 bg-transparent opacity-0 transition-opacity group-hover/kbd:opacity-100">
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
  const [currentTheme, setCurrentTheme] = useState<ThemeDefinition | null>(null);

  useEffect(() => {
    const foundTheme = THEMES.find((t) => t.value === theme);
    setCurrentTheme(foundTheme || THEMES[0]);
  }, [theme, setTheme]);

  if (!currentTheme) {
    return <Skeleton className="size-8 rounded-lg" />;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg hover:bg-background"
          title="Change theme"
        >
          <ThemeIcon theme={currentTheme} />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-44 rounded-xl p-1.5">
        <div className="flex flex-col gap-0.5">
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                theme === t.value
                  ? "bg-primary/12 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
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

  const years = today.diff(birthDate, "year");
  const months = today.diff(birthDate.add(years, "year"), "month");
  const days = today.diff(birthDate.add(years, "year").add(months, "month"), "day");
  return { years, months, days };
};

function UserConfigButton({ loadingConfig }: { loadingConfig: boolean }): JSX.Element {
  const { name, dob } = useConfig();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const hasName = name && name !== "NULL" && name.trim() !== "";
  const hasDob = !!dob;
  const age = dob ? calculateAge(new Date(dob)) : null;

  if (loadingConfig) {
    return <Skeleton className="h-14 w-full rounded-xl" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-14 w-full justify-start gap-2.5 rounded-xl bg-sidebar-accent/50 px-2.5 hover:bg-sidebar-accent"
        >
          {hasName || user ? (
            <AccountAvatar seed={name} className="size-9 shrink-0 shadow-sm" />
          ) : (
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-background shadow-xs">
              <FaUser className="size-3.5 text-muted-foreground" />
            </div>
          )}
          <div className="flex min-w-0 flex-col items-start text-left">
            {hasName || user ? (
              <span className="w-full truncate text-sm font-medium text-foreground">
                {hasName ? name : user?.name || "Connected"}
              </span>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">
                Guest profile
              </span>
            )}
            {hasDob && age ? (
              <span className="w-full truncate font-mono text-[11px] text-muted-foreground">
                {age.years}y {age.months}m {age.days}d
              </span>
            ) : hasName ? (
              <span className="text-[11px] font-medium text-primary/80">
                Set date of birth
              </span>
            ) : (
              <span className="text-[11px] font-medium text-primary/80">
                Add your details
              </span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="max-h-[min(34rem,calc(100vh-5rem))] w-80 overflow-y-auto rounded-xl p-0"
      >
        <EditConfigForm onSave={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
