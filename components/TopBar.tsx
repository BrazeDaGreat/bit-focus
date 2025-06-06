"use client";

import { FaDiscord, FaGithub } from "react-icons/fa6";
import { Button } from "./ui/button";
import { SidebarTrigger } from "./ui/sidebar";
import TaskView from "./TaskView";

interface TopBarButtonProps {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  icon?: React.ReactNode;
}
function TopBarButton(props: TopBarButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={"size-7"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (props.onClick) {
          props.onClick(event);
        }
      }}
    >
      {props.icon}
    </Button>
  );
}

export default function TopBar() {
  return (
    <div className="px-2 py-2.5 border-b border-secondary flex items-center justify-between gap-2">
      <div className="flex items-center justify-start gap-2">
        <SidebarTrigger />
        <TopBarButton
          icon={<FaDiscord />}
          onClick={() => {
            window.open("https://discord.gg/XXkSFkdx8H", "_blank");
          }}
        />
        <TopBarButton
          icon={<FaGithub />}
          onClick={() =>
            window.open("https://github.com/BrazeDaGreat/bit-focus", "_blank")
          }
        />
      </div>
      <div className="">
        <TaskView />
        {/* <TopBarButton
          icon={<FaGithub />}
          onClick={() =>
            window.open("https://github.com/BrazeDaGreat/bit-focus", "_blank")
          }
        /> */}
      </div>
    </div>
  );
}
