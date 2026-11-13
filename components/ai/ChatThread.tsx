"use client";

/**
 * AI Chat - Thread
 *
 * One conversation: messages, tool rounds, approvals, and the composer.
 */

import { useState, useEffect, useCallback, useRef, useMemo, type JSX } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Settings, Send, Square, Sparkles, Download, AlertCircle } from "lucide-react";
import { attachmentsOf, branchMessages, messageText, sourcesOf, type ChatAttachment } from "@/lib/ai-conversations";
import { ChatAttachments, SaveAnswerDialog } from "@/components/ai/ChatExtras";
import { useAIChat } from "@/hooks/useAIChat";
import { useAITools } from "@/hooks/useAITools";
import { useOnline } from "@/components/OfflineIndicator";
import { FaPlugCircleXmark } from "react-icons/fa6";
import { buildContext, estimateTokens, type ContextInput, type ContextSourceId } from "@/lib/ai-context";
import { DECLINED_RESULT, needsConfirmation } from "@/lib/ai-tools";
import type { AIChat } from "@/lib/db";
import { type UIMessage as Message, DefaultChatTransport } from "ai";
import { toast } from "sonner";
import { DEFAULT_CONTEXT, downloadChat, type PendingCall } from "./chat-shared";
import { AssistantAvatar, UserMessage, AssistantMessage, ThinkingDots } from "./ChatMessages";
import { ContextPicker, ModelPicker } from "./ChatControls";

/** Openers wired to real data, shown on an empty thread. */
const QUICK_PROMPTS = [
  {
    label: "Review my week",
    prompt:
      "Review my last 7 days of focus. What stands out, and what should I change next week?",
  },
  {
    label: "Where did my time go?",
    prompt:
      "Break down where my focus time went by tag over the last 30 days, and tell me what that says about my priorities.",
  },
  {
    label: "Plan tomorrow",
    prompt:
      "Look at my tasks and deadlines, then draft a realistic plan for tomorrow.",
  },
  {
    label: "Am I slipping?",
    prompt:
      "Compare my last 7 days against the 7 before that. Am I trending up or down, and why might that be?",
  },
];



/**
 * How many times one user message may be continued automatically after tool
 * results. Six steps happen server-side within a single response; this caps the
 * client-side rounds on top of that, so a model that keeps asking for the same
 * data eventually has to answer instead.
 */
const MAX_AUTO_CONTINUE = 4;

// ── Empty and loading states ──────────────────────────────────────────────────

export function EmptyThread({
  configured,
  onNew,
  onOpenSettings,
}: {
  configured: boolean;
  onNew: () => void;
  onOpenSettings: () => void;
}): JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-xs">
        <div className="mx-auto grid size-11 place-items-center rounded-xl bg-primary/12">
          <Sparkles className="size-5 text-primary" />
        </div>
        <h2 className="mt-4 text-base font-semibold tracking-tight">
          {configured ? "Ask about your focus" : "Connect an endpoint"}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {configured
            ? "The assistant can read your sessions, projects, and timer, and can act on them with your approval."
            : "Add any OpenAI-compatible endpoint and key — Groq, OpenAI, OpenRouter, or your own Ollama."}
        </p>
        <Button
          onClick={configured ? onNew : onOpenSettings}
          className="mt-5 h-10 gap-2 rounded-xl"
        >
          {configured ? (
            <>
              <Plus className="size-3.5" /> New chat
            </>
          ) : (
            <>
              <Settings className="size-3.5" /> Open settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function ThreadSkeleton(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6">
      <Skeleton className="ml-auto h-16 w-2/3 rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
    </div>
  );
}

// ── Thread ────────────────────────────────────────────────────────────────────

export function Thread({
  chat,
  initialMessages,
  modelId,
  onModelChange,
  models,
  baseUrl,
  apiKey,
  configured,
  customPrompt,
  contextInput,
  onSaveContext,
  onBranch,
  onOpenSettings,
}: {
  chat: AIChat;
  initialMessages: Message[];
  modelId: string;
  onModelChange: (id: string) => void;
  models: { id: string; name: string }[];
  baseUrl: string;
  apiKey: string;
  configured: boolean;
  customPrompt: string;
  contextInput: ContextInput;
  onBranch: (chat: AIChat) => Promise<void>;
  onSaveContext: (id: string, sources: ContextSourceId[]) => void;
  onOpenSettings: () => void;
}): JSX.Element {
  const { saveMessages, generateChatTitle, chats } = useAIChat();
  const runTool = useAITools();

  const [sources, setSources] = useState<ContextSourceId[]>(() => {
    try {
      const parsed = chat.contextSources ? JSON.parse(chat.contextSources) : null;
      return Array.isArray(parsed) ? parsed : DEFAULT_CONTEXT;
    } catch {
      return DEFAULT_CONTEXT;
    }
  });
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [saveAnswer, setSaveAnswer] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingCall[]>([]);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(
    null
  );

  // Auto-continuation has to remember what it already resumed from. The SDK's
  // stock predicate answers "does the last assistant message have finished tool
  // calls", which stays true if a resubmit comes back without adding a message —
  // and then fires again, and again. Tracking the message id makes each one
  // resumable exactly once, and the counter stops a model that loops on tools.
  const autoContinueRef = useRef<{ messageId: string | null; count: number }>({
    messageId: null,
    count: 0,
  });

  const shouldAutoContinue = useCallback(
    ({ messages: current }: { messages: Message[] }) => {
      const last = current[current.length - 1];
      if (!last || last.role !== "assistant") return false;

      const toolParts = (last.parts ?? []).filter((part) =>
        part.type.startsWith("tool-")
      ) as { state?: string }[];
      if (toolParts.length === 0) return false;

      const settled = toolParts.every(
        (part) =>
          part.state === "output-available" || part.state === "output-error"
      );
      if (!settled) return false;

      const tracker = autoContinueRef.current;
      if (tracker.messageId === last.id) return false;
      if (tracker.count >= MAX_AUTO_CONTINUE) return false;

      autoContinueRef.current = {
        messageId: last.id,
        count: tracker.count + 1,
      };
      return true;
    },
    []
  );

  const systemPrompt = useMemo(() => {
    const context = buildContext(sources, contextInput);
    return [customPrompt, context].filter(Boolean).join("\n\n") || undefined;
  }, [customPrompt, sources, contextInput]);

  // The transport reads the latest values on each send without rebuilding.
  const bodyRef = useRef({ modelId, apiKey, baseUrl, systemPrompt });
  useEffect(() => {
    bodyRef.current = { modelId, apiKey, baseUrl, systemPrompt };
  }, [modelId, apiKey, baseUrl, systemPrompt]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => bodyRef.current,
      }),
    []
  );

  const { messages, sendMessage, status, stop, regenerate, addToolResult, setMessages } =
    useChat({
      id: chat.id,
      messages: initialMessages,
      transport,
      // Streaming can produce many message snapshots in quick succession.
      // Limit React updates while the SDK continues processing every chunk.
      experimental_throttle: 100,
      // A client-side tool result is only half a turn: once every call in the
      // last assistant message has an output, the thread goes back to the model
      // so it can answer with what the tools returned.
      sendAutomaticallyWhen: shouldAutoContinue,
      onError: (err) => toast.error(`AI error: ${err.message}`),
      onToolCall: async ({ toolCall }) => {
        // Writes wait for a person. Reads run straight away.
        if (needsConfirmation(toolCall.toolName)) {
          setPending((current) =>
            current.some((c) => c.toolCallId === toolCall.toolCallId)
              ? current
              : [
                  ...current,
                  {
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    input: toolCall.input,
                  },
                ]
          );
          return;
        }
        try {
          const output = await runTool(toolCall.toolName, toolCall.input);
          addToolResult({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output,
          });
        } catch (err) {
          addToolResult({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            state: "output-error",
            errorText: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });

  const busy = status === "submitted" || status === "streaming";

  // Replies come from a server route, so without a connection nothing can be
  // sent — unless the app itself is running on this machine.
  const online = useOnline();
  const offline =
    !online &&
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname);

  // Debounced persistence to IndexedDB.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (messages.length > 0) saveMessages(chat.id, messages);
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [messages, chat.id, saveMessages]);

  // Name the conversation once the first exchange lands.
  const titledRef = useRef(false);
  useEffect(() => {
    if (titledRef.current || busy) return;
    const current = chats.find((c) => c.id === chat.id);
    if (!current || current.title !== "New Chat") {
      titledRef.current = true;
      return;
    }
    const firstUser = messages.find((m) => m.role === "user");
    const firstReply = messages.find((m) => m.role === "assistant");
    if (!firstUser || !firstReply) return;
    titledRef.current = true;
    generateChatTitle(
      chat.id,
      `User: ${messageText(firstUser)}\n\nAssistant: ${messageText(firstReply).slice(
        0,
        600
      )}`
    );
  }, [messages, busy, chat.id, chats, generateChatTitle]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, busy]);

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !configured || busy || pending.length > 0) return;
      if (offline) {
        toast("You're offline. Your message is still here — send it when you reconnect.");
        return;
      }
      autoContinueRef.current = { messageId: null, count: 0 };
      sendMessage({ parts: [{ type: "text", text: trimmed }, ...attachments.map((data) => ({ type: "data-attachment" as const, data }))] });
      setAttachments([]);
      setInput("");
    },
    [sendMessage, configured, offline, attachments, busy, pending.length]
  );

  const resolvePending = useCallback(
    async (call: PendingCall, approved: boolean) => {
      setPending((current) =>
        current.filter((c) => c.toolCallId !== call.toolCallId)
      );
      autoContinueRef.current = { messageId: null, count: 0 };
      if (!approved) {
        addToolResult({
          tool: call.toolName,
          toolCallId: call.toolCallId,
          output: DECLINED_RESULT,
        });
        return;
      }
      try {
        const output = await runTool(call.toolName, call.input);
        addToolResult({
          tool: call.toolName,
          toolCallId: call.toolCallId,
          output,
        });
      } catch (err) {
        addToolResult({
          tool: call.toolName,
          toolCallId: call.toolCallId,
          state: "output-error",
          errorText: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [addToolResult, runTool]
  );

  /** Rewrite a past message and re-run the conversation from that point. */
  const resend = useCallback(
    (messageId: string, text: string) => {
      const index = messages.findIndex((m) => m.id === messageId);
      if (index === -1) return;
      setMessages(messages.slice(0, index));
      setEditing(null);
      autoContinueRef.current = { messageId: null, count: 0 };
      const original = messages[index];
      sendMessage({ parts: [{ type: "text", text }, ...attachmentsOf(original).map((data) => ({ type: "data-attachment" as const, data }))] });
    },
    [messages, setMessages, sendMessage]
  );

  const contextTokens = useMemo(
    () => estimateTokens(buildContext(sources, contextInput)),
    [sources, contextInput]
  );

  const updateSources = useCallback(
    (next: ContextSourceId[]) => {
      setSources(next);
      onSaveContext(chat.id, next);
    },
    [chat.id, onSaveContext]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SaveAnswerDialog text={saveAnswer} title={chat.title} onClose={() => setSaveAnswer(null)} />
      <div className="flex justify-end px-4 pt-2"><Button variant="ghost" size="sm" onClick={() => downloadChat(chat.title, messages)} className="gap-2 text-xs"><Download className="size-3" /> Export chat</Button></div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Ask anything, or start with one of these.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {QUICK_PROMPTS.map((quick) => (
                  <button
                    key={quick.label}
                    onClick={() => submit(quick.prompt)}
                    disabled={!configured}
                    className="rounded-lg bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    {quick.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) =>
            message.role === "user" ? (
              <UserMessage
                key={message.id}
                message={message}
                editing={editing?.id === message.id}
                draft={editing?.text ?? ""}
                onDraftChange={(text) =>
                  setEditing({ id: message.id, text })
                }
                onStartEdit={() =>
                  setEditing({ id: message.id, text: messageText(message) })
                }
                onCancelEdit={() => setEditing(null)}
                onResend={(text) => resend(message.id, text)}
              />
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                modelId={modelId}
                pending={pending}
                onResolve={resolvePending}
                sources={sourcesOf(message)}
                canAct={!busy && pending.length === 0}
                onSave={() => setSaveAnswer(messageText(message))}
                onBranch={async () => {
                  try {
                    const store = useAIChat.getState();
                    await store.saveMessages(chat.id, messages);
                    const copy = branchMessages(messages, message.id);
                    const branched = await store.branchChat(chat.id, modelId, copy);
                    await onBranch(branched);
                    toast.success("Branch created");
                  } catch { toast.error("Couldn't create a branch"); }
                }}
                canRegenerate={!busy && index === messages.length - 1}
                onRegenerate={() => {
                  autoContinueRef.current = { messageId: null, count: 0 };
                  regenerate();
                }}
              />
            )
          )}

          {status === "submitted" && (
            <div className="flex gap-3">
              <AssistantAvatar />
              <ThinkingDots />
            </div>
          )}
        </div>
      </div>

      {/* ── Composer ── */}
      <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto max-w-3xl">
          {!configured ? (
            <button
              onClick={onOpenSettings}
              className="flex w-full items-center gap-2.5 rounded-2xl border bg-muted/40 px-4 py-3.5 text-left text-sm transition-colors hover:bg-muted/60"
            >
              <AlertCircle className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Add an endpoint and key in settings to start chatting.
              </span>
            </button>
          ) : (
            <>
            {offline && (
              <div role="status" className="mb-2 flex items-center gap-2.5 rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs text-muted-foreground">
                <FaPlugCircleXmark className="size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  You&apos;re offline. AI Chat needs a connection to reply. You can keep typing
                  and send when you&apos;re back; the rest of BIT Focus works as normal.
                </span>
              </div>
            )}
            <div className="overflow-hidden rounded-2xl border bg-card shadow-xs focus-within:border-primary/40">
              <ChatAttachments input={input} setInput={setInput} attachments={attachments} onChange={setAttachments}>
              <Textarea
                disabled={busy || pending.length > 0}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit(input);
                  }
                }}
                placeholder="Ask about your focus… Type @ to attach a project, task, or note"
                className="max-h-48 min-h-[52px] resize-none rounded-none border-none bg-transparent px-4 py-3.5 text-sm shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                rows={2}
              />
              </ChatAttachments>
              <div className="flex items-center gap-1 px-2 pb-2">
                <ContextPicker
                  sources={sources}
                  onChange={updateSources}
                  tokens={contextTokens}
                  contextInput={contextInput}
                />
                <ModelPicker
                  models={models}
                  value={modelId}
                  onChange={onModelChange}
                />
                <div className="ml-auto">
                  {busy ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={stop}
                      className="size-9 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Stop generating"
                      aria-label="Stop generating"
                    >
                      <Square className="size-3.5" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      onClick={() => submit(input)}
                      disabled={!input.trim() || offline || pending.length > 0}
                      className="size-9 rounded-lg"
                      title="Send message"
                      aria-label="Send message"
                    >
                      <Send className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
