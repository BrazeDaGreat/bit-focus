"use client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IoColorPalette } from "react-icons/io5";
import { /*FaCalendarCheck,*/ FaHome, FaMoon, FaSun } from "react-icons/fa";
import { IoIosTimer } from "react-icons/io";
import { FaGear, FaReadme } from "react-icons/fa6";
import { useTheme } from "next-themes";
import EditConfig, { EditConfigSkeleton } from "./sidebar/EditConfig";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useConfig } from "@/hooks/useConfig";
import { useEffect } from "react";
import PomoFooterTimer from "./sidebar/PomoFooterTimer";
import { Skeleton } from "./ui/skeleton";
import { VERSION } from "@/app/changelog/CHANGELOG";

const items = [
  { title: "Home", url: "/", icon: <FaHome /> },
  // { title: "Tasks", url: "/tasks", icon: <FaCalendarCheck /> },
  { title: "Focus", url: "/focus", icon: <IoIosTimer /> },
  { title: "Changelog", url: "/changelog", icon: <FaReadme /> },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { loadConfig, loadingConfig } = useConfig();

  useEffect(() => {
    loadConfig();
    // localStorage.setItem("user-config-backup")
  }, [loadConfig]);

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          {loadingConfig ? <EditConfigSkeleton /> : <EditConfig />}
        </SidebarHeader>
        <SidebarContent>
          {/* Main Menu */}
          <SidebarGroup>
            <SidebarGroupLabel>BIT Focus</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className="gap-2"
                      style={{ padding: "1.5rem 0.5rem" }}
                      isActive={pathname === item.url}
                    >
                      <Link href={item.url}>
                        {item.icon}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <span className="text-center text-xs opacity-40 select-none">
            {VERSION}
          </span>
          <PomoFooterTimer />
          {loadingConfig ? <ThemeSelectorSkeleton /> : <ThemeSelector />}
        </SidebarFooter>
      </Sidebar>
    </>
  );
}

const ThemeSelectorSkeleton = () => <Skeleton className="h-9" />;
const ThemeSelector = () => {
  const { setTheme, theme } = useTheme();
  return (
    <Select
      onValueChange={(value) => setTheme(value)}
      defaultValue={theme ?? "system"}
    >
      <SelectTrigger className="w-full">
        <SelectValue
          placeholder={
            <span className="flex gap-2 items-center">
              <IoColorPalette /> Theme
            </span>
          }
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">
          <FaSun /> Light
        </SelectItem>
        <SelectItem value="dark">
          <FaMoon /> Dark
        </SelectItem>
        <SelectItem value="purple">
          <IoColorPalette className="text-purple-500" /> Purple
        </SelectItem>
        <SelectItem value="rose">
          <IoColorPalette className="text-rose-500" /> Rose
        </SelectItem>
        <SelectItem value="amoled">
          <IoColorPalette className="text-neutral-500" /> Amoled
        </SelectItem>
        <SelectItem value="system">
          <FaGear /> System
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
