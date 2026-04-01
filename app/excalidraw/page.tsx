"use client";

import type { JSX } from "react";
import { useEffect, useState, Suspense, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useExcalidraw } from "@/hooks/useExcalidraw";
import { type ExcalidrawScene, type ExcalidrawSceneData } from "@/lib/db";
import { toast } from "sonner";
import type { ComponentProps } from "react";
import type { Excalidraw as ExcalidrawComponent } from "@excalidraw/excalidraw";

// Import Excalidraw styles
import "@excalidraw/excalidraw/index.css";

// Dynamically import the ExcalidrawCanvas component with SSR disabled
const ExcalidrawCanvas = dynamic(
  () => import("./ExcalidrawCanvas").then((mod) => mod.ExcalidrawCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading Excalidraw...</p>
      </div>
    ),
  }
);

interface ExcalidrawSceneLoadable extends ExcalidrawScene {
  sceneData: string | ExcalidrawSceneData;
}

const AUTOSAVE_DEBOUNCE_MS = 1000;

type ExcalidrawOnChange = NonNullable<
  ComponentProps<typeof ExcalidrawComponent>["onChange"]
>;

export default function ExcalidrawPage(): JSX.Element {
  const { scenes, loadScenes, saveScene, deleteScene, setCurrentScene, saveAutosave, autosaveScene, currentScene, loading } =
    useExcalidraw();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [sceneTitle, setSceneTitle] = useState("");
  const [scenesListOpen, setScenesListOpen] = useState(false);
  const [currentSceneData, setCurrentSceneData] =
    useState<ExcalidrawSceneData | null>(null);
  const [appState] = useState<Record<string, unknown>>({
    theme: "dark",
  });
  const [isReady, setIsReady] = useState(false);
  const prevSceneDataRef = useRef<ExcalidrawSceneData | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadScenes();
  }, [loadScenes]);

  // Handle initial load from autosave if no current scene is set
  useEffect(() => {
    // Only proceed once we've finished loading from the database
    if (loading || isReady) return;

    if (autosaveScene?.sceneData && !currentScene) {
      let sceneData: ExcalidrawSceneData;
      if (typeof autosaveScene.sceneData === "string") {
        try {
          sceneData = JSON.parse(autosaveScene.sceneData as string) as ExcalidrawSceneData;
        } catch (e) {
          console.error("Failed to parse autosave scene data:", e);
          setIsReady(true);
          return;
        }
      } else {
        sceneData = autosaveScene.sceneData as ExcalidrawSceneData;
      }
      
      prevSceneDataRef.current = sceneData;
      setCurrentSceneData(sceneData);
      setIsReady(true);
    } else {
      // If there's no autosave, or currentScene is already set, mark as ready
      setIsReady(true);
    }
  }, [autosaveScene, loading, currentScene, isReady]);

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  const handleOnChange: ExcalidrawOnChange = useCallback(
    (elements, appStateData) => {
      // Don't process changes until we are ready
      if (!isReady) return;

      // Filter appState to keep only what's necessary for saving
      // This is optional but can help with performance
      const {
        theme,
        viewBackgroundColor,
        currentItemFontFamily,
        currentItemFontSize,
        // ... add other relevant state properties if needed
      } = appStateData;

      const newSceneData: ExcalidrawSceneData = {
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements,
        appState: {
          theme,
          viewBackgroundColor,
          currentItemFontFamily,
          currentItemFontSize,
        },
      };

      try {
        const serializedNew = JSON.stringify(newSceneData);
        if (serializedNew !== JSON.stringify(prevSceneDataRef.current)) {
          prevSceneDataRef.current = newSceneData;
          setCurrentSceneData(newSceneData);

          if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
          }

          autosaveTimeoutRef.current = setTimeout(() => {
            saveAutosave(newSceneData);
          }, AUTOSAVE_DEBOUNCE_MS);
        }
      } catch {
        console.warn("Scene comparison error");
      }
    },
    [saveAutosave, isReady]
  );

  const openSaveDialog = () => {
    if (currentScene) {
      setSceneTitle(currentScene.title);
    } else {
      setSceneTitle("");
    }
    setSaveDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentSceneData || !sceneTitle.trim()) {
      toast.error("Please enter a title for your drawing");
      return;
    }

    try {
      const normalizedTitle = sceneTitle.trim();
      // Look for an existing scene with the same title to prevent duplicates
      const existingSceneWithSameTitle = scenes.find(
        (s) => s.title.toLowerCase() === normalizedTitle.toLowerCase() && s.id !== "__autosave__"
      );

      const targetId = currentScene?.id || existingSceneWithSameTitle?.id;

      await saveScene({
        id: targetId, // Overwrite if we have a current scene OR a scene with the same name
        title: normalizedTitle,
        sceneData: currentSceneData,
      });

      toast.success(targetId ? "Scene updated successfully" : "Scene saved successfully");
      setSaveDialogOpen(false);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save scene");
    }
  };

  const handleLoadScene = (scene: ExcalidrawSceneLoadable) => {
    // Handle both serialized (string) and parsed data
    let sceneData: ExcalidrawSceneData;
    if (typeof scene.sceneData === "string") {
      try {
        sceneData = JSON.parse(scene.sceneData) as ExcalidrawSceneData;
      } catch (e) {
        console.error("Failed to parse scene data:", e);
        toast.error("Failed to load scene");
        return;
      }
    } else {
      sceneData = scene.sceneData as ExcalidrawSceneData;
    }
    
    // We update these first so ExcalidrawCanvas gets them on remount
    setCurrentSceneData(sceneData);
    prevSceneDataRef.current = sceneData;
    setCurrentScene(scene);
    setScenesListOpen(false);
    toast.success(scene.id === "__autosave__" ? "Autosave loaded" : `Loaded: ${scene.title}`);
  };

  const handleDeleteScene = async (id: number | string, event: React.MouseEvent) => {
    if (id === "__autosave__") {
      toast.error("Cannot delete autosaved scene");
      return;
    }
    event.stopPropagation();
    try {
      await deleteScene(id);
      toast.success("Scene deleted");
    } catch {
      toast.error("Failed to delete scene");
    }
  };

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading Excalidraw...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-[calc(100vh-3.5rem)] relative">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading Excalidraw...</p>
          </div>
        }
      >
        <ExcalidrawCanvas
          currentSceneId={currentScene?.id}
          currentSceneData={currentSceneData}
          appState={appState}
          scenesListOpen={scenesListOpen}
          setScenesListOpen={setScenesListOpen}
          scenes={scenes}
          handleLoadScene={handleLoadScene}
          handleDeleteScene={handleDeleteScene}
          setSaveDialogOpen={openSaveDialog}
          handleOnChange={handleOnChange}
        />
      </Suspense>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Scene</DialogTitle>
            <DialogDescription>
              Give your drawing a title to save it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                id="title"
                value={sceneTitle}
                onChange={(e) => setSceneTitle(e.target.value)}
                placeholder="My Drawing"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
