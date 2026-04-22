"use client";

import { create } from "zustand";
import db, { type AIChat, type AIConfig } from "@/lib/db";
import { DEFAULT_MODEL_ID } from "@/lib/ai-models";
import type { UIMessage as Message } from "ai";

interface AIChatState {
  chats: AIChat[];
  aiConfig: AIConfig | null;
  loading: boolean;

  loadChats: () => Promise<void>;
  createChat: (modelId: string, provider: string, firstMessage?: string) => Promise<AIChat>;
  deleteChat: (id: string) => Promise<void>;
  updateChatTitle: (id: string, title: string) => Promise<void>;
  saveMessages: (chatId: string, messages: Message[]) => Promise<void>;
  loadMessages: (chatId: string) => Promise<Message[]>;
  loadAIConfig: () => Promise<void>;
  saveAIConfig: (config: Partial<Omit<AIConfig, "key">>) => Promise<void>;
}

export const useAIChat = create<AIChatState>((set, get) => ({
  chats: [],
  aiConfig: null,
  loading: false,

  loadChats: async () => {
    set({ loading: true });
    try {
      const chats = await db.aiChats.orderBy("updatedAt").reverse().toArray();
      set({ chats });
    } finally {
      set({ loading: false });
    }
  },

  createChat: async (modelId, provider, firstMessage) => {
    const now = new Date();
    const chat: AIChat = {
      id: crypto.randomUUID(),
      title: firstMessage ? firstMessage.slice(0, 60) : "New Chat",
      modelId,
      provider,
      messages: "[]",
      createdAt: now,
      updatedAt: now,
    };
    await db.aiChats.add(chat);
    set((state) => ({ chats: [chat, ...state.chats] }));
    return chat;
  },

  deleteChat: async (id) => {
    await db.aiChats.delete(id);
    set((state) => ({ chats: state.chats.filter((c) => c.id !== id) }));
  },

  updateChatTitle: async (id, title) => {
    await db.aiChats.update(id, { title, updatedAt: new Date() });
    set((state) => ({
      chats: state.chats.map((c) => (c.id === id ? { ...c, title } : c)),
    }));
  },

  saveMessages: async (chatId, messages) => {
    const serialized = JSON.stringify(messages);
    const now = new Date();
    await db.aiChats.update(chatId, { messages: serialized, updatedAt: now });
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, messages: serialized, updatedAt: now } : c
      ),
    }));
  },

  loadMessages: async (chatId) => {
    const chat = await db.aiChats.get(chatId);
    if (!chat) return [];
    try {
      return JSON.parse(chat.messages) as Message[];
    } catch {
      return [];
    }
  },

  loadAIConfig: async () => {
    const config = await db.aiConfig.get("default");
    if (config) {
      set({ aiConfig: config });
    } else {
      const defaultConfig: AIConfig = {
        key: "default",
        groqApiKey: "",
        googleApiKey: "",
        customContextEnabled: false,
        customPrompt: "",
        defaultModelId: DEFAULT_MODEL_ID,
      };
      set({ aiConfig: defaultConfig });
    }
  },

  saveAIConfig: async (partial) => {
    const current = get().aiConfig;
    const updated: AIConfig = {
      key: "default",
      groqApiKey: "",
      googleApiKey: "",
      customContextEnabled: false,
      customPrompt: "",
      defaultModelId: DEFAULT_MODEL_ID,
      ...current,
      ...partial,
    };
    await db.aiConfig.put(updated);
    set({ aiConfig: updated });
  },
}));
