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
import { FaCalendarCheck, FaHome, FaMoon, FaSun } from "react-icons/fa";
import { IoIosTimer } from "react-icons/io";
import { FaGear, FaReadme, FaFile, FaFolder, FaChevronDown, FaChevronRight } from "react-icons/fa6";
import { useTheme } from "next-themes";
import EditConfig, { EditConfigSkeleton } from "./sidebar/EditConfig";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useConfig } from "@/hooks/useConfig";
import { useEffect, useState } from "react";
import PomoFooterTimer from "./sidebar/PomoFooterTimer";
import { Skeleton } from "./ui/skeleton";
import { useNotes } from "@/hooks/useNotes";
import CreateNote from "./CreateNote";

const items = [
  { title: "Home", url: "/", icon: <FaHome /> },
  { title: "Tasks", url: "/tasks", icon: <FaCalendarCheck /> },
  { title: "Focus", url: "/focus", icon: <IoIosTimer /> },
  { title: "Changelog", url: "/changelog", icon: <FaReadme /> },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { loadConfig, loadingConfig } = useConfig();
  const { loadNotes, getChildNotes } = useNotes();
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>(
    {}
  );

  useEffect(() => {
    loadConfig();
    loadNotes();
  }, [loadConfig, loadNotes]);

  // Toggle a note's expanded state
  const toggleExpand = (id: number) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Recursive function to render notes hierarchically
  const renderNotes = (parentId: number | null = null, depth = 0) => {
    const childNotes = getChildNotes(parentId);
    return childNotes.map((note) => {
      const hasChildren = getChildNotes(note.id!).length > 0;
      const isExpanded = expandedNotes[note.id!] || false;
  
      return (
        <div key={note.id} className="flex flex-col">
          <div className="flex items-center">
            {/* Expand/Collapse Button */}
            {hasChildren && (
              <button
                onClick={() => toggleExpand(note.id!)}
                className="p-1 mr-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              >
                {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
              </button>
            )}
  
            {/* Note Link */}
            <SidebarMenuItem style={{ paddingLeft: `${depth * 1.5}rem` }}>
              <SidebarMenuButton
                asChild
                className="gap-2"
                isActive={pathname === `/notes/${note.id}`}
              >
                <Link href={`/notes/${note.id}`}>
                  {note.type === "document" ? <FaFile /> : <FaFolder />}
                  <span>{note.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </div>
  
          {/* Render Child Notes */}
          {hasChildren && isExpanded && (
            <div className="ml-4">{renderNotes(note.id, depth + 1)}</div>
          )}
        </div>
      );
    });
  };
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

          {/* Notes Section */}
          <SidebarGroup>
            <SidebarGroupLabel>Notes</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <CreateNote />
              </SidebarMenu>
              <SidebarMenu>{renderNotes()}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
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
        <SelectItem value="system">
          <FaGear /> System
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
