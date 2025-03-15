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
import { FaMoon, FaSun } from "react-icons/fa";
import { FaGear } from "react-icons/fa6";
import { useTheme } from "next-themes";
import EditConfig from "./sidebar/EditConfig";

const items = [
  {
    title: "Home",
    url: "#",
    icon: "",
  },
  {
    title: "Inbox",
    url: "#",
    icon: "",
  },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <EditConfig />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      {/* <item.icon /> */}
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <ThemeSelector />
      </SidebarFooter>
    </Sidebar>
  );
}

const ThemeSelector = () => {
  const { setTheme, theme } = useTheme();
  return (
    <>
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
    </>
  );
};
