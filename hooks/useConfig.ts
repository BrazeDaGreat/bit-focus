import { create } from "zustand";
import db from "@/lib/db";

// Define Zustand store
interface ConfigState {
  name: string;
  dob: Date;
  setConfig: (name: string, dob: Date) => Promise<void>;
  loadConfig: () => Promise<void>;
}

export const useConfig = create<ConfigState>((set) => ({
  name: "NULL",
  dob: new Date(),

  setConfig: async (name, dob) => {
    console.log(name, dob);
    const existingConfig = await db.configuration.toCollection().first();
    if (existingConfig) {
      await db.configuration.delete(existingConfig.name);
      console.log("Previous entry deleted.");
    }
    await db.configuration.add({ name, dob });
    console.log("Config added successfully.");
    set({ name, dob });
  },

  loadConfig: async () => {
    const config = await db.configuration.toCollection().first();
    if (config) {
      set({ name: config.name, dob: config.dob });
    }
  },
}));
