export type AIProvider = "groq" | "google";

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description?: string;
}

export const AI_MODELS: AIModel[] = [
  // Groq
  { id: "openai/gpt-oss-120b", name: "GPT OSS 120B", provider: "groq" },
  { id: "openai/gpt-oss-20b", name: "GPT OSS 20B", provider: "groq" },
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile",
    provider: "groq",
  },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", provider: "groq" },
  { id: "qwen/qwen3-32b", name: "Qwen 3 32B", provider: "groq" },
  // Google — Gemma 4
  { id: "gemma-4-31b-it", name: "Gemma 4 31B", provider: "google" },
  { id: "gemma-4-26b-a4b-it", name: "Gemma 4 26B A4B", provider: "google" },
  // Google — Gemini
  {
    id: "gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite (Preview)",
    provider: "google",
  },
];

export const DEFAULT_MODEL_ID = "gemma-4-26b-a4b-it";

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  groq: "Groq",
  google: "Google",
};
