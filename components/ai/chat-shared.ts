/**
 * AI Chat - Shared Pieces
 *
 * Defaults and helpers used by more than one part of the chat page.
 */

import { exportChat } from "@/lib/ai-conversations";
import { type ContextSourceId } from "@/lib/ai-context";
import { type UIMessage as Message } from "ai";

export const DEFAULT_CONTEXT: ContextSourceId[] = ["profile", "timer"];

export interface PendingCall {
  toolCallId: string;
  toolName: string;
  input: unknown;
}


export function downloadChat(title: string, messages: Message[]) {
  const url = URL.createObjectURL(new Blob([exportChat(title, messages)], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = `${title.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "chat"}.md`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
