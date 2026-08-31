export type AIProvider = "openai-compatible" | "groq" | "google" | "custom";

export interface AIModel {
  id: string;
  name: string;
  provider?: string;
  description?: string;
}

export interface EndpointPreset {
  id: string;
  label: string;
  baseUrl: string;
  placeholderKey: string;
  defaultModel: string;
  description?: string;
}

export const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_MODEL_ID = "llama-3.3-70b-versatile";

export const ENDPOINT_PRESETS: EndpointPreset[] = [
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    placeholderKey: "gsk_…",
    defaultModel: "llama-3.3-70b-versatile",
    description: "Ultra-fast inference with open-source models",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    placeholderKey: "sk-…",
    defaultModel: "gpt-4o-mini",
    description: "Standard OpenAI GPT models",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    placeholderKey: "sk-or-…",
    defaultModel: "google/gemini-2.0-flash-001",
    description: "Access 200+ models with one unified API",
  },
  {
    id: "google",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    placeholderKey: "AIza…",
    defaultModel: "gemini-2.0-flash",
    description: "Google Gemini via OpenAI-compatible endpoint",
  },
  {
    id: "ollama",
    label: "Ollama (Local)",
    baseUrl: "http://localhost:11434/v1",
    placeholderKey: "Optional (not required for local)",
    defaultModel: "llama3.2",
    description: "Local inference running on your machine",
  },
  {
    id: "custom",
    label: "Custom",
    baseUrl: "",
    placeholderKey: "API Key (if required)",
    defaultModel: "",
    description: "Custom OpenAI-compatible API endpoint",
  },
];

export const FALLBACK_MODELS: AIModel[] = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  { id: "qwen/qwen3.6-27b", name: "Qwen 3.6 27B" },
];

export const AI_MODELS: AIModel[] = FALLBACK_MODELS;

export function modelProvider(model?: AIModel): AIProvider {
  return (model?.provider as AIProvider | undefined) ?? "openai-compatible";
}

export const PROVIDER_LABELS: Record<string, string> = {
  groq: "Groq",
  google: "Google",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  "openai-compatible": "OpenAI Compatible",
  custom: "Custom",
};

/**
 * Check if a URL points to a local machine endpoint where an API key may not be required
 */
export function isLocalEndpoint(url?: string): boolean {
  if (!url) return false;
  try {
    const raw = url.trim();
    const parsed = new URL(raw.startsWith("http://") || raw.startsWith("https://") ? raw : `http://${raw}`);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.16.")
    );
  } catch {
    return false;
  }
}
