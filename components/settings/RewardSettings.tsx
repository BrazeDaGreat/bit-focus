"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Gems } from "@/components/rewards/Gem";
import { useRewardSettings, MAX_RATE } from "@/hooks/useRewardSettings";
import { useConfig } from "@/hooks/useConfig";
import { useTag } from "@/hooks/useTag";
import { earnedFor, formatGems, parseGems } from "@/lib/rewards";

export default function RewardSettings() {
  const settings = useRewardSettings();
  const { rate, tagRates, update, setTagRate, nudgeTagRate } = settings;
  const savedTags = useTag((s) => s.savedTags);
  const webhook = useConfig((s) => s.webhook);
  const hasWebhook = !!webhook.trim();
  const tags = [...savedTags, ...Object.keys(tagRates).filter((tag) => !savedTags.some((saved) => saved.t === tag)).map((t) => ({ t, c: undefined }))];

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label htmlFor="reward-rate">Gems per focused hour</Label>
          <RateControl id="reward-rate" label="Overall earn rate" value={rate} onChange={(value) => update({ rate: value })} onNudge={(delta) => update({ rate: rate + delta })} />
        </div>
        <p className="text-xs text-muted-foreground">A 25-minute session earns <Gems amount={earnedFor(25 * 60, rate)} />.</p>
      </div>

      <div className="grid gap-2">
        <h3 className="text-sm font-medium">Per-tag rates</h3>
        {tags.length === 0 ? <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">Save tags on Home to give each its own earn rate.</p> : (
          <div className="grid gap-1 rounded-xl bg-muted/60 p-1">
            {tags.map((tag) => {
              const own = Object.hasOwn(tagRates, tag.t);
              const value = tagRates[tag.t] ?? rate;
              return <TagRateRow key={tag.t} tag={tag.t} color={tag.c} value={value} own={own}
                onChange={(value) => setTagRate(tag.t, value)} onNudge={(delta) => nudgeTagRate(tag.t, delta)} onReset={() => setTagRate(tag.t, null)} />;
            })}
          </div>
        )}
      </div>

      <div className="grid gap-2 border-t pt-5">
        <Label htmlFor="reward-debt-cap">Debt cap</Label>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Let redemptions go below zero by up to</span>
          <AmountInput id="reward-debt-cap" label="Debt cap in gems" amount={settings.debtCap} onChange={(debtCap) => update({ debtCap })} />
          <span>gems</span>
        </div>
        <p className="text-xs text-muted-foreground">Zero means redemptions can never take your balance below zero.</p>
      </div>

      <div className="grid gap-3 border-t pt-5">
        <h3 className="text-sm font-medium">Loan defaults</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="reward-interest">Interest (%)</Label>
            <NumberInput id="reward-interest" label="Loan interest percent" value={settings.loanInterestPercent} max={100} onChange={(loanInterestPercent) => update({ loanInterestPercent })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reward-repay">Earnings used to repay (%)</Label>
            <NumberInput id="reward-repay" label="Percent of each earning used to repay loans" value={settings.loanRepayPercent} max={100} onChange={(loanRepayPercent) => update({ loanRepayPercent })} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-t pt-5">
        <h3 className="text-sm font-medium">Webhook events</h3>
        {!hasWebhook && <p className="text-xs text-muted-foreground">Set a webhook URL in Notifications to post reward events.</p>}
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="reward-webhook-redeem">Post redemptions</Label>
          <Switch id="reward-webhook-redeem" disabled={!hasWebhook} checked={settings.webhookRedeem} onCheckedChange={(webhookRedeem) => update({ webhookRedeem })} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="reward-webhook-earn">Post earnings</Label>
          <Switch id="reward-webhook-earn" disabled={!hasWebhook} checked={settings.webhookEarn} onCheckedChange={(webhookEarn) => update({ webhookEarn })} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Label htmlFor="reward-webhook-min">Only earnings of at least</Label>
          <AmountInput id="reward-webhook-min" label="Minimum earning to post in gems" amount={settings.webhookEarnMin} disabled={!hasWebhook || !settings.webhookEarn} onChange={(webhookEarnMin) => update({ webhookEarnMin })} />
          <span>gems</span>
        </div>
      </div>
    </div>
  );
}

function TagRateRow({ tag, color, value, own, onChange, onNudge, onReset }: {
  tag: string; color?: string; value: number; own: boolean;
  onChange: (value: number) => void; onNudge: (delta: number) => void; onReset: () => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2">
      <div className="min-w-0 flex-1 basis-32">
        <Label htmlFor={id} className="flex items-center gap-2 break-all text-sm">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-muted-foreground" style={color ? { backgroundColor: color } : undefined} />
          {tag}
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          {!own && <>Uses <span className="font-mono tabular-nums">{value.toFixed(2)}/h</span>{value === 0 ? "; earns nothing" : ""}</>}
          {own && (value === 0 ? "This tag earns nothing." : "Custom rate")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <RateControl id={id} label={`Earn rate for ${tag}`} value={value} muted={!own} onChange={onChange} onNudge={onNudge} />
        <Button variant="ghost" size="sm" className="h-9 rounded-lg px-2 text-xs" disabled={!own} onClick={onReset}>Use overall rate</Button>
      </div>
    </div>
  );
}

function RateControl({ id, label, value, muted, onChange, onNudge }: {
  id: string; label: string; value: number; muted?: boolean; onChange: (value: number) => void; onNudge: (delta: number) => void;
}) {
  return <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
    <Button variant="ghost" size="icon" className="size-9 rounded-lg" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= 0} onClick={() => onNudge(-0.25)}><Minus className="size-3.5" /></Button>
    <NumberInput id={id} label={label} value={value} max={MAX_RATE} step={0.25} muted={muted} onChange={onChange} />
    <Button variant="ghost" size="icon" className="size-9 rounded-lg" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= MAX_RATE} onClick={() => onNudge(0.25)}><Plus className="size-3.5" /></Button>
  </div>;
}

function NumberInput({ id, label, value, max, step = 1, muted, onChange }: {
  id: string; label: string; value: number; max: number; step?: number; muted?: boolean; onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value.toFixed(step < 1 ? 2 : 0));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value.toFixed(step < 1 ? 2 : 0));
  }, [value, step]);
  return <Input id={id} aria-label={label} type="number" min={0} max={max} step={step} value={draft}
    className={`h-9 w-24 rounded-lg font-mono tabular-nums ${muted ? "text-muted-foreground" : ""}`}
    onFocus={() => { focused.current = true; }}
    onChange={(e) => {
      const text = e.target.value;
      setDraft(text);
      const parsed = Number(text);
      if (text.trim() && Number.isFinite(parsed)) onChange(Math.max(0, Math.min(max, parsed)));
    }} onBlur={() => {
      focused.current = false;
      const parsed = Number(draft);
      if (draft.trim() && Number.isFinite(parsed)) onChange(Math.max(0, Math.min(max, parsed)));
      setDraft((draft.trim() && Number.isFinite(parsed) ? Math.max(0, Math.min(max, parsed)) : value).toFixed(step < 1 ? 2 : 0));
    }} />;
}

function AmountInput({ id, label, amount, disabled, onChange }: {
  id: string; label: string; amount: number; disabled?: boolean; onChange: (amount: number) => void;
}) {
  const [draft, setDraft] = useState(formatGems(amount));
  useEffect(() => setDraft(formatGems(amount)), [amount]);
  return <Input id={id} aria-label={label} type="number" inputMode="decimal" min={0} step="0.01" disabled={disabled} value={draft}
    className="h-9 w-24 rounded-lg font-mono tabular-nums" onChange={(e) => setDraft(e.target.value)} onBlur={() => {
      const parsed = parseGems(draft);
      const next = parsed === null ? amount : Math.max(0, parsed);
      onChange(next);
      setDraft(formatGems(next));
    }} />;
}
