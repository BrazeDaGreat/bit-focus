"use client";

/**
 * AI Chat - Settings
 *
 * Endpoint, model, and key settings, plus the context preview.
 */

import { useState, useEffect, useMemo, type JSX } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIChat } from "@/hooks/useAIChat";
import { DEFAULT_BASE_URL, DEFAULT_MODEL_ID, ENDPOINT_PRESETS, findPresetForUrl, isLocalEndpoint } from "@/lib/ai-models";
import { buildContext, type ContextInput } from "@/lib/ai-context";
import { toast } from "sonner";
import { DEFAULT_CONTEXT } from "./chat-shared";

// ── Settings ──────────────────────────────────────────────────────────────────

export function SettingsDialog({
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
