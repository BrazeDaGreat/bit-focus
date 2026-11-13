"use client";

/**
 * AI Chat - History Rail
 *
 * Searchable list of conversations with pin, rename, export, and delete.
 */

import { useState, useMemo, type JSX } from "react";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Settings, Download, Pin, PinOff, Pencil, Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchChat, parseMessages as parseStoredMessages } from "@/lib/ai-conversations";
import type { AIChat } from "@/lib/db";
import { downloadChat } from "./chat-shared";

// ── History rail ──────────────────────────────────────────────────────────────

export function History({
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
      ? chats.filter((c) => searchChat(c.title, c.messages, term) !== null)
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
                    snippet={query.trim() ? searchChat(chat.title, chat.messages, query) : null}
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
  snippet,
  chat,
  active,
  onSelect,
  onDelete,
  onTogglePin,
  onRename,
}: {
  chat: AIChat;
  snippet?: string | null;
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
        "group flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 transition-colors",
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
        {snippet && <span className="mt-1 block truncate text-[11px] text-muted-foreground">{snippet}</span>}
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
          <DropdownMenuItem onClick={() => downloadChat(chat.title, parseStoredMessages(chat.messages))} className="gap-2 text-xs"><Download className="size-3" /> Export Markdown</DropdownMenuItem>
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
