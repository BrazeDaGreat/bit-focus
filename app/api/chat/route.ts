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
    apiKey: string;
    provider: AIProvider;
    systemPrompt?: string;
  };

  const { messages, modelId, apiKey, provider, systemPrompt } = body;
  console.log("Received request with body:", {
    apiKey,
    messages,
    modelId,
    provider,
    systemPrompt,
  });

  if (!apiKey) {
    console.log("API key is missing");
    return new Response("API key required", { status: 400 });
  }

  try {
    let model;

    if (provider === "groq") {
      const groq = createGroq({ apiKey });
      model = groq(modelId);
    } else if (provider === "google") {
      const google = createGoogleGenerativeAI({ apiKey });
      model = google(modelId);
    } else {
      console.log("Unknown provider:", provider);
      return new Response("Unknown provider", { status: 400 });
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
