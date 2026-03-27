import { create } from "zustand";
import db, { type ExcalidrawScene } from "@/lib/db";

const AUTOSAVE_SCENE_ID = "__autosave__";

interface ExcalidrawState {
  scenes: ExcalidrawScene[];
  currentScene: ExcalidrawScene | null;
  autosaveScene: ExcalidrawScene | null;
  loading: boolean;
  loadScenes: () => Promise<void>;
  saveScene: (scene: Partial<ExcalidrawScene> & { title: string; sceneData: unknown }) => Promise<void>;
  updateScene: (id: number | string, updates: Partial<ExcalidrawScene>) => Promise<void>;
  deleteScene: (id: number | string) => Promise<void>;
  setCurrentScene: (scene: ExcalidrawScene | null) => void;
  saveAutosave: (sceneData: unknown) => Promise<void>;
  loadAutosave: () => Promise<ExcalidrawScene | null>;
}

export const useExcalidraw = create<ExcalidrawState>((set, get) => ({
  scenes: [],
  currentScene: null,
  autosaveScene: null,
  loading: true,

  loadScenes: async () => {
    set({ loading: true });
    try {
      const allScenes = await db.excalidraw.toArray();
      const autosave = allScenes.find((s) => s.id === AUTOSAVE_SCENE_ID) ?? null;
      const userScenes = allScenes.filter((s) => s.id !== AUTOSAVE_SCENE_ID).sort((a, b) => 
        (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)
      );
      
      // Parse serialized sceneData for all scenes
      const parsedUserScenes = userScenes.map((scene) => {
        let parsedData = scene.sceneData;
        if (typeof scene.sceneData === "string") {
          try {
            parsedData = JSON.parse(scene.sceneData as string);
          } catch (e) {
            console.error("Failed to parse scene data:", e);
          }
        }
        return { ...scene, sceneData: parsedData };
      });

      let parsedAutosave = autosave;
      if (parsedAutosave && typeof parsedAutosave.sceneData === "string") {
        try {
          parsedAutosave = { ...parsedAutosave, sceneData: JSON.parse(parsedAutosave.sceneData as string) };
        } catch (e) {
          console.error("Failed to parse autosave data:", e);
        }
      }

      set({ scenes: parsedUserScenes, autosaveScene: parsedAutosave, loading: false });
    } catch (error) {
      console.error("Failed to load Excalidraw scenes:", error);
      set({ loading: false });
    }
  },

  saveScene: async (scene) => {
    // Serialize sceneData to JSON string for consistent storage
    let serializedData: string;
    try {
      serializedData = typeof scene.sceneData === "string" 
        ? scene.sceneData 
        : JSON.stringify(scene.sceneData);
    } catch (error) {
      console.error("Failed to serialize scene data:", error);
      return;
    }

    const id = scene.id || Date.now();
    const now = new Date();
    const sceneToSave: ExcalidrawScene = {
      ...scene,
      id,
      sceneData: serializedData,
      createdAt: (scene as ExcalidrawScene).createdAt || now,
      updatedAt: now,
    };

    await db.excalidraw.put(sceneToSave);
    
    // Convert back to parsed for store consistency
    const parsedScene = { ...sceneToSave, sceneData: JSON.parse(serializedData) };

    set((state) => {
      const filteredScenes = state.scenes.filter(s => s.id !== id);
      return {
        scenes: [parsedScene, ...filteredScenes],
        currentScene: parsedScene,
      };
    });
  },

  updateScene: async (id, updates) => {
    const existing = await db.excalidraw.get(id);
    if (!existing) return;

    // Serialize sceneData if present in updates
    const processedUpdates = { ...updates };
    if (updates.sceneData !== undefined) {
      try {
        processedUpdates.sceneData = typeof updates.sceneData === "string"
          ? updates.sceneData
          : JSON.stringify(updates.sceneData);
      } catch (error) {
        console.error("Failed to serialize scene data:", error);
        return;
      }
    }
    
    const now = new Date();
    await db.excalidraw.update(id, { ...processedUpdates, updatedAt: now });
    
    const updatedScene = { ...existing, ...processedUpdates, updatedAt: now };
    // Parse it back for the state
    if (typeof updatedScene.sceneData === "string") {
      try {
        updatedScene.sceneData = JSON.parse(updatedScene.sceneData as string);
      } catch (e) {}
    }

    set((state) => ({
      scenes: state.scenes.map((s) =>
        s.id === id ? updatedScene : s
      ),
      currentScene:
        state.currentScene?.id === id
          ? updatedScene
          : state.currentScene,
    }));
  },

  deleteScene: async (id) => {
    await db.excalidraw.delete(id);
    set((state) => ({
      scenes: state.scenes.filter((s) => s.id !== id),
      currentScene: state.currentScene?.id === id ? null : state.currentScene,
    }));
  },

  setCurrentScene: (scene) => {
    set({ currentScene: scene });
  },

  saveAutosave: async (sceneData) => {
    const now = new Date();
    
    // Serialize to JSON string to ensure it's storable in IndexedDB
    let serializedData: string;
    try {
      serializedData = JSON.stringify(sceneData);
    } catch (error) {
      console.error("Failed to serialize scene data:", error);
      return;
    }

    const autosaveEntry: ExcalidrawScene = {
      id: AUTOSAVE_SCENE_ID,
      title: "Autosaved",
      sceneData: serializedData,
      createdAt: now, // Will be updated if already exists but put handles it
      updatedAt: now,
    };

    // Use put to either insert or update the autosave record
    await db.excalidraw.put(autosaveEntry);
    
    // Store parsed version in zustand state
    const parsedAutosave = { ...autosaveEntry, sceneData: JSON.parse(serializedData) };
    set({ autosaveScene: parsedAutosave });
  },

  loadAutosave: async () => {
    try {
      const autosave = await db.excalidraw.get(AUTOSAVE_SCENE_ID);
      if (autosave) {
        // Parse the serialized data back
        let parsedData = autosave.sceneData;
        if (typeof autosave.sceneData === "string") {
          try {
            parsedData = JSON.parse(autosave.sceneData as string);
          } catch (e) {
            console.error("Failed to parse autosave data:", e);
          }
        }
        const parsedAutosave = { ...autosave, sceneData: parsedData };
        set({ autosaveScene: parsedAutosave });
        return parsedAutosave;
      }
      return null;
    } catch (error) {
      console.error("Failed to load autosave:", error);
      return null;
    }
  },
}));
