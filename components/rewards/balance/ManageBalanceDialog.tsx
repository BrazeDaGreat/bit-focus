"use client";

/**
 * Manage Balance Dialog
 *
 * The one place to change the balance by hand: add gems, throw some away,
 * take a loan or repay one. Opened through `useRewardsUi`, so the balance
 * panel and the command palette open the same dialog.
 *
 * @since v0.25.0-beta
 */

import { useEffect, useMemo, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { format } from "date-fns";
import { Check, ChevronDown } from "lucide-react";
import { create } from "zustand";
import { ResponsiveDialog } from "@/components/ui/mobile-drawer";
import { Gems } from "@/components/rewards/Gem";
import { useRewards, useRewardsUi, selectBalance, type BalanceAction } from "@/hooks/useRewards";
import { useRewardSettings } from "@/hooks/useRewardSettings";
import { GEM, formatGems, loansOf, parseGems, type LoanStatus } from "@/lib/rewards";
import { cn } from "@/lib/utils";
import { FIELD, MENU_ITEM, MENU_SURFACE, PRIMARY, QUIET } from "./shared";

/** The loan a "Repay" action asked for, read when the dialog opens. */
const useRepayTarget = create<{ loanUid: string | null }>(() => ({ loanUid: null }));

/** Open the dialog in repay mode with one loan chosen. */
export function openRepay(loanUid: string) {
  useRepayTarget.setState({ loanUid });
  useRewardsUi.getState().openBalanceDialog("repay");
}

const ACTIONS: { id: BalanceAction; label: string; short: string }[] = [
  { id: "add", label: "Add gems", short: "Add" },
  { id: "throw", label: "Throw away", short: "Throw" },
  { id: "loan", label: "Take a loan", short: "Loan" },
  { id: "repay", label: "Repay loan", short: "Repay" },
];

const SUBMIT: Record<BalanceAction, string> = {
  add: "Add gems",
  throw: "Throw away gems",
  loan: "Take loan",
  repay: "Repay",
};

const CHIPS = [50, 100, 200, 500];

const CHIP = "h-8 rounded-lg bg-muted/60 px-2.5 font-mono text-xs tabular-nums text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function percentInput(text: string): string {
  return text.replace(/[^\d]/g, "").slice(0, 3);
}

function clampPercent(text: string, fallback: number): number {
  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback;
}

function loanLabel(loan: LoanStatus): string {
  return `Borrowed ${formatGems(loan.principal)} on ${format(loan.takenAt, "MMM d")}`;
}

export function ManageBalanceDialog() {
  const action = useRewardsUi((s) => s.balanceDialog);
  const openBalanceDialog = useRewardsUi((s) => s.openBalanceDialog);
  const closeBalanceDialog = useRewardsUi((s) => s.closeBalanceDialog);
  const ledger = useRewards((s) => s.ledger);
  const balance = useRewards(selectBalance);
  const addGems = useRewards((s) => s.addGems);
  const throwAway = useRewards((s) => s.throwAway);
  const takeLoan = useRewards((s) => s.takeLoan);
  const repayLoan = useRewards((s) => s.repayLoan);
  const defaultInterest = useRewardSettings((s) => s.loanInterestPercent);
  const defaultRepay = useRewardSettings((s) => s.loanRepayPercent);

  const open = action !== null;
  const mode: BalanceAction = action ?? "add";
  const outstanding = useMemo(() => loansOf(ledger).filter((loan) => loan.outstanding > 0), [ledger]);

  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [interestText, setInterestText] = useState("");
  const [repayText, setRepayText] = useState("");
  const [loanUid, setLoanUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fresh fields each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setAmountText("");
    setNote("");
    setInterestText(String(defaultInterest));
    setRepayText(String(defaultRepay));
    setLoanUid(useRepayTarget.getState().loanUid);
    useRepayTarget.setState({ loanUid: null });
    setBusy(false);
    // Only on open; later setting changes should not wipe what is typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loan = outstanding.find((l) => l.uid === loanUid) ?? outstanding[0];
  const amount = parseGems(amountText);
  const interest = clampPercent(interestText, defaultInterest);
  const repayShare = clampPercent(repayText, defaultRepay);
  const repayMax = loan ? Math.min(loan.outstanding, Math.max(0, balance)) : 0;

  let error: string | null = null;
  if (amountText.trim() && (amount === null || amount <= 0)) error = "Enter an amount above zero.";
  else if (amount !== null && amount > 0) {
    if (mode === "throw" && amount > balance) error = "That's more than your balance.";
    if (mode === "repay" && loan && amount > loan.outstanding) error = "That's more than the loan has left.";
    else if (mode === "repay" && amount > balance) error = "You can't repay more than your balance.";
  }
  const ready = amount !== null && amount > 0 && !error && (mode !== "repay" || !!loan) && !busy;

  async function submit() {
    if (!ready || amount === null) return;
    setBusy(true);
    let ok = true;
    try {
      if (mode === "add") await addGems(amount, note.trim() || undefined);
      else if (mode === "throw") ok = await throwAway(amount, note.trim() || undefined);
      else if (mode === "loan") await takeLoan(amount, { interestPercent: interest, repayPercent: repayShare });
      else if (loan) ok = await repayLoan(loan.uid, amount);
    } finally {
      setBusy(false);
    }
    if (ok) closeBalanceDialog();
  }

  const owed = amount !== null && amount > 0 ? Math.round(amount * (1 + interest / 100)) : null;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => { if (!next) closeBalanceDialog(); }}
      title="Manage balance"
      description={
        <span className="inline-flex items-center gap-1">
          Balance <Gems amount={balance} className={cn("text-foreground", balance < 0 && "text-destructive")} />
        </span>
      }
      dialogContentClassName="sm:max-w-md"
    >
      <form
        className="flex flex-col gap-4 pt-1"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div role="radiogroup" aria-label="Action" className="grid grid-cols-4 gap-1 rounded-xl bg-muted/60 p-1">
          {ACTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={mode === item.id}
              onClick={() => openBalanceDialog(item.id)}
              className={cn(
                "h-9 rounded-lg px-1 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
                mode === item.id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>

        {mode === "repay" && !loan ? (
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-sm font-medium">No loans to repay</p>
            <p className="mt-1 text-xs text-muted-foreground">You don&apos;t owe any gems. Take a loan when you need gems before you&apos;ve earned them.</p>
          </div>
        ) : (
          <>
            {mode === "repay" && loan && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Loan</span>
                <Menu.Root>
                  <Menu.Trigger className={cn(FIELD, "flex items-center gap-2 text-left")} disabled={outstanding.length < 2}>
                    <span className="min-w-0 flex-1 truncate">{loanLabel(loan)}</span>
                    <Gems amount={loan.outstanding} className="text-xs text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">left</span>
                    {outstanding.length > 1 && <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Content align="start" sideOffset={4} collisionPadding={12} className={cn(MENU_SURFACE, "w-[var(--radix-dropdown-menu-trigger-width)]")}>
                      {outstanding.map((item) => (
                        <Menu.Item key={item.uid} className={MENU_ITEM} onSelect={() => setLoanUid(item.uid)}>
                          <span className="flex size-4 shrink-0 items-center">{item.uid === loan.uid && <Check className="size-4" />}</span>
                          <span className="min-w-0 flex-1 truncate">{loanLabel(item)}</span>
                          <Gems amount={item.outstanding} className="text-xs text-muted-foreground" />
                        </Menu.Item>
                      ))}
                    </Menu.Content>
                  </Menu.Portal>
                </Menu.Root>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="balance-amount" className="text-xs text-muted-foreground">
                Amount in gems
              </label>
              <input
                id="balance-amount"
                autoFocus
                className={cn(FIELD, "font-mono tabular-nums")}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value.replace(/[^\d.,]/g, ""))}
                aria-invalid={!!error}
                aria-describedby={error ? "balance-amount-error" : undefined}
              />
              <div className="flex flex-wrap items-center gap-1">
                {CHIPS.map((chip) => (
                  <button key={chip} type="button" className={CHIP} onClick={() => setAmountText(String(chip / GEM))}>
                    {formatGems(chip)}
                  </button>
                ))}
                {mode === "repay" && loan && repayMax > 0 && (
                  <button type="button" className={cn(CHIP, "font-sans")} onClick={() => setAmountText(String(repayMax / GEM))}>
                    Repay all
                  </button>
                )}
                {mode === "throw" && (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                    of <Gems amount={balance} />
                  </span>
                )}
              </div>
              {error && (
                <p id="balance-amount-error" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>

            {(mode === "add" || mode === "throw") && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="balance-note" className="text-xs text-muted-foreground">
                  Note <span className="text-muted-foreground/70">(optional)</span>
                </label>
                <input
                  id="balance-note"
                  className={FIELD}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={mode === "add" ? "Bonus for finishing the essay" : "Skipped the gym"}
                />
              </div>
            )}

            {mode === "loan" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">Interest</span>
                    <span className="relative">
                      <input
                        className={cn(FIELD, "pr-7 font-mono tabular-nums")}
                        inputMode="numeric"
                        value={interestText}
                        onChange={(event) => setInterestText(percentInput(event.target.value))}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
                    </span>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">Of each earning</span>
                    <span className="relative">
                      <input
                        className={cn(FIELD, "pr-7 font-mono tabular-nums")}
                        inputMode="numeric"
                        value={repayText}
                        onChange={(event) => setRepayText(percentInput(event.target.value))}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
                    </span>
                  </label>
                </div>
                <p className="rounded-xl bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  {owed !== null ? (
                    <>
                      You&apos;ll owe <Gems amount={owed} className="text-foreground" />.{" "}
                    </>
                  ) : (
                    "Enter an amount to see what you'll owe. "
                  )}
                  {repayShare > 0
                    ? `${repayShare}% of each earning goes to repaying it until it's paid.`
                    : "Nothing is taken from earnings; repay it from here."}
                </p>
              </>
            )}
          </>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={QUIET} onClick={closeBalanceDialog}>
            Cancel
          </button>
          <button type="submit" className={PRIMARY} disabled={!ready}>
            {SUBMIT[mode]}
          </button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
