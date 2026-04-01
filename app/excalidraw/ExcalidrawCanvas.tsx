"use client";

import { type JSX } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawScene, ExcalidrawSceneData } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FaSave, FaFolderOpen, FaTrash, FaStar } from "react-icons/fa";
import { useExcalidraw } from "@/hooks/useExcalidraw";

interface ExcalidrawSceneItem extends ExcalidrawScene {
  sceneData: string | ExcalidrawSceneData;
}

interface ExcalidrawCanvasProps {
  currentSceneId: string | number | undefined;
  currentSceneData: ExcalidrawSceneData | null;
  appState: Record<string, unknown>;
  scenesListOpen: boolean;
  setScenesListOpen: (open: boolean) => void;
  scenes: ExcalidrawSceneItem[];
  handleLoadScene: (scene: ExcalidrawSceneItem) => void;
  handleDeleteScene: (id: number | string, event: React.MouseEvent) => Promise<void>;
  setSaveDialogOpen: (open: boolean) => void;
  handleOnChange: NonNullable<React.ComponentProps<typeof Excalidraw>["onChange"]>;
}

export function ExcalidrawCanvas({
  currentSceneId,
  currentSceneData,
  appState,
  scenesListOpen,
  setScenesListOpen,
  scenes,
  handleLoadScene,
  handleDeleteScene,
  setSaveDialogOpen,
  handleOnChange,
}: ExcalidrawCanvasProps): JSX.Element {
  const { autosaveScene } = useExcalidraw();

  return (
    <div className="w-full h-full excalidraw-container">
      <Excalidraw
        key={currentSceneId || "new-scene"}
        initialData={currentSceneData ?? undefined}
        onChange={handleOnChange}
        theme={appState.theme as "light" | "dark" | undefined}
        validateEmbeddable
        renderTopRightUI={() => (
          <div className="flex gap-1">
            <DropdownMenu open={scenesListOpen} onOpenChange={setScenesListOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Saved scenes"
                >
                  <FaFolderOpen className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Saved Scenes</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {autosaveScene && (
                  <DropdownMenuItem
                    onClick={() => handleLoadScene(autosaveScene)}
                    className="gap-2 cursor-pointer bg-muted/50"
                  >
                    <FaStar className="h-3 w-3 text-yellow-500" />
                    <div className="flex-1 truncate font-medium">Autosaved</div>
                  </DropdownMenuItem>
                )}

                {scenes.length === 0 && !autosaveScene ? (
                  <DropdownMenuItem disabled>No saved scenes</DropdownMenuItem>
                ) : (
                  scenes.map((scene) => (
                    <DropdownMenuItem
                      key={scene.id}
                      onClick={() => handleLoadScene(scene)}
                      className="gap-2 cursor-pointer"
                    >
                      <div className="flex-1 truncate">{scene.title}</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) =>
                          handleDeleteScene(
                            scene.id!,
                            e as unknown as React.MouseEvent
                          )
                        }
                      >
                        <FaTrash className="h-3 w-3" />
                      </Button>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSaveDialogOpen(true)}
              title="Save scene"
            >
              <FaSave className="h-4 w-4" />
            </Button>
          </div>
        )}
      />
    </div>
  );
}
