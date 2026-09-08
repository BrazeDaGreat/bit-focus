"use client";

import { create } from "zustand";
import db, { type AIChat, type AIConfig } from "@/lib/db";
import { DEFAULT_MODEL_ID, DEFAULT_BASE_URL, FALLBACK_MODELS, type AIModel, isLocalEndpoint } from "@/lib/ai-models";
import type { UIMessage as Message } from "ai";

const DEFAULT_SYSTEM_PROMPT = `You are BIT Focus AI, a highly optimized assistant tuned for productivity coaching.
Adopt an encouraging, analytical, and highly structured tone.
Prioritize helping the user track focus sessions, analyze breakdowns, and manage reward points.
Provide concise, actionable advice without conversational filler, using markdown for readability.`;

const CACHED_MODELS_KEY = "bitfocus.ai.cached_models";

function loadInitialCachedModels(): AIModel[] {
  if (typeof window === "undefined") return FALLBACK_MODELS;
  try {
    const raw = localStorage.getItem(CACHED_MODELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return FALLBACK_MODELS;
}

interface AIChatState {
  chats: AIChat[];
  aiConfig: AIConfig | null;
  models: AIModel[];
  loading: boolean;
  fetchingModels: boolean;
  modelFetchError: string | null;

  loadChats: () => Promise<void>;
  createChat: (modelId: string, provider?: string, firstMessage?: string) => Promise<AIChat>;
  deleteChat: (id: string) => Promise<void>;
  updateChatTitle: (id: string, title: string) => Promise<void>;
  generateChatTitle: (id: string, exchange: string) => Promise<void>;
  toggleChatPinned: (id: string) => Promise<void>;
  setChatContextSources: (id: string, sources: string[]) => Promise<void>;
  saveMessages: (chatId: string, messages: Message[]) => Promise<void>;
  loadMessages: (chatId: string) => Promise<Message[]>;
  loadAIConfig: () => Promise<void>;
  saveAIConfig: (config: Partial<Omit<AIConfig, "key">>) => Promise<void>;
  fetchModels: (customBaseUrl?: string, customApiKey?: string) => Promise<AIModel[]>;
  setModels: (models: AIModel[]) => void;
}

export const useAIChat = create<AIChatState>((set, get) => ({
  chats: [],
  aiConfig: null,
  models: loadInitialCachedModels(),
  loading: false,
  fetchingModels: false,
  modelFetchError: null,

  setModels: (models: AIModel[]) => {
    set({ models });
    try {
      localStorage.setItem(CACHED_MODELS_KEY, JSON.stringify(models));
    } catch {}
  },

  loadChats: async () => {
    set({ loading: true });
    try {
      const chats = await db.aiChats.orderBy("updatedAt").reverse().toArray();
      set({ chats });
    } finally {
      set({ loading: false });
    }
  },

  createChat: async (modelId, provider = "openai-compatible", firstMessage) => {
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

  /**
   * Ask the configured model to name a conversation from its opening exchange.
   * Silent on failure — the chat keeps whatever title it has.
   */
  generateChatTitle: async (id, exchange) => {
    const config = get().aiConfig;
    const chat = get().chats.find((c) => c.id === id);
    if (!config?.baseUrl || !chat) return;

    try {
      const res = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey || "",
          modelId: chat.modelId,
          exchange,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.title) {
        await get().updateChatTitle(id, data.title);
      }
    } catch {
      // A conversation without a generated name is still perfectly usable.
    }
  },

  toggleChatPinned: async (id) => {
    const chat = get().chats.find((c) => c.id === id);
    if (!chat) return;
    const pinned = !chat.pinned;
    await db.aiChats.update(id, { pinned, updatedAt: new Date() });
    set((state) => ({
      chats: state.chats.map((c) => (c.id === id ? { ...c, pinned } : c)),
    }));
  },

  setChatContextSources: async (id, sources) => {
    const serialized = JSON.stringify(sources);
    await db.aiChats.update(id, { contextSources: serialized });
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === id ? { ...c, contextSources: serialized } : c
      ),
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

  fetchModels: async (customBaseUrl?: string, customApiKey?: string) => {
    const config = get().aiConfig;
    const baseUrl =
      customBaseUrl !== undefined
        ? customBaseUrl
        : config?.baseUrl || DEFAULT_BASE_URL;
    const apiKey =
      customApiKey !== undefined
        ? customApiKey
        : config?.apiKey || config?.groqApiKey || config?.googleApiKey || "";

    if (!baseUrl || !baseUrl.trim()) {
      return get().models;
    }

    set({ fetchingModels: true, modelFetchError: null });
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.error) {
        // If server-side proxy failed and this is a local endpoint, try direct client fetch
        if (isLocalEndpoint(baseUrl)) {
          try {
            const rawUrl = baseUrl.trim().replace(/\/+$/, "");
            const modelsUrl = rawUrl.endsWith("/models") ? rawUrl : `${rawUrl}/models`;
            const localHeaders: Record<string, string> = { "Content-Type": "application/json" };
            if (apiKey?.trim()) {
              localHeaders["Authorization"] = `Bearer ${apiKey.trim()}`;
            }
            const directRes = await fetch(modelsUrl, { method: "GET", headers: localHeaders });
            if (directRes.ok) {
              const directData = await directRes.json();
              const list: { id: string; name: string }[] = Array.isArray(directData?.data)
                ? directData.data.map((m: { id?: string; name?: string }) => ({
                    id: m.id || m.name || "",
                    name: m.name || m.id || "",
                  })).filter((m: { id: string; name: string }) => Boolean(m.id))
                : Array.isArray(directData?.models)
                ? directData.models.map((m: { id?: string; name?: string; model?: string }) => ({
                    id: m.id || m.model || m.name || "",
                    name: m.name || m.model || m.id || "",
                  })).filter((m: { id: string; name: string }) => Boolean(m.id))
                : [];
              if (list.length > 0) {
                set({ models: list, modelFetchError: null });
                try {
                  localStorage.setItem(CACHED_MODELS_KEY, JSON.stringify(list));
                } catch {}
                return list;
              }
            }
          } catch {}
        }

        const errorMsg = data?.error || `Failed to fetch models (${res.status})`;
        set({ modelFetchError: errorMsg });
        return get().models;
      }

      if (Array.isArray(data?.models)) {
        if (data.models.length > 0) {
          set({ models: data.models, modelFetchError: null });
          try {
            localStorage.setItem(CACHED_MODELS_KEY, JSON.stringify(data.models));
          } catch {}
          return data.models;
        } else {
          set({ modelFetchError: "Endpoint returned 0 models" });
          return get().models;
        }
      }
      return get().models;
    } catch (err) {
      // Local fallback on network error
      if (isLocalEndpoint(baseUrl)) {
        try {
          const rawUrl = baseUrl.trim().replace(/\/+$/, "");
          const modelsUrl = rawUrl.endsWith("/models") ? rawUrl : `${rawUrl}/models`;
          const localHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (apiKey?.trim()) {
            localHeaders["Authorization"] = `Bearer ${apiKey.trim()}`;
          }
          const directRes = await fetch(modelsUrl, { method: "GET", headers: localHeaders });
          if (directRes.ok) {
            const directData = await directRes.json();
            const list: { id: string; name: string }[] = Array.isArray(directData?.data)
              ? directData.data.map((m: { id?: string; name?: string }) => ({
                  id: m.id || m.name || "",
                  name: m.name || m.id || "",
                })).filter((m: { id: string; name: string }) => Boolean(m.id))
              : Array.isArray(directData?.models)
              ? directData.models.map((m: { id?: string; name?: string; model?: string }) => ({
                  id: m.id || m.model || m.name || "",
                  name: m.name || m.model || m.id || "",
                })).filter((m: { id: string; name: string }) => Boolean(m.id))
              : [];
            if (list.length > 0) {
              set({ models: list, modelFetchError: null });
              try {
                localStorage.setItem(CACHED_MODELS_KEY, JSON.stringify(list));
              } catch {}
              return list;
            }
          }
        } catch {}
      }

      const msg = err instanceof Error ? err.message : String(err);
      set({ modelFetchError: msg });
      return get().models;
    } finally {
      set({ fetchingModels: false });
    }
  },

  loadAIConfig: async () => {
    const config = await db.aiConfig.get("default");
    if (config) {
      let needsSave = false;

      // Migrate legacy groq / google keys to baseUrl & apiKey if missing
      if (!config.baseUrl) {
        if (config.groqApiKey) {
          config.baseUrl = "https://api.groq.com/openai/v1";
          config.apiKey = config.groqApiKey;
        } else if (config.googleApiKey) {
          config.baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/";
          config.apiKey = config.googleApiKey;
        } else {
          config.baseUrl = DEFAULT_BASE_URL;
        }
        needsSave = true;
      } else if (!config.apiKey) {
        if (config.groqApiKey) {
          config.apiKey = config.groqApiKey;
          needsSave = true;
        } else if (config.googleApiKey) {
          config.apiKey = config.googleApiKey;
          needsSave = true;
        }
      }

      if (!config.customPrompt || config.customPrompt.trim() === "") {
        config.customPrompt = DEFAULT_SYSTEM_PROMPT;
        needsSave = true;
      }

      if (needsSave) {
        await db.aiConfig.put(config);
      }

      set({ aiConfig: config });

      // If models cache is fallback and baseUrl is configured, trigger a background fetch
      if (config.baseUrl) {
        get().fetchModels(config.baseUrl, config.apiKey || "");
      }
    } else {
      const defaultConfig: AIConfig = {
        key: "default",
        baseUrl: DEFAULT_BASE_URL,
        apiKey: "",
        groqApiKey: "",
        googleApiKey: "",
        customContextEnabled: false,
        customPrompt: DEFAULT_SYSTEM_PROMPT,
        defaultModelId: DEFAULT_MODEL_ID,
      };
      await db.aiConfig.put(defaultConfig);
      set({ aiConfig: defaultConfig });
    }
  },

  saveAIConfig: async (partial) => {
    const current = get().aiConfig;
    const updated: AIConfig = {
      key: "default",
      baseUrl: DEFAULT_BASE_URL,
      apiKey: "",
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
