/**
 * Title route.
 *
 * Names a conversation from its opening exchange. Same proxy shape as the chat
 * route: credentials arrive per request, are used once, and are never stored.
 *
 * A failure here is not worth surfacing — the caller keeps the fallback title.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

export const runtime = "edge";

const SYSTEM = `Name this conversation in 2 to 5 words.
Return the title only: no quotes, no punctuation at the end, no explanation.
Use the language the user wrote in. Describe the subject, not the request — "Sleep and focus dip", not "User asks about focus".`;

export async function POST(req: Request) {
  try {
    const { baseUrl, apiKey, modelId, exchange } = (await req.json()) as {
      baseUrl?: string;
      apiKey?: string;
      modelId?: string;
      exchange?: string;
    };

    if (!baseUrl?.trim() || !modelId?.trim() || !exchange?.trim()) {
      return Response.json({ error: "Missing request details" }, { status: 400 });
    }

    const key = apiKey?.trim() || "";
    const client = createOpenAICompatible({
      name: "openai-compatible",
      baseURL: baseUrl.trim().replace(/\/+$/, ""),
      apiKey: key || undefined,
      headers: key ? { Authorization: `Bearer ${key}` } : {},
    });

    const { text } = await generateText({
      model: client(modelId),
      system: SYSTEM,
      prompt: exchange.slice(0, 2000),
    });

    const title = text
      .trim()
      .replace(/^["'`]|["'`.]$/g, "")
      .slice(0, 60);

    return Response.json({ title });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
