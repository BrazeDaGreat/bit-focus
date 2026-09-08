/**
 * Chat route.
 *
 * A thin proxy to whatever OpenAI-compatible endpoint the user configured. It
 * holds no keys of its own: the base URL and key arrive with each request from
 * the browser, are used once, and are never stored or logged.
 *
 * Tools are declared here but have no `execute`, which makes them client-side
 * tools: the model's call is streamed to the browser, run there against local
 * data, and the result streamed back for the next step.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, convertToModelMessages, smoothStream, stepCountIs } from "ai";
import type { UIMessage } from "ai";
import type { AIProvider } from "@/lib/ai-models";
import { AI_TOOLS } from "@/lib/ai-tools";

export const runtime = "edge";

/** How many tool round-trips one turn may take before the model must answer. */
const MAX_STEPS = 6;

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages: UIMessage[];
    modelId: string;
    apiKey?: string;
    baseUrl?: string;
    provider?: AIProvider;
    systemPrompt?: string;
    toolsEnabled?: boolean;
  };

  const {
    messages,
    modelId,
    apiKey,
    baseUrl,
    provider,
    systemPrompt,
    toolsEnabled = true,
  } = body;

  const effectiveKey = apiKey?.trim() || "";
  const trimmedUrl = baseUrl?.trim();

  try {
    let model;

    if (trimmedUrl) {
      const cleanBaseUrl = trimmedUrl.replace(/\/+$/, "");
      const openaiCompatible = createOpenAICompatible({
        name: "openai-compatible",
        baseURL: cleanBaseUrl,
        apiKey: effectiveKey || undefined,
        headers: effectiveKey ? { Authorization: `Bearer ${effectiveKey}` } : {},
      });
      model = openaiCompatible(modelId);
    } else if (provider === "groq") {
      if (!effectiveKey) {
        return new Response("API key required for Groq", { status: 400 });
      }
      const groq = createGroq({ apiKey: effectiveKey });
      model = groq(modelId);
    } else if (provider === "google") {
      if (!effectiveKey) {
        return new Response("API key required for Google", { status: 400 });
      }
      const google = createGoogleGenerativeAI({ apiKey: effectiveKey });
      model = google(modelId);
    } else {
      const openaiCompatible = createOpenAICompatible({
        name: "openai-compatible",
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: effectiveKey || undefined,
        headers: effectiveKey ? { Authorization: `Bearer ${effectiveKey}` } : {},
      });
      model = openaiCompatible(modelId);
    }

    const coreMessages = await convertToModelMessages(messages);

    const result = streamText({
      model,
      messages: coreMessages,
      system: systemPrompt || undefined,
      tools: toolsEnabled ? AI_TOOLS : undefined,
      stopWhen: stepCountIs(MAX_STEPS),
      experimental_transform: smoothStream({
        delayInMs: 20,
        chunking: "word",
      }),
    });

    return result.toUIMessageStreamResponse({
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(message, { status: 500 });
  }
}
