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
    await db.configuration.put({ name, dob });
    set({ name, dob });
  },

  loadConfig: async () => {
    const config = await db.configuration.toCollection().first();
    if (config) {
      set({ name: config.name, dob: config.dob });
    }
  },
}));
