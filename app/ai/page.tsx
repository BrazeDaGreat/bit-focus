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

import { useState, useEffect, useCallback, useMemo, type JSX } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Plus, Settings, MessageSquare } from "lucide-react";
import { useAIChat } from "@/hooks/useAIChat";
import { useFocus } from "@/hooks/useFocus";
import { useConfig } from "@/hooks/useConfig";
import { useRewards } from "@/hooks/useRewards";
import { useRewardSettings } from "@/hooks/useRewardSettings";
import { goalOf, priceOf, summarizeLedger } from "@/lib/rewards";
import { useTasks } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { useTag } from "@/hooks/useTag";
import { usePomo } from "@/hooks/PomoContext";
import { DEFAULT_BASE_URL, DEFAULT_MODEL_ID, isLocalEndpoint } from "@/lib/ai-models";
import { type ContextInput } from "@/lib/ai-context";
import type { AIChat } from "@/lib/db";
import { type UIMessage as Message } from "ai";
import { toast } from "sonner";
import { History } from "@/components/ai/ChatHistory";
import { Thread, EmptyThread, ThreadSkeleton } from "@/components/ai/ChatThread";
import { SettingsDialog } from "@/components/ai/AISettingsDialog";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AIPage(): JSX.Element {
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
    restoreCachedModels,
  } = useAIChat();
  const { focusSessions, loadFocusSessions } = useFocus();
  const { name, dob, loadConfig } = useConfig();
  const { items: rewardsItems, ledger: rewardsLedger, ensureLoaded, getTotalDiscount } = useRewards();
  const { rate, tagRates, debtCap } = useRewardSettings();
  const { projects, loadProjects } = useProjects();
  const { tasks, loadTasks } = useTasks();
  const { state: timerState } = usePomo();
  const { tag: activeTag } = useTag();

  const [activeChat, setActiveChat] = useState<AIChat | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    restoreCachedModels();
    loadChats();
    loadAIConfig();
    loadFocusSessions();
    loadConfig();
    void ensureLoaded();
    loadProjects();
    loadTasks();
  }, [
    restoreCachedModels,
    loadChats,
    loadAIConfig,
    loadFocusSessions,
    loadConfig,
    ensureLoaded,
    loadProjects,
    loadTasks,
  ]);

  useEffect(() => {
    if (aiConfig?.defaultModelId) setModelId(aiConfig.defaultModelId);
  }, [aiConfig?.defaultModelId]);

  const baseUrl = aiConfig?.baseUrl || DEFAULT_BASE_URL;
  const apiKey =
    aiConfig?.apiKey || aiConfig?.groqApiKey || aiConfig?.googleApiKey || "";
  const configured = Boolean(baseUrl && (apiKey || isLocalEndpoint(baseUrl)));

  const rewardDiscount = getTotalDiscount();
  const contextInput: ContextInput = useMemo(
    () => ({
      name,
      dob,
      rewards: (() => {
        const now = new Date();
        const goal = goalOf(rewardsItems);
        return { summary: summarizeLedger(rewardsLedger, now), rate, tagRates, debtCap,
          goal: goal ? { title: goal.title, price: priceOf(goal, rewardsLedger, rewardDiscount, now).final } : undefined };
      })(),
      focusSessions,
      projects,
      tasks,
      timer: {
        mode: timerState.mode,
        phase: timerState.phase,
        isRunning: timerState.isRunning,
        elapsedSeconds: timerState.elapsedSeconds,
        currentTag: timerState.task?.tag || activeTag || "",
      },
    }),
    [
      name,
      dob,
      rewardsItems, rewardsLedger, rate, tagRates, debtCap, rewardDiscount,
      focusSessions,
      projects,
      tasks,
      timerState,
      activeTag,
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
            onBranch={openChat}
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
    </div>
  );
}
