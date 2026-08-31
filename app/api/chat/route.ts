import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import type { AIProvider } from "@/lib/ai-models";

export const runtime = "edge";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages: UIMessage[];
    modelId: string;
    apiKey?: string;
    baseUrl?: string;
    provider?: AIProvider;
    systemPrompt?: string;
  };

  const { messages, modelId, apiKey, baseUrl, provider, systemPrompt } = body;
  console.log("Received chat request:", {
    baseUrl,
    modelId,
    provider,
    systemPrompt: systemPrompt ? "Present" : "None",
    messagesCount: messages?.length,
  });

  const effectiveKey = apiKey?.trim() || "";
  const trimmedUrl = baseUrl?.trim();

  try {
    let model;

    if (trimmedUrl) {
      const cleanBaseUrl = trimmedUrl.replace(/\/+$/, "");
      const openaiCompatible = createOpenAICompatible({
        name: "openai-compatible",
        baseURL: cleanBaseUrl,
        apiKey: effectiveKey || "none",
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
      // Fallback default endpoint (Groq / OpenAI compatible)
      const openaiCompatible = createOpenAICompatible({
        name: "openai-compatible",
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: effectiveKey || "none",
        headers: effectiveKey ? { Authorization: `Bearer ${effectiveKey}` } : {},
      });
      model = openaiCompatible(modelId);
    }

    const coreMessages = await convertToModelMessages(messages);

    const result = streamText({
      model,
      messages: coreMessages,
      system: systemPrompt || undefined,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error occurred while streaming text:", message);
    return new Response(message, { status: 500 });
  }
}
