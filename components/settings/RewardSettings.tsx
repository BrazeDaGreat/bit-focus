"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIELD_CLASS, Group, Row, SettingsButton, Well } from "@/components/settings/parts";
import { Switch } from "@/components/ui/switch";
import { Gems } from "@/components/rewards/Gem";
import { useRewardSettings, MAX_RATE } from "@/hooks/useRewardSettings";
import { useTag } from "@/hooks/useTag";
import { earnedFor, formatGems, parseGems } from "@/lib/rewards";
import { cn } from "@/lib/utils";

export default function RewardSettings() {
  const settings = useRewardSettings();
  const { rate, tagRates, update, setTagRate, nudgeTagRate } = settings;
  const savedTags = useTag((s) => s.savedTags);
  const tags = [...savedTags, ...Object.keys(tagRates).filter((tag) => !savedTags.some((saved) => saved.t === tag)).map((t) => ({ t, c: undefined }))];

  return (
    <>
      <Group title="Earning">
        <Well>
          <Row id="reward-rate" label="Gems per focused hour" hint={<>A 25-minute session earns <Gems amount={earnedFor(25 * 60, rate)} />.</>}>
            <RateControl id="reward-rate" label="Overall earn rate" value={rate} onChange={(value) => update({ rate: value })} onNudge={(delta) => update({ rate: rate + delta })} />
          </Row>
        </Well>
      </Group>

      <Group title="Per-tag rates">
        {tags.length === 0 ? (
          <div className="rounded-xl bg-muted/40 px-4 py-3">
            <p className="text-sm font-medium">No saved tags yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Save tags on Home to give each its own earn rate.</p>
          </div>
        ) : (
          <Well>
            {tags.map((tag) => {
              const own = Object.hasOwn(tagRates, tag.t);
              const value = tagRates[tag.t] ?? rate;
              return <TagRateRow key={tag.t} tag={tag.t} color={tag.c} value={value} own={own}
                onChange={(value) => setTagRate(tag.t, value)} onNudge={(delta) => nudgeTagRate(tag.t, delta)} onReset={() => setTagRate(tag.t, null)} />;
            })}
          </Well>
        )}
      </Group>

      <Group title="Borrowing">
        <Well>
          <Row id="reward-debt-cap" label="Debt cap" hint="How far below zero a redemption can take your balance. Zero means never.">
            <Suffixed suffix="gems">
              <AmountInput id="reward-debt-cap" label="Debt cap in gems" amount={settings.debtCap} onChange={(debtCap) => update({ debtCap })} />
            </Suffixed>
          </Row>
          <Row id="reward-interest" label="Loan interest" hint="Default for new loans.">
            <Suffixed suffix="%">
              <NumberInput id="reward-interest" label="Loan interest percent" value={settings.loanInterestPercent} max={100} onChange={(loanInterestPercent) => update({ loanInterestPercent })} />
            </Suffixed>
          </Row>
          <Row id="reward-repay" label="Repayment share" hint="Default share of each earning that repays a loan.">
            <Suffixed suffix="%">
              <NumberInput id="reward-repay" label="Percent of each earning used to repay loans" value={settings.loanRepayPercent} max={100} onChange={(loanRepayPercent) => update({ loanRepayPercent })} />
            </Suffixed>
          </Row>
        </Well>
      </Group>
    </>
  );
}

/** Reward events for the Discord webhook. Rendered inside the Notifications webhook well. */
export function RewardWebhookRows({ disabled }: { disabled: boolean }) {
  const settings = useRewardSettings();
  const { update } = settings;
  return (
    <>
      <Row id="reward-webhook-redeem" label="Post redemptions">
        <Switch id="reward-webhook-redeem" disabled={disabled} checked={settings.webhookRedeem} onCheckedChange={(webhookRedeem) => update({ webhookRedeem })} />
      </Row>
      <Row id="reward-webhook-earn" label="Post earnings">
        <Switch id="reward-webhook-earn" disabled={disabled} checked={settings.webhookEarn} onCheckedChange={(webhookEarn) => update({ webhookEarn })} />
      </Row>
      <Row id="reward-webhook-min" label="Smallest earning to post">
        <Suffixed suffix="gems">
          <AmountInput id="reward-webhook-min" label="Minimum earning to post in gems" amount={settings.webhookEarnMin} disabled={disabled || !settings.webhookEarn} onChange={(webhookEarnMin) => update({ webhookEarnMin })} />
        </Suffixed>
      </Row>
    </>
  );
}

function Suffixed({ suffix, children }: { suffix: string; children: ReactNode }) {
  return <div className="flex items-center gap-2 text-sm text-muted-foreground">{children}<span className="w-9">{suffix}</span></div>;
}

function TagRateRow({ tag, color, value, own, onChange, onNudge, onReset }: {
  tag: string; color?: string; value: number; own: boolean;
  onChange: (value: number) => void; onNudge: (delta: number) => void; onReset: () => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5">
      <div className="min-w-0 flex-1 basis-32">
        <Label htmlFor={id} className="flex items-center gap-2 break-all text-sm font-medium">
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
        {own && <SettingsButton onClick={onReset}>Use overall rate</SettingsButton>}
      </div>
    </div>
  );
}

function RateControl({ id, label, value, muted, onChange, onNudge }: {
  id: string; label: string; value: number; muted?: boolean; onChange: (value: number) => void; onNudge: (delta: number) => void;
}) {
  return <div className="flex items-center gap-1">
    <Button variant="ghost" size="icon" className="size-9 rounded-lg hover:bg-background" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= 0} onClick={() => onNudge(-0.25)}><Minus className="size-3.5" /></Button>
    <NumberInput id={id} label={label} value={value} max={MAX_RATE} step={0.25} muted={muted} onChange={onChange} />
    <Button variant="ghost" size="icon" className="size-9 rounded-lg hover:bg-background" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= MAX_RATE} onClick={() => onNudge(0.25)}><Plus className="size-3.5" /></Button>
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
    className={cn(FIELD_CLASS, "w-24 font-mono tabular-nums", muted && "text-muted-foreground")}
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
    className={cn(FIELD_CLASS, "w-24 font-mono tabular-nums")} onChange={(e) => setDraft(e.target.value)} onBlur={() => {
      const parsed = parseGems(draft);
      const next = parsed === null ? amount : Math.max(0, parsed);
      onChange(next);
      setDraft(formatGems(next));
    }} />;
}
