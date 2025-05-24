import { create } from "zustand";
import db from "@/lib/db";

// Define Zustand store
interface ConfigState {
  name: string;
  dob: Date;
  webhook: string;
  loadingConfig: boolean;
  setConfig: (name: string, dob: Date, webhook: string) => Promise<void>;
  loadConfig: () => Promise<void>;
}

export const useConfig = create<ConfigState>((set) => ({
  name: "NULL",
  dob: new Date(),
  webhook: "",
  loadingConfig: true,

  setConfig: async (name, dob, webhook) => {
    console.log(name, dob, webhook);
    const existingConfig = await db.configuration.toCollection().first();
    if (existingConfig) {
      await db.configuration.delete(existingConfig.name);
      console.log("Previous entry deleted.");
    }
    await db.configuration.add({ name, dob, webhook });
    console.log("Config added successfully.");
    set({ name, dob, webhook });
  },

  loadConfig: async () => {
    set({ loadingConfig: true });
    try {
      const config = await db.configuration.toCollection().first();
      if (config) {
        set({
          name: config.name,
          dob: config.dob,
          webhook: config.webhook || "",
        });
      }
    } catch (error) {
      console.error("Failed to load configuration:", error);
    } finally {
      set({ loadingConfig: false });
    }
  },
}));
