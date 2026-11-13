"use client";

/**
 * AI Chat - Messages
 *
 * User and assistant bubbles, tool chips, confirmation cards, and Markdown.
 */

import { useState, memo, type JSX, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GitBranch, NotebookPen, Bot, Check, Copy, Pencil, RefreshCw, Database, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { attachmentsOf, messageText } from "@/lib/ai-conversations";
import { SourceLinks } from "@/components/ai/ChatExtras";
import { TOOL_LABELS, describeToolCall } from "@/lib/ai-tools";
import { type UIMessage as Message } from "ai";
import type { PendingCall } from "./chat-shared";

// ── Messages ──────────────────────────────────────────────────────────────────

export function AssistantAvatar(): JSX.Element {
  return (
    <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/12">
      <Bot className="size-3.5 text-primary" />
    </div>
  );
}

export function UserMessage({
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
        <SourceLinks sources={attachmentsOf(message)} />
      </div>
      <div className="flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100">
        <CopyButton text={text} />
        <MessageAction onClick={onStartEdit} label="Edit and resend">
          <Pencil className="size-3" />
        </MessageAction>
      </div>
    </div>
  );
}

export function AssistantMessage({
  message,
  modelId,
  pending,
  onResolve,
  sources,
  canAct,
  onSave,
  onBranch,
  canRegenerate,
  onRegenerate,
}: {
  message: Message;
  modelId: string;
  pending: PendingCall[];
  onResolve: (call: PendingCall, approved: boolean) => void;
  sources: { label: string; href: string }[];
  canAct: boolean;
  onSave: () => void;
  onBranch: () => void;
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
        <SourceLinks sources={sources} />

        <div className="mt-1.5 flex items-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100">
          <CopyButton text={text} />
          {canAct && <>
            {text && <MessageAction label="Save answer to Notes" onClick={onSave}><NotebookPen className="size-3" /></MessageAction>}
            <MessageAction label="Branch from here" onClick={onBranch}><GitBranch className="size-3" /></MessageAction>
          </>}
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

export function MessageAction({
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

export function CopyButton({ text }: { text: string }): JSX.Element {
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

export function ToolChip({
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

export function ConfirmCard({
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

export function ThinkingDots(): JSX.Element {
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


// ── Markdown ──────────────────────────────────────────────────────────────────

// Timer context refreshes must not remount custom Markdown code/input renderers.
export const MarkdownText = memo(function MarkdownText({ text }: { text: string }): JSX.Element {
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
});
