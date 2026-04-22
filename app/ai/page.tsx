"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type JSX,
  useMemo,
} from "react";
import { useChat } from "@ai-sdk/react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
} from "@assistant-ui/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { subDays, format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Trash2,
  Settings,
  MessageSquare,
  Send,
  StopCircle,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  Bot,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIChat } from "@/hooks/useAIChat";
import { useFocus, type FocusSession } from "@/hooks/useFocus";
import { useConfig } from "@/hooks/useConfig";
import { useRewards } from "@/hooks/useRewards";
import { usePomo } from "@/hooks/PomoContext";
import {
  AI_MODELS,
  PROVIDER_LABELS,
  DEFAULT_MODEL_ID,
  type AIModel,
  type AIProvider,
} from "@/lib/ai-models";
import type { AIChat } from "@/lib/db";
import { type UIMessage as Message, DefaultChatTransport } from "ai";
import { toast } from "sonner";

// ── Focus context builder ──────────────────────────────────────────────────

interface TimerContextData {
  mode: string;
  isRunning: boolean;
  phase: string;
  elapsedSeconds: number;
  pomodoroSettings: { focusDuration: number; breakDuration: number };
  currentTag: string;
}

function sessionHours(s: FocusSession): number {
  return (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60);
}

function sumHoursInPeriod(sessions: FocusSession[], days: number): number {
  const cutoff = subDays(new Date(), days);
  return sessions
    .filter((s) => new Date(s.startTime) >= cutoff)
    .reduce((acc, s) => acc + sessionHours(s), 0);
}

function buildFocusContext(
  sessions: FocusSession[],
  rewardPoints: number,
  name: string,
  dob: Date,
  timer: TimerContextData
): string {
  const now = new Date();

  // Age from dob
  const ageMs = now.getTime() - new Date(dob).getTime();
  const age = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25));

  // Aggregated totals
  const h24 = sumHoursInPeriod(sessions, 1);
  const h7 = sumHoursInPeriod(sessions, 7);
  const h14 = sumHoursInPeriod(sessions, 14);
  const h30 = sumHoursInPeriod(sessions, 30);

  // Last 14 days breakdown by date and tag
  const cutoff14 = subDays(now, 14);
  const recent14 = sessions.filter((s) => new Date(s.startTime) >= cutoff14);
  const byDate: Record<string, Record<string, number>> = {};
  for (const s of recent14) {
    const date = format(new Date(s.startTime), "MMM d");
    if (!byDate[date]) byDate[date] = {};
    byDate[date][s.tag] = (byDate[date][s.tag] || 0) + sessionHours(s);
  }
  const dailyLines = Object.entries(byDate).map(([date, tags]) => {
    const tagLines = Object.entries(tags)
      .map(([tag, hours]) => `    ${tag}: ${hours.toFixed(1)}h`)
      .join("\n");
    return `  ${date}:\n${tagLines}`;
  });

  // Timer state
  const timerMode = timer.mode === "pomodoro" ? "Pomodoro" : "Standard";
  const timerStatus = timer.isRunning ? "Running" : "Paused/Stopped";
  let timerDetail = "";
  if (timer.mode === "pomodoro") {
    const totalSecs = (timer.phase === "focus"
      ? timer.pomodoroSettings.focusDuration
      : timer.pomodoroSettings.breakDuration) * 60;
    const remaining = Math.max(0, totalSecs - timer.elapsedSeconds);
    const rm = Math.floor(remaining / 60);
    const rs = remaining % 60;
    timerDetail = `Phase: ${timer.phase}, Remaining: ${rm}m ${rs}s`;
  } else {
    const em = Math.floor(timer.elapsedSeconds / 60);
    const es = timer.elapsedSeconds % 60;
    timerDetail = `Elapsed: ${em}m ${es}s`;
  }

  const parts: string[] = [];
  parts.push(`=== User Profile ===`);
  parts.push(`Name: ${(name && name !== "NULL") ? name : "Unknown"}`);
  parts.push(`Age: ${isNaN(age) || age < 0 || age > 120 ? "Unknown" : age} years old`);
  parts.push(`Accumulated Focus Points: ${rewardPoints}`);

  parts.push(`\n=== Focus Summary ===`);
  parts.push(`Last 24h:  ${h24.toFixed(1)}h`);
  parts.push(`Last 7d:   ${h7.toFixed(1)}h`);
  parts.push(`Last 14d:  ${h14.toFixed(1)}h`);
  parts.push(`Last 30d:  ${h30.toFixed(1)}h`);

  if (dailyLines.length > 0) {
    parts.push(`\n=== Last 14 Days (Tag Breakdown) ===`);
    parts.push(dailyLines.join("\n"));
  } else {
    parts.push(`\nNo focus sessions in the last 14 days.`);
  }

  parts.push(`\n=== Current Timer State ===`);
  parts.push(`Mode: ${timerMode} (${timerStatus})`);
  parts.push(timerDetail);
  if (timer.currentTag) parts.push(`Currently focusing on: ${timer.currentTag}`);

  return parts.join("\n");
}

function estimateTokens(text: string): string {
  const count = Math.round(text.length / 4);
  if (count >= 1000) return `~${(count / 1000).toFixed(1)}k tokens`;
  return `~${count} tokens`;
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AIPage(): JSX.Element {
  const {
    chats,
    aiConfig,
    loading,
    loadChats,
    loadAIConfig,
    createChat,
    deleteChat,
    loadMessages,
    saveAIConfig,
  } = useAIChat();
  const { focusSessions, loadFocusSessions } = useFocus();
  const { name, dob, loadConfig } = useConfig();
  const { rewardPoints, loadRewards } = useRewards();
  const { state: timerState } = usePomo();

  const [activeChat, setActiveChat] = useState<AIChat | null>(null);
  const [activeChatMessages, setActiveChatMessages] = useState<Message[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    loadChats();
    loadAIConfig();
    loadFocusSessions();
    loadConfig();
    loadRewards();
  }, [loadChats, loadAIConfig, loadFocusSessions, loadConfig, loadRewards]);

  useEffect(() => {
    if (aiConfig?.defaultModelId) {
      setSelectedModelId(aiConfig.defaultModelId);
    }
  }, [aiConfig?.defaultModelId]);

  const handleSelectChat = useCallback(
    async (chat: AIChat) => {
      setLoadingMessages(true);
      const msgs = await loadMessages(chat.id);
      setActiveChatMessages(msgs);
      setActiveChat(chat);
      setSelectedModelId(chat.modelId || DEFAULT_MODEL_ID);
      setLoadingMessages(false);
    },
    [loadMessages]
  );

  const handleNewChat = useCallback(async () => {
    const model =
      AI_MODELS.find((m) => m.id === selectedModelId) ||
      AI_MODELS[AI_MODELS.length - 1];
    const chat = await createChat(model.id, model.provider);
    setActiveChatMessages([]);
    setActiveChat(chat);
  }, [createChat, selectedModelId]);

  const handleDeleteChat = useCallback(
    async (chatId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await deleteChat(chatId);
      if (activeChat?.id === chatId) {
        setActiveChat(null);
        setActiveChatMessages([]);
      }
      toast.success("Chat deleted");
    },
    [deleteChat, activeChat]
  );

  const selectedModel =
    AI_MODELS.find((m) => m.id === selectedModelId) ||
    AI_MODELS[AI_MODELS.length - 1];

  const apiKey =
    selectedModel?.provider === "groq"
      ? aiConfig?.groqApiKey || ""
      : aiConfig?.googleApiKey || "";
  console.log("API Key", apiKey)

  const hasCustomPrompt = !!aiConfig?.customPrompt;

  const timerContextData: TimerContextData = {
    mode: timerState.mode,
    isRunning: timerState.isRunning,
    phase: timerState.phase,
    elapsedSeconds: timerState.elapsedSeconds,
    pomodoroSettings: timerState.pomodoroSettings,
    currentTag: timerState.data?.tag || "",
  };

  const focusContextStr = buildFocusContext(focusSessions, rewardPoints, name, dob, timerContextData);
  const systemPrompt = aiConfig?.customContextEnabled
    ? `${aiConfig.customPrompt ? aiConfig.customPrompt + "\n\n" : ""}${focusContextStr}`
    : hasCustomPrompt
      ? aiConfig.customPrompt
      : undefined;

  const contextTokenLabel = aiConfig?.customContextEnabled
    ? estimateTokens((aiConfig.customPrompt ? aiConfig.customPrompt + "\n\n" : "") + focusContextStr)
    : null;

  const noApiKey = !apiKey;

  const handleToggleContext = useCallback(async () => {
    if (!aiConfig) return;
    await saveAIConfig({ ...aiConfig, customContextEnabled: !aiConfig.customContextEnabled });
  }, [aiConfig, saveAIConfig]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      {/* ── Left panel: chat list ── */}
      <aside className="w-60 shrink-0 border-r flex flex-col bg-sidebar/50">
        <div className="px-3 py-2.5 border-b flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Chats
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 rounded-md"
            onClick={handleNewChat}
            title="New chat"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-1.5 space-y-0.5">
            {loading ? (
              <SidebarSkeleton />
            ) : chats.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground/60 text-xs px-4 leading-relaxed">
                No conversations yet.
                <br />
                Press + to start one.
              </p>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-xs transition-colors group",
                    activeChat?.id === chat.id
                      ? "bg-accent text-foreground font-medium border-l-2 border-primary rounded-l-none"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <MessageSquare className="size-3 shrink-0 opacity-50" />
                  <span className="truncate flex-1 min-w-0">{chat.title}</span>
                  <span
                    role="button"
                    onClick={(e) => handleDeleteChat(chat.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20 hover:text-destructive ml-auto shrink-0"
                  >
                    <Trash2 className="size-3" />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="p-2 border-t">
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            <Settings className="size-3.5" />
            API Keys & Settings
          </button>
        </div>
      </aside>

      {/* ── Right panel: chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        {/* <div className="h-12 border-b flex items-center px-4 gap-2 shrink-0 bg-background/80 backdrop-blur-sm">
          {loading ? (
            <>
              <div className="h-5 w-16 rounded-full bg-muted-foreground/15 animate-pulse" />
              <div className="h-5 w-24 rounded-full bg-muted-foreground/15 animate-pulse" />
            </>
          ) : (
            <>
              {aiConfig?.customContextEnabled && (
                <Badge
                  variant="secondary"
                  className="text-xs gap-1 py-0.5 bg-primary/10 text-primary border-primary/20"
                >
                  <Sparkles className="size-3" />
                  Context
                </Badge>
              )}
              {noApiKey && (
                <Badge
                  variant="secondary"
                  className="text-xs gap-1 py-0.5 bg-destructive/10 text-destructive border-destructive/20"
                >
                  <AlertCircle className="size-3" />
                  No key for {PROVIDER_LABELS[selectedModel?.provider]}
                </Badge>
              )}
            </>
          )}
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <Settings className="size-4" />
            </Button>
          </div>
        </div> */}

        {/* Content */}
        {!activeChat ? (
          <EmptyState
            onNewChat={handleNewChat}
            noApiKey={noApiKey}
            onOpenSettings={() => setSettingsOpen(true)}
            selectedModel={selectedModel}
          />
        ) : loadingMessages ? (
          <ChatLoadingSkeleton />
        ) : (
          <ChatThread
            key={activeChat.id}
            chatId={activeChat.id}
            initialMessages={activeChatMessages}
            modelId={selectedModelId}
            onModelChange={setSelectedModelId}
            provider={selectedModel.provider}
            apiKey={apiKey}
            systemPrompt={systemPrompt}
            disabled={noApiKey}
            customContextEnabled={!!aiConfig?.customContextEnabled}
            onToggleContext={handleToggleContext}
            contextTokenLabel={contextTokenLabel}
          />
        )}
      </div>

      {/* Settings dialog */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        focusSessions={focusSessions}
      />
    </div>
  );
}

// ── Skeletons ──────────────────────────────────────────────────────────────

function SidebarSkeleton(): JSX.Element {
  const widths = ["w-3/4", "w-1/2", "w-5/6", "w-2/3", "w-4/5"];
  return (
    <div className="p-1 space-y-0.5">
      {widths.map((w, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-2.5 py-2 rounded-md mx-0.5"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="size-3 rounded-sm bg-muted-foreground/15 animate-pulse shrink-0" />
          <div
            className={`h-2.5 rounded-full bg-muted-foreground/15 animate-pulse ${w}`}
            style={{ animationDelay: `${i * 60}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

function ChatLoadingSkeleton(): JSX.Element {
  const messages = [
    { role: "user", lines: ["w-48", "w-36"] },
    { role: "assistant", lines: ["w-64", "w-52", "w-40"] },
    { role: "user", lines: ["w-32"] },
    { role: "assistant", lines: ["w-56", "w-44", "w-60", "w-28"] },
  ] as const;

  return (
    <div className="flex-1 overflow-hidden">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            style={{ animation: `fadeIn 0.4s ease both`, animationDelay: `${i * 80}ms` }}
          >
            {msg.role === "assistant" && (
              <div className="size-7 rounded-full bg-muted/50 animate-pulse shrink-0 mt-0.5" />
            )}
            <div className={`space-y-2 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
              <div
                className={`rounded-2xl px-4 py-3 space-y-2 animate-pulse ${
                  msg.role === "user"
                    ? "bg-primary/[0.06] border border-primary/[0.10] rounded-tr-sm"
                    : "bg-muted/40 rounded-tl-sm"
                }`}
              >
                {msg.lines.map((w, j) => (
                  <div
                    key={j}
                    className={`h-2.5 rounded-full bg-muted-foreground/20 ${w}`}
                    style={{ animationDelay: `${i * 80 + j * 40}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
        {/* active pulse dot at end */}
        <div className="flex justify-start gap-3">
          <div className="size-7 rounded-full bg-muted/50 animate-pulse shrink-0 mt-0.5" />
          <div className="flex items-center gap-1 mt-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="size-1.5 rounded-full bg-primary/30 animate-bounce"
                style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.8s" }}
              />
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}


function CompactModelSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): JSX.Element {
  const grouped = AI_MODELS.reduce(
    (acc, m) => {
      if (!acc[m.provider]) acc[m.provider] = [];
      acc[m.provider].push(m);
      return acc;
    },
    {} as Record<AIProvider, AIModel[]>
  );
  const selectedName = AI_MODELS.find((m) => m.id === value)?.name ?? value;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 gap-1 text-xs border-0 bg-transparent hover:bg-muted px-2.5 rounded-lg focus:ring-0 focus:ring-offset-0 w-auto min-w-0 text-muted-foreground hover:text-foreground transition-colors">
        <span className="truncate max-w-[120px]">{selectedName}</span>
      </SelectTrigger>
      <SelectContent className="text-xs">
        {(Object.entries(grouped) as [AIProvider, AIModel[]][]).map(
          ([provider, models]) => (
            <SelectGroup key={provider}>
              <SelectLabel className="text-xs text-muted-foreground/70 uppercase tracking-wide">
                {PROVIDER_LABELS[provider]}
              </SelectLabel>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )
        )}
      </SelectContent>
    </Select>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({
  onNewChat,
  noApiKey,
  onOpenSettings,
  selectedModel,
}: {
  onNewChat: () => void;
  noApiKey: boolean;
  onOpenSettings: () => void;
  selectedModel: AIModel;
}): JSX.Element {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Bot className="size-7 text-primary/70" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h2 className="text-base font-semibold text-foreground">BIT Focus AI</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Bring your own API key. Your data stays local — all chats saved in
          your browser.
        </p>
      </div>

      {noApiKey ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Add a {PROVIDER_LABELS[selectedModel?.provider]} API key to start
            chatting.
          </p>
          <Button onClick={onOpenSettings} size="sm" className="gap-2">
            <Settings className="size-3.5" />
            Add API Key
          </Button>
        </div>
      ) : (
        <Button onClick={onNewChat} size="sm" className="gap-2">
          <Plus className="size-3.5" />
          New Conversation
        </Button>
      )}
    </div>
  );
}

// ── Chat thread ────────────────────────────────────────────────────────────

interface ChatThreadProps {
  chatId: string;
  initialMessages: Message[];
  modelId: string;
  onModelChange: (v: string) => void;
  provider: AIProvider;
  apiKey: string;
  systemPrompt?: string;
  disabled?: boolean;
  customContextEnabled: boolean;
  onToggleContext: () => void;
  contextTokenLabel: string | null;
}

function ChatThread({
  chatId,
  initialMessages,
  modelId,
  onModelChange,
  provider,
  apiKey,
  systemPrompt,
  disabled,
  customContextEnabled,
  onToggleContext,
  contextTokenLabel,
}: ChatThreadProps): JSX.Element {
  const { saveMessages, updateChatTitle, chats } = useAIChat();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleUpdatedRef = useRef(false);

  console.warn("ChatThread props", { chatId, modelId, provider, systemPrompt, disabled, apiKey });
  const bodyRef = useRef({ modelId, apiKey, provider, systemPrompt });
  useEffect(() => {
    bodyRef.current = { modelId, apiKey, provider, systemPrompt };
  }, [modelId, apiKey, provider, systemPrompt]);

  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      body: () => bodyRef.current, // Resolvable<object> strictly evaluated, must be sync
    });
  }, []);

  const chat = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onError: (err) => {
      toast.error(`AI error: ${err.message}`);
    },
  });

  const runtime = useAISDKRuntime(chat);

  // Debounced save to IndexedDB
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (chat.messages.length > 0) {
        saveMessages(chatId, chat.messages);
      }
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [chat.messages, chatId, saveMessages]);

  // Update title from first user message
  useEffect(() => {
    if (titleUpdatedRef.current) return;
    const current = chats.find((c) => c.id === chatId);
    if (!current || current.title !== "New Chat") {
      titleUpdatedRef.current = true;
      return;
    }
    const firstUser = chat.messages.find((m) => m.role === "user");
    if (firstUser) {
      const textPart = firstUser.parts?.find((p) => p.type === "text") as { type: "text", text: string } | undefined;
      const rawContent = textPart?.text || "";
      const title = rawContent.slice(0, 60) || "New Chat";
      updateChatTitle(chatId, title);
      titleUpdatedRef.current = true;
    }
  }, [chat.messages, chatId, chats, updateChatTitle]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadUI
        disabled={disabled}
        modelId={modelId}
        onModelChange={onModelChange}
        customContextEnabled={customContextEnabled}
        onToggleContext={onToggleContext}
        contextTokenLabel={contextTokenLabel}
      />
    </AssistantRuntimeProvider>
  );
}

// ── Thread UI (assistant-ui primitives) ───────────────────────────────────

interface ThreadUIProps {
  disabled?: boolean;
  modelId: string;
  onModelChange: (v: string) => void;
  customContextEnabled: boolean;
  onToggleContext: () => void;
  contextTokenLabel: string | null;
}

function ThreadUI({ disabled, modelId, onModelChange, customContextEnabled, onToggleContext, contextTokenLabel }: ThreadUIProps): JSX.Element {
  return (
    <ThreadPrimitive.Root className="flex flex-col h-full overflow-hidden">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <ThreadPrimitive.Empty>
            <div className="flex flex-col items-center justify-center gap-3 text-center min-h-96">
              <Sparkles className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Type a message to begin.
              </p>
            </div>
          </ThreadPrimitive.Empty>

          <ThreadPrimitive.Messages
            components={{
              UserMessage: UserMessage,
              AssistantMessage: AssistantMessage,
            }}
          />
          <ThreadPrimitive.If running>
            <div className="flex justify-start mb-6">
              <div className="flex gap-3 max-w-[85%] min-w-0">
                <div className="size-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="size-3.5 text-primary/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <ThinkingDots />
                </div>
              </div>
            </div>
          </ThreadPrimitive.If>
        </div>
      </ThreadPrimitive.Viewport>

      {/* Composer */}
      <div className="p-4 pb-5">
        <div className="max-w-3xl mx-auto">
          {disabled ? (
            <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl border border-border/60 bg-muted/20 text-muted-foreground text-sm">
              <AlertCircle className="size-4 shrink-0" />
              <span className="text-xs">Add an API key in settings to start chatting.</span>
            </div>
          ) : (
            <ComposerPrimitive.Root className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm shadow-sm overflow-hidden focus-within:border-border focus-within:bg-card/80 transition-all duration-200">
              {/* Input area */}
              <ComposerPrimitive.Input
                className="w-full bg-transparent resize-none outline-none text-sm min-h-[52px] max-h-48 leading-relaxed px-4 pt-3.5 pb-2 placeholder:text-muted-foreground/50 block"
                placeholder="Message AI…"
                rows={2}
              />
              {/* Bottom toolbar */}
              <div className="flex items-center gap-2 px-3 py-2 border-t border-border/30">
                {/* Context toggle pill */}
                <button
                  type="button"
                  onClick={onToggleContext}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 border",
                    customContextEnabled
                      ? "bg-primary/10 text-primary border-primary/25 hover:bg-primary/15"
                      : "text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                  )}
                  title="Toggle focus context"
                >
                  <Sparkles className="size-3" />
                  Context
                  {customContextEnabled && contextTokenLabel && (
                    <span className="opacity-70 font-normal">{contextTokenLabel}</span>
                  )}
                </button>

                <div className="ml-auto flex items-center gap-1">
                  {/* Inline model selector */}
                  <CompactModelSelector value={modelId} onChange={onModelChange} />

                  {/* Stop */}
                  <ComposerPrimitive.Cancel asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <StopCircle className="size-3.5" />
                    </Button>
                  </ComposerPrimitive.Cancel>

                  {/* Send */}
                  <ComposerPrimitive.Send asChild>
                    <Button size="icon" className="size-7 rounded-lg">
                      <Send className="size-3.5" />
                    </Button>
                  </ComposerPrimitive.Send>
                </div>
              </div>
            </ComposerPrimitive.Root>
          )}
        </div>
      </div>
    </ThreadPrimitive.Root>
  );
}

// ── Message components ─────────────────────────────────────────────────────

function UserMessage(): JSX.Element {
  return (
    <MessagePrimitive.Root className="flex justify-end mb-6 group">
      <div className="max-w-[70%] min-w-0">
        <div className="bg-primary/[0.08] border border-primary/[0.12] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
          <MessagePrimitive.Content />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage(): JSX.Element {
  return (
    <MessagePrimitive.Root className="flex justify-start mb-6 group">
      <div className="flex gap-3 max-w-[85%] min-w-0">
        <div className="size-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="size-3.5 text-primary/70" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm leading-relaxed prose-message">
            <MessagePrimitive.Content
              components={{ Text: MarkdownText }}
            />
          </div>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function MarkdownText({ text }: { text: string }): JSX.Element {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none text-foreground/75 prose-p:text-foreground/75 prose-li:text-foreground/75",
        // spacing
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "prose-p:leading-relaxed prose-p:my-2",
        "prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2",
        // headings
        "prose-headings:font-semibold prose-headings:text-foreground prose-headings:mt-4 prose-headings:mb-1.5",
        // links
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-a:font-normal",
        // strong / em
        "prose-strong:font-semibold prose-strong:text-foreground",
        // blockquote
        "prose-blockquote:border-l-2 prose-blockquote:border-primary/30 prose-blockquote:text-muted-foreground prose-blockquote:not-italic prose-blockquote:pl-3",
        // inline code
        "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.8em] prose-code:font-mono prose-code:text-foreground",
        "prose-code:before:content-none prose-code:after:content-none",
        // code block
        "prose-pre:bg-muted/60 prose-pre:border prose-pre:border-border/60 prose-pre:rounded-lg prose-pre:text-xs",
        "prose-pre:overflow-x-auto",
        // table
        "prose-table:text-xs prose-th:font-semibold prose-th:text-foreground",
        "prose-thead:border-b prose-thead:border-border",
        "prose-tr:border-b prose-tr:border-border/50",
        "prose-td:py-1.5 prose-th:py-1.5",
        // hr
        "prose-hr:border-border/50",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Prevent wrapping lone inline elements in <p> when already in a block
          // Override pre+code to avoid double-nested font scaling
          pre: ({ children }) => (
            <pre className="bg-muted/60 border border-border/60 rounded-lg p-3 text-xs overflow-x-auto my-3 font-mono leading-relaxed">
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = !!className;
            if (isBlock) {
              return (
                <code className={cn("text-foreground/90", className)} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-[0.8em] font-mono text-foreground" {...props}>
                {children}
              </code>
            );
          },
          // Task list checkboxes
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

function ThinkingDots(): JSX.Element {
  return (
    <div className="flex items-center gap-1 mt-2 h-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="size-1.5 rounded-full bg-primary/40 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

// ── Settings Dialog ────────────────────────────────────────────────────────

function SettingsDialog({
  open,
  onClose,
  focusSessions,
}: {
  open: boolean;
  onClose: () => void;
  focusSessions: FocusSession[];
}): JSX.Element {
  const { aiConfig, saveAIConfig } = useAIChat();
  const { name: configName, dob: configDob } = useConfig();
  const { rewardPoints: configPoints } = useRewards();
  const { state: configTimerState } = usePomo();
  const [groqKey, setGroqKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [showGroq, setShowGroq] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);
  const [customContextEnabled, setCustomContextEnabled] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [defaultModelId, setDefaultModelId] = useState(DEFAULT_MODEL_ID);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (aiConfig && open) {
      setGroqKey(aiConfig.groqApiKey || "");
      setGoogleKey(aiConfig.googleApiKey || "");
      setCustomContextEnabled(aiConfig.customContextEnabled || false);
      setCustomPrompt(aiConfig.customPrompt || "");
      setDefaultModelId(aiConfig.defaultModelId || DEFAULT_MODEL_ID);
    }
  }, [aiConfig, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAIConfig({
        groqApiKey: groqKey,
        googleApiKey: googleKey,
        customContextEnabled,
        customPrompt,
        defaultModelId,
      });
      toast.success("Settings saved");
      onClose();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const focusPreview = buildFocusContext(focusSessions, configPoints, configName, configDob, {
    mode: configTimerState.mode,
    isRunning: configTimerState.isRunning,
    phase: configTimerState.phase,
    elapsedSeconds: configTimerState.elapsedSeconds,
    pomodoroSettings: configTimerState.pomodoroSettings,
    currentTag: configTimerState.data?.tag || "",
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">AI Settings</DialogTitle>
          <DialogDescription className="text-xs">
            Keys stored locally in your browser (IndexedDB). Never sent to our servers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Default model */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Default Model</Label>
            <Select value={defaultModelId} onValueChange={setDefaultModelId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(
                    AI_MODELS.reduce(
                      (acc, m) => {
                        if (!acc[m.provider]) acc[m.provider] = [];
                        acc[m.provider].push(m);
                        return acc;
                      },
                      {} as Record<AIProvider, AIModel[]>
                    )
                  ) as [AIProvider, AIModel[]][]
                ).map(([provider, models]) => (
                  <SelectGroup key={provider}>
                    <SelectLabel className="text-xs text-muted-foreground/70 uppercase tracking-wide">
                      {PROVIDER_LABELS[provider]}
                    </SelectLabel>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* API Keys */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
              API Keys
            </h3>

            {/* Groq */}
            <div className="space-y-1.5">
              <Label htmlFor="groq-key" className="text-xs">
                Groq API Key
              </Label>
              <div className="relative">
                <Input
                  id="groq-key"
                  type={showGroq ? "text" : "password"}
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_…"
                  className="h-8 text-xs pr-9 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowGroq((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showGroq ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Google */}
            <div className="space-y-1.5">
              <Label htmlFor="google-key" className="text-xs">
                Google AI API Key
              </Label>
              <div className="relative">
                <Input
                  id="google-key"
                  type={showGoogle ? "text" : "password"}
                  value={googleKey}
                  onChange={(e) => setGoogleKey(e.target.value)}
                  placeholder="AIza…"
                  className="h-8 text-xs pr-9 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowGoogle((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showGoogle ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Custom Context */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
                  Custom Context
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Inject your focus data + custom prompt into every chat.
                </p>
              </div>
              <Switch
                checked={customContextEnabled}
                onCheckedChange={setCustomContextEnabled}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="custom-prompt" className="text-xs">
                Custom System Prompt
                <span className="text-muted-foreground/60 ml-1 font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="custom-prompt"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="You are a productivity coach. Help me analyze my focus patterns and suggest improvements…"
                className="text-xs min-h-[80px] resize-none leading-relaxed"
              />
            </div>

            {customContextEnabled && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Info className="size-3" />
                  Focus data preview
                </div>
                <pre className="text-xs text-muted-foreground/80 whitespace-pre-wrap font-mono leading-relaxed">
                  {focusPreview}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs">
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
