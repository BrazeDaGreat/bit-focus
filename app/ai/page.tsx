"use client";

/**
 * AI Chat
 *
 * Two panes: conversation history on the left, the thread on the right.
 *
 * The model can reach your data two ways. **Tools** let it ask for what it needs
 * mid-answer — totals, sessions, projects — which keeps prompts small and stops
 * it inventing numbers. **Context** attaches chosen blocks up front, per chat,
 * with the token cost shown before you send. Anything that writes (starting the
 * timer, creating an issue, sending a webhook) is proposed as a card you approve
 * or dismiss; nothing changes on its own.
 *
 * Every tool runs in this browser. Keys and endpoint live in IndexedDB and are
 * sent to the API route per request, never stored server-side.
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type JSX,
  type ReactNode,
} from "react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import {
  Plus,
  Trash2,
  Settings,
  MessageSquare,
  Send,
  Square,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  Bot,
  Check,
  Copy,
  Pin,
  PinOff,
  Pencil,
  RefreshCw,
  Search,
  Database,
  Loader2,
  ChevronDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIChat } from "@/hooks/useAIChat";
import { useAITools } from "@/hooks/useAITools";
import { useFocus } from "@/hooks/useFocus";
import { useConfig } from "@/hooks/useConfig";
import { useRewards } from "@/hooks/useRewards";
import { useProjects } from "@/hooks/useProjects";
import { usePomo } from "@/hooks/PomoContext";
import { useTheme } from "next-themes";
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL_ID,
  ENDPOINT_PRESETS,
  findPresetForUrl,
  isLocalEndpoint,
} from "@/lib/ai-models";
import {
  CONTEXT_SOURCES,
  buildContext,
  buildContextBlock,
  estimateTokens,
  type ContextInput,
  type ContextSourceId,
} from "@/lib/ai-context";
import {
  DECLINED_RESULT,
  TOOL_LABELS,
  describeToolCall,
  needsConfirmation,
} from "@/lib/ai-tools";
import type { AIChat } from "@/lib/db";
import { type UIMessage as Message, DefaultChatTransport } from "ai";
import { toast } from "sonner";

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
      "Look at my open issues and due dates, then draft a realistic plan for tomorrow.",
  },
  {
    label: "Am I slipping?",
    prompt:
      "Compare my last 7 days against the 7 before that. Am I trending up or down, and why might that be?",
  },
];

const DEFAULT_CONTEXT: ContextSourceId[] = ["profile", "timer"];

/**
 * How many times one user message may be continued automatically after tool
 * results. Six steps happen server-side within a single response; this caps the
 * client-side rounds on top of that, so a model that keeps asking for the same
 * data eventually has to answer instead.
 */
const MAX_AUTO_CONTINUE = 4;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AIPage(): JSX.Element {
  const { theme } = useTheme();
  const {
    chats,
    aiConfig,
    models,
    loading,
    loadChats,
    loadAIConfig,
    createChat,
    deleteChat,
    loadMessages,
    toggleChatPinned,
    updateChatTitle,
    setChatContextSources,
  } = useAIChat();
  const { focusSessions, loadFocusSessions } = useFocus();
  const { name, dob, loadConfig } = useConfig();
  const { rewardPoints, loadRewards } = useRewards();
  const { projects, milestones, issues, loadProjects } = useProjects();
  const { state: timerState } = usePomo();

  const [activeChat, setActiveChat] = useState<AIChat | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    loadChats();
    loadAIConfig();
    loadFocusSessions();
    loadConfig();
    loadRewards();
    loadProjects();
  }, [
    loadChats,
    loadAIConfig,
    loadFocusSessions,
    loadConfig,
    loadRewards,
    loadProjects,
  ]);

  useEffect(() => {
    if (aiConfig?.defaultModelId) setModelId(aiConfig.defaultModelId);
  }, [aiConfig?.defaultModelId]);

  const baseUrl = aiConfig?.baseUrl || DEFAULT_BASE_URL;
  const apiKey =
    aiConfig?.apiKey || aiConfig?.groqApiKey || aiConfig?.googleApiKey || "";
  const configured = Boolean(baseUrl && (apiKey || isLocalEndpoint(baseUrl)));

  const contextInput: ContextInput = useMemo(
    () => ({
      name,
      dob,
      rewardPoints,
      focusSessions,
      projects,
      milestones,
      issues,
      timer: {
        mode: timerState.mode,
        phase: timerState.phase,
        isRunning: timerState.isRunning,
        elapsedSeconds: timerState.elapsedSeconds,
        currentTag: timerState.data?.tag || "",
      },
    }),
    [
      name,
      dob,
      rewardPoints,
      focusSessions,
      projects,
      milestones,
      issues,
      timerState,
    ]
  );

  const openChat = useCallback(
    async (chat: AIChat) => {
      setLoadingMessages(true);
      const msgs = await loadMessages(chat.id);
      setActiveMessages(msgs);
      setActiveChat(chat);
      setModelId(chat.modelId || DEFAULT_MODEL_ID);
      setLoadingMessages(false);
      setHistoryOpen(false);
    },
    [loadMessages]
  );

  const startChat = useCallback(async () => {
    const chat = await createChat(modelId);
    setActiveMessages([]);
    setActiveChat(chat);
    setHistoryOpen(false);
  }, [createChat, modelId]);

  const removeChat = useCallback(
    async (chatId: string) => {
      await deleteChat(chatId);
      if (activeChat?.id === chatId) {
        setActiveChat(null);
        setActiveMessages([]);
      }
      toast.success("Chat deleted");
    },
    [deleteChat, activeChat]
  );

  const history = (
    <History
      chats={chats}
      loading={loading}
      activeId={activeChat?.id}
      onSelect={openChat}
      onDelete={removeChat}
      onNew={startChat}
      onTogglePin={toggleChatPinned}
      onRename={updateChatTitle}
      onOpenSettings={() => {
        setHistoryOpen(false);
        setSettingsOpen(true);
      }}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* ── History rail ── */}
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar/40 lg:flex lg:flex-col">
        {history}
      </aside>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-[min(20rem,88vw)] gap-0 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversations</SheetTitle>
            <SheetDescription>Your saved AI chats</SheetDescription>
          </SheetHeader>
          {history}
        </SheetContent>
      </Sheet>

      {/* ── Thread ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-1 border-b px-2 lg:hidden">
          <Button
            variant="ghost"
            className="h-9 min-w-0 flex-1 justify-start gap-2 rounded-lg px-2"
            onClick={() => setHistoryOpen(true)}
          >
            <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs font-medium">
              {activeChat?.title ?? "Conversations"}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg"
            onClick={startChat}
            aria-label="New chat"
          >
            <Plus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg"
            onClick={() => setSettingsOpen(true)}
            aria-label="AI settings"
          >
            <Settings className="size-4" />
          </Button>
        </div>

        {!activeChat ? (
          <EmptyThread
            configured={configured}
            onNew={startChat}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : loadingMessages ? (
          <ThreadSkeleton />
        ) : (
          <Thread
            key={activeChat.id}
            chat={activeChat}
            initialMessages={activeMessages}
            modelId={modelId}
            onModelChange={setModelId}
            models={models}
            baseUrl={baseUrl}
            apiKey={apiKey}
            configured={configured}
            customPrompt={aiConfig?.customPrompt || ""}
            contextInput={contextInput}
            onSaveContext={setChatContextSources}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        contextInput={contextInput}
      />

      <Toaster theme={(theme ?? "system") as "system" | "light" | "dark"} />
    </div>
  );
}

// ── History rail ──────────────────────────────────────────────────────────────

function History({
  chats,
  loading,
  activeId,
  onSelect,
  onDelete,
  onNew,
  onTogglePin,
  onRename,
  onOpenSettings,
}: {
  chats: AIChat[];
  loading: boolean;
  activeId?: string;
  onSelect: (chat: AIChat) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onTogglePin: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onOpenSettings: () => void;
}): JSX.Element {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matching = term
      ? chats.filter((c) => c.title.toLowerCase().includes(term))
      : chats;

    const pinned = matching.filter((c) => c.pinned);
    const rest = matching.filter((c) => !c.pinned);

    const bucket = (chat: AIChat) => {
      const at = dayjs(chat.updatedAt);
      if (at.isSame(dayjs(), "day")) return "Today";
      if (at.isSame(dayjs().subtract(1, "day"), "day")) return "Yesterday";
      if (at.isAfter(dayjs().subtract(7, "day"))) return "This week";
      if (at.isAfter(dayjs().subtract(30, "day"))) return "This month";
      return "Older";
    };

    const buckets = new Map<string, AIChat[]>();
    for (const chat of rest) {
      const key = bucket(chat);
      buckets.set(key, [...(buckets.get(key) ?? []), chat]);
    }

    const ordered: { label: string; chats: AIChat[] }[] = [];
    if (pinned.length) ordered.push({ label: "Pinned", chats: pinned });
    for (const label of ["Today", "Yesterday", "This week", "This month", "Older"]) {
      const list = buckets.get(label);
      if (list?.length) ordered.push({ label, chats: list });
    }
    return ordered;
  }, [chats, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 p-3">
        <Button onClick={onNew} className="h-9 w-full gap-2 rounded-lg text-sm">
          <Plus className="size-3.5" />
          New chat
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="h-9 rounded-lg border-0 bg-muted/60 pl-8 text-xs shadow-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex flex-col gap-1.5 px-1">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {query ? "No chats match that." : "No conversations yet."}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/70">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.chats.map((chat) => (
                  <ChatRow
                    key={chat.id}
                    chat={chat}
                    active={chat.id === activeId}
                    onSelect={() => onSelect(chat)}
                    onDelete={() => onDelete(chat.id)}
                    onTogglePin={() => onTogglePin(chat.id)}
                    onRename={(title) => onRename(chat.id, title)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t p-2">
        <button
          onClick={onOpenSettings}
          className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <Settings className="size-3.5" />
          Endpoint & settings
        </button>
      </div>
    </div>
  );
}

function ChatRow({
  chat,
  active,
  onSelect,
  onDelete,
  onTogglePin,
  onRename,
}: {
  chat: AIChat;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onRename: (title: string) => void;
}): JSX.Element {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(chat.title);

  if (renaming) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim()) onRename(draft.trim());
          setRenaming(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (draft.trim()) onRename(draft.trim());
            setRenaming(false);
          }
          if (e.key === "Escape") {
            setDraft(chat.title);
            setRenaming(false);
          }
        }}
        className="h-9 rounded-lg text-xs"
      />
    );
  }

  return (
    <div
      className={cn(
        "group flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 transition-colors",
        active ? "bg-primary/12" : "hover:bg-muted/60"
      )}
    >
      <button
        onClick={onSelect}
        className="min-w-0 flex-1 truncate text-left text-xs"
        title={chat.title}
      >
        {chat.pinned && (
          <Pin className="mr-1.5 inline size-2.5 text-primary" />
        )}
        {chat.title}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="Chat actions"
          >
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl">
          <DropdownMenuItem onClick={onTogglePin} className="gap-2 rounded-lg text-xs">
            {chat.pinned ? (
              <>
                <PinOff className="size-3" /> Unpin
              </>
            ) : (
              <>
                <Pin className="size-3" /> Pin
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setDraft(chat.title);
              setRenaming(true);
            }}
            className="gap-2 rounded-lg text-xs"
          >
            <Pencil className="size-3" /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="gap-2 rounded-lg text-xs text-destructive focus:text-destructive"
          >
            <Trash2 className="size-3" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Empty and loading states ──────────────────────────────────────────────────

function EmptyThread({
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

function ThreadSkeleton(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6">
      <Skeleton className="ml-auto h-16 w-2/3 rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
    </div>
  );
}

// ── Thread ────────────────────────────────────────────────────────────────────

interface PendingCall {
  toolCallId: string;
  toolName: string;
  input: unknown;
}

function Thread({
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
      if (!trimmed || !configured) return;
      autoContinueRef.current = { messageId: null, count: 0 };
      sendMessage({ text: trimmed });
      setInput("");
    },
    [sendMessage, configured]
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
      sendMessage({ text });
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
            <div className="overflow-hidden rounded-2xl border bg-card shadow-xs focus-within:border-primary/40">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(input);
                  }
                }}
                placeholder="Ask about your focus, or tell it what to do…"
                className="max-h-48 min-h-[52px] resize-none border-0 bg-transparent px-4 py-3.5 text-sm shadow-none focus-visible:ring-0"
                rows={2}
              />
              <div className="flex items-center gap-1 border-t px-2 py-2">
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
                      disabled={!input.trim()}
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
          )}
        </div>
      </div>
    </div>
  );
}

// ── Messages ──────────────────────────────────────────────────────────────────

/** Flatten a message's text parts. */
function messageText(message: Message): string {
  return (message.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

function AssistantAvatar(): JSX.Element {
  return (
    <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/12">
      <Bot className="size-3.5 text-primary" />
    </div>
  );
}

function UserMessage({
  message,
  editing,
  draft,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onResend,
}: {
  message: Message;
  editing: boolean;
  draft: string;
  onDraftChange: (text: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onResend: (text: string) => void;
}): JSX.Element {
  const text = messageText(message);

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-3">
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          className="min-h-20 resize-none rounded-xl text-sm"
        />
        <div className="flex justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelEdit}
            className="h-8 rounded-lg text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => draft.trim() && onResend(draft.trim())}
            className="h-8 rounded-lg text-xs"
          >
            Send again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-end gap-1">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary/12 px-4 py-2.5 text-sm">
        {text}
      </div>
      <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <CopyButton text={text} />
        <MessageAction onClick={onStartEdit} label="Edit and resend">
          <Pencil className="size-3" />
        </MessageAction>
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  modelId,
  pending,
  onResolve,
  canRegenerate,
  onRegenerate,
}: {
  message: Message;
  modelId: string;
  pending: PendingCall[];
  onResolve: (call: PendingCall, approved: boolean) => void;
  canRegenerate: boolean;
  onRegenerate: () => void;
}): JSX.Element {
  const text = messageText(message);

  return (
    <div className="group flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        {/* Tool activity, in the order the model ran it */}
        <div className="mb-2 flex flex-col gap-1.5 empty:mb-0">
          {(message.parts ?? []).map((part, index) => {
            if (!part.type.startsWith("tool-")) return null;
            const toolPart = part as {
              type: string;
              toolCallId: string;
              state?: string;
              input?: unknown;
            };
            const toolName = toolPart.type.slice(5);
            const waiting = pending.find(
              (p) => p.toolCallId === toolPart.toolCallId
            );

            if (waiting) {
              return (
                <ConfirmCard
                  key={toolPart.toolCallId ?? index}
                  call={waiting}
                  onResolve={onResolve}
                />
              );
            }

            return (
              <ToolChip
                key={toolPart.toolCallId ?? index}
                name={toolName}
                done={toolPart.state === "output-available"}
                failed={toolPart.state === "output-error"}
              />
            );
          })}
        </div>

        {text && <MarkdownText text={text} />}

        <div className="mt-1.5 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <CopyButton text={text} />
          {canRegenerate && (
            <MessageAction onClick={onRegenerate} label="Regenerate reply">
              <RefreshCw className="size-3" />
            </MessageAction>
          )}
          <span className="ml-1 font-mono text-[10px] text-muted-foreground/60">
            {modelId}
          </span>
        </div>
      </div>
    </div>
  );
}

function MessageAction({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function CopyButton({ text }: { text: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <MessageAction
      label={copied ? "Copied" : "Copy"}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </MessageAction>
  );
}

function ToolChip({
  name,
  done,
  failed,
}: {
  name: string;
  done: boolean;
  failed: boolean;
}): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]",
        failed
          ? "bg-destructive/12 text-destructive"
          : "bg-muted/60 text-muted-foreground"
      )}
    >
      {failed ? (
        <X className="size-2.5" />
      ) : done ? (
        <Database className="size-2.5" />
      ) : (
        <Loader2 className="size-2.5 animate-spin" />
      )}
      {TOOL_LABELS[name] ?? name}
    </span>
  );
}

function ConfirmCard({
  call,
  onResolve,
}: {
  call: PendingCall;
  onResolve: (call: PendingCall, approved: boolean) => void;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-primary">
        Needs your approval
      </p>
      <p className="mt-1.5 whitespace-pre-wrap text-sm">
        {describeToolCall(call.toolName, call.input)}
      </p>
      <div className="mt-3 flex gap-1.5">
        <Button
          size="sm"
          onClick={() => onResolve(call, true)}
          className="h-8 rounded-lg text-xs"
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onResolve(call, false)}
          className="h-8 rounded-lg text-xs"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function ThinkingDots(): JSX.Element {
  return (
    <div className="mt-2 flex h-4 items-center gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="size-1.5 rounded-full bg-primary/40 motion-safe:animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

// ── Composer controls ─────────────────────────────────────────────────────────

function ContextPicker({
  sources,
  onChange,
  tokens,
  contextInput,
}: {
  sources: ContextSourceId[];
  onChange: (next: ContextSourceId[]) => void;
  tokens: number;
  contextInput: ContextInput;
}): JSX.Element {
  const toggle = (id: ContextSourceId) =>
    onChange(
      sources.includes(id) ? sources.filter((s) => s !== id) : [...sources, id]
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
            sources.length
              ? "bg-primary/12 text-primary hover:bg-primary/20"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
          title="Choose what data is attached"
        >
          <Sparkles className="size-3" />
          Context
          {sources.length > 0 && (
            <span className="font-mono font-normal opacity-70">
              ~{tokens}t
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-xl p-2">
        <p className="px-1.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Attached to this chat
        </p>
        <div className="flex flex-col gap-0.5">
          {CONTEXT_SOURCES.map((source) => {
            const active = sources.includes(source.id);
            const block = buildContextBlock(source.id, contextInput);
            const cost = block ? estimateTokens(block) : 0;
            return (
              <button
                key={source.id}
                onClick={() => toggle(source.id)}
                disabled={!block}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors disabled:opacity-40",
                  active ? "bg-primary/12" : "hover:bg-muted/60"
                )}
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded border",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  )}
                >
                  {active && <Check className="size-2.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">
                    {source.label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {block ? source.description : "Nothing recorded yet"}
                  </span>
                </span>
                {block && (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    ~{cost}t
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 border-t px-1.5 pt-2 text-[11px] leading-relaxed text-muted-foreground">
          Anything not attached can still be fetched by the assistant with a tool
          when it needs it.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? models.filter(
          (m) =>
            m.id.toLowerCase().includes(term) ||
            m.name.toLowerCase().includes(term)
        )
      : models;
  }, [models, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex h-9 min-w-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          title="Model for this chat"
        >
          <span className="max-w-40 truncate font-mono">{value}</span>
          <ChevronDown className="size-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-xl p-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models"
          className="mb-1.5 h-8 rounded-lg text-xs"
        />
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No models match. Fetch the list in settings.
            </p>
          ) : (
            filtered.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onChange(model.id);
                  setOpen(false);
                }}
                className={cn(
                  "shrink-0 truncate rounded-lg px-2 py-2 text-left font-mono text-xs leading-5 transition-colors",
                  model.id === value
                    ? "bg-primary/12 text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {model.id}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Markdown ──────────────────────────────────────────────────────────────────

function MarkdownText({ text }: { text: string }): JSX.Element {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none text-foreground/80 prose-p:text-foreground/80 prose-li:text-foreground/80",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "prose-p:leading-relaxed prose-p:my-2",
        "prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2",
        "prose-headings:font-semibold prose-headings:text-foreground prose-headings:mt-4 prose-headings:mb-1.5",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-a:font-normal",
        "prose-strong:font-semibold prose-strong:text-foreground",
        "prose-blockquote:border-l-2 prose-blockquote:border-primary/30 prose-blockquote:text-muted-foreground prose-blockquote:not-italic prose-blockquote:pl-3",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-table:text-xs prose-th:font-semibold prose-th:text-foreground",
        "prose-table:block prose-table:max-w-full prose-table:overflow-x-auto",
        "prose-thead:border-b prose-thead:border-border",
        "prose-tr:border-b prose-tr:border-border/50",
        "prose-td:py-1.5 prose-th:py-1.5",
        "prose-hr:border-border/50"
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-xl border bg-muted/60 p-3 font-mono text-xs leading-relaxed">
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            if (className) {
              return (
                <code className={cn("text-foreground/90", className)} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8em] text-foreground"
                {...props}
              >
                {children}
              </code>
            );
          },
          input: ({ checked }) => (
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="mr-1.5 accent-primary align-middle"
            />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

function SettingsDialog({
  open,
  onClose,
  contextInput,
}: {
  open: boolean;
  onClose: () => void;
  contextInput: ContextInput;
}): JSX.Element {
  const {
    aiConfig,
    saveAIConfig,
    models,
    fetchModels,
    fetchingModels,
    modelFetchError,
  } = useAIChat();

  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [defaultModelId, setDefaultModelId] = useState(DEFAULT_MODEL_ID);
  const [customPrompt, setCustomPrompt] = useState("");
  const [contextEnabled, setContextEnabled] = useState(false);
  const [modelQuery, setModelQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !aiConfig) return;
    setBaseUrl(aiConfig.baseUrl || DEFAULT_BASE_URL);
    setApiKey(
      aiConfig.apiKey || aiConfig.groqApiKey || aiConfig.googleApiKey || ""
    );
    setDefaultModelId(aiConfig.defaultModelId || DEFAULT_MODEL_ID);
    setCustomPrompt(aiConfig.customPrompt || "");
    setContextEnabled(aiConfig.customContextEnabled || false);
  }, [aiConfig, open]);

  const preset = findPresetForUrl(baseUrl);
  const keyOptional = isLocalEndpoint(baseUrl);

  const applyPreset = (id: string) => {
    const found = ENDPOINT_PRESETS.find((p) => p.id === id);
    if (!found) return;
    setBaseUrl(found.baseUrl);
    if (found.defaultModel) setDefaultModelId(found.defaultModel);
  };

  const handleFetch = async () => {
    const list = await fetchModels(baseUrl, apiKey);
    if (list.length > 0) {
      toast.success(`Found ${list.length} models`);
      if (!list.some((m) => m.id === defaultModelId)) {
        setDefaultModelId(list[0].id);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAIConfig({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        defaultModelId,
        customPrompt,
        customContextEnabled: contextEnabled,
      });
      toast.success("Settings saved");
      onClose();
    } catch {
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const filteredModels = useMemo(() => {
    const term = modelQuery.trim().toLowerCase();
    return term
      ? models.filter((m) => m.id.toLowerCase().includes(term))
      : models;
  }, [models, modelQuery]);

  const contextPreview = useMemo(
    () => buildContext(DEFAULT_CONTEXT, contextInput),
    [contextInput]
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="text-base">AI settings</DialogTitle>
          <DialogDescription className="text-xs">
            Any OpenAI-compatible endpoint. Keys stay in this browser and are sent
            only with your own requests.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 p-5">
          {/* ── Endpoint ── */}
          <section className="flex flex-col gap-2.5">
            <Label className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Endpoint
            </Label>

            <div className="flex flex-wrap gap-1.5">
              {ENDPOINT_PRESETS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => applyPreset(option.id)}
                  title={option.description}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                    preset?.id === option.id
                      ? "bg-primary/12 text-primary"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="base-url" className="text-xs">
                Base URL
              </Label>
              <Input
                id="base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="h-9 rounded-lg font-mono text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="api-key" className="text-xs">
                API key
                {keyOptional && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    (optional for local endpoints)
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={preset?.placeholderKey ?? "sk-…"}
                  className="h-9 rounded-lg pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showKey ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* ── Models ── */}
          <section className="flex flex-col gap-2.5 rounded-xl bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium">Models</p>
                <p className="text-[11px] text-muted-foreground">
                  {models.length} available
                  {modelFetchError ? " · last fetch failed" : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleFetch}
                disabled={fetchingModels || !baseUrl.trim()}
                className="h-8 gap-1.5 rounded-lg bg-background text-xs shadow-xs"
              >
                {fetchingModels ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Fetch models
              </Button>
            </div>

            {modelFetchError && (
              <p className="rounded-lg bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
                {modelFetchError}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model-search" className="text-xs">
                Default model
              </Label>
              <Input
                id="model-search"
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                placeholder="Search models"
                className="h-8 rounded-lg text-xs"
              />
              <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-lg bg-background p-1">
                {filteredModels.length === 0 ? (
                  <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                    No models yet. Fetch the list above.
                  </p>
                ) : (
                  filteredModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setDefaultModelId(model.id)}
                      className={cn(
                        "shrink-0 truncate rounded-lg px-2 py-2 text-left font-mono text-xs leading-5 transition-colors",
                        defaultModelId === model.id
                          ? "bg-primary/12 text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      {model.id}
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* ── Behaviour ── */}
          <section className="flex flex-col gap-2.5">
            <Label
              htmlFor="system-prompt"
              className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
            >
              System prompt
            </Label>
            <Textarea
              id="system-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="How the assistant should behave…"
              className="min-h-24 resize-none rounded-xl text-xs leading-relaxed"
            />

            <div className="flex items-start justify-between gap-3 rounded-xl bg-muted/40 p-3">
              <div className="min-w-0">
                <p className="text-xs font-medium">Attach context by default</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  New chats start with profile and timer attached. Each chat can
                  change what it sends from the composer.
                </p>
              </div>
              <Switch
                checked={contextEnabled}
                onCheckedChange={setContextEnabled}
              />
            </div>

            {contextEnabled && contextPreview && (
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {contextPreview}
              </pre>
            )}
          </section>
        </div>

        <div className="flex justify-end gap-1.5 border-t px-5 py-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-9 rounded-lg text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-9 rounded-lg text-xs"
          >
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
