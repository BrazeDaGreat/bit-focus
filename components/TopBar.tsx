"use client";

import { SidebarTrigger } from "./ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MobileDrawer } from "@/components/ui/mobile-drawer";
import { useRewards } from "@/hooks/useRewards";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useState, useEffect, type JSX } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import BITFdata from "./BITFdata";
import FloatingNotepad from "./FloatingNotepad";
import QuickMessageDialog from "./QuickMessageDialog";
import MiniTimer from "./MiniTimer";
import SyncChip from "./auth/SyncChip";
import { usePathname } from "next/navigation";
import { FaArrowLeft, FaTrash, FaHandHoldingDollar, FaCoins } from "react-icons/fa6";

type PointsDrawerView = "menu" | "throw-away" | "loan";

/** Map of pathname patterns to display names */
const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/focus": "Focus",
  "/ai": "AI Chat (BETA)",
  "/calendar": "Calendar",
  "/projects": "Projects",
  "/rewards": "Rewards",
  "/excalidraw": "Excalidraw",
  "/changelog": "Changelog",
  "/focus-table": "Focus Table",
  "/account": "Account",
};

function usePageTitle(): string {
  const pathname = usePathname();

  if (pathname.startsWith("/projects/")) {
    return "Projects";
  }

  return PAGE_TITLES[pathname] ?? "BIT Focus";
}

export default function TopBar(): JSX.Element {
  const { rewardPoints, throwAwayPoints, takeLoan, loadRewards } = useRewards();
  const [throwAwayDialogOpen, setThrowAwayDialogOpen] = useState(false);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [throwAwayAmount, setThrowAwayAmount] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [pointsDrawerOpen, setPointsDrawerOpen] = useState(false);
  const [pointsDrawerView, setPointsDrawerView] = useState<PointsDrawerView>("menu");
  const isMobile = useIsMobile();
  const pageTitle = usePageTitle();

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  const handleThrowAway = () => {
    const amount = parseInt(throwAwayAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (amount > rewardPoints) {
      toast.error("You don't have enough points to throw away");
      return;
    }
    throwAwayPoints(amount);
    if (isMobile) setPointsDrawerOpen(false);
    else setThrowAwayDialogOpen(false);
    setThrowAwayAmount("");
  };

  const handleLoan = () => {
    const amount = parseInt(loanAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid loan amount");
      return;
    }
    takeLoan(amount);
    if (isMobile) setPointsDrawerOpen(false);
    else setLoanDialogOpen(false);
    setLoanAmount("");
  };

  const pointsTrigger = (
    <Button
      size="sm"
      variant="ghost"
      title="Reward points"
      aria-label={`Reward points: ${(rewardPoints / 100).toFixed(2)}`}
      className={cn(
        "h-11 touch-manipulation rounded-full bg-muted/70 px-3 font-mono text-sm tabular-nums transition-[background-color,color,transform] hover:bg-muted active:scale-95 motion-reduce:transition-none lg:h-10",
        rewardPoints < 0 && "bg-red-500/10 text-red-500 hover:bg-red-500/15"
      )}
    >
      <FaCoins
        className={cn(
          "size-3.5",
          rewardPoints < 0 ? "text-red-500" : "text-primary"
        )}
      />
      {(rewardPoints / 100).toFixed(2)}
    </Button>
  );

  return (
    <>
      <header className="sticky top-0 z-20 shrink-0 border-b border-border/60 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/85">
        {/* Keep content clear of the Android status bar when installed as a PWA. */}
        <div className="h-[env(safe-area-inset-top)] lg:hidden" aria-hidden="true" />

        <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-2 py-2 sm:px-4 lg:h-16 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-x-3 lg:py-2">
          {/* Primary Android-style app bar: navigation, destination, balance. */}
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-1 sm:gap-2">
            <SidebarTrigger className="size-11 touch-manipulation rounded-full text-muted-foreground transition-[background-color,color,transform] hover:bg-muted hover:text-foreground active:scale-95 motion-reduce:transition-none lg:size-10" />
            <h1 className="truncate text-lg font-semibold leading-none tracking-tight sm:text-xl lg:text-lg">
              {pageTitle}
            </h1>
          </div>

          {/* A dedicated command shelf prevents tools competing with the title. */}
          <div className="col-span-2 row-start-2 flex h-12 min-w-0 items-center gap-1.5 rounded-2xl bg-muted/70 p-1 ring-1 ring-border/40 sm:gap-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:h-10 lg:bg-transparent lg:p-0 lg:ring-0">
            <MiniTimer className="h-10 w-fit max-w-40 flex-none border-0 bg-background shadow-sm ring-1 ring-border/70 [&_button]:size-9 [&_button]:touch-manipulation [&_button]:transition-transform [&_button:active]:scale-95 motion-reduce:[&_button]:transition-none lg:h-9 lg:max-w-none lg:border lg:shadow-none lg:ring-0 lg:[&_button]:size-7" />

            <div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-xl bg-background p-0.5 shadow-sm ring-1 ring-border/70 lg:bg-muted/60 lg:shadow-none lg:ring-0 [&_button]:size-9 [&_button]:touch-manipulation [&_button]:rounded-[0.625rem] [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-0 [&_button]:shadow-none [&_button]:transition-[background-color,color,transform] [&_button:active]:scale-95 [&_button:hover]:bg-muted sm:[&_button]:size-10 lg:[&_button]:size-8 motion-reduce:[&_button]:transition-none">
              <SyncChip />
              <QuickMessageDialog />
              <FloatingNotepad />
              <BITFdata />
            </div>
          </div>

          {/* The balance is a compact tonal action, like an Android status chip. */}
          <div className="col-start-2 row-start-1 lg:col-start-3">
            {isMobile ? (
              <MobileDrawer
                open={pointsDrawerOpen}
                onOpenChange={(nextOpen) => {
                  setPointsDrawerOpen(nextOpen);
                  if (nextOpen) setPointsDrawerView("menu");
                }}
                trigger={pointsTrigger}
                title={
                  pointsDrawerView === "menu"
                    ? "Manage points"
                    : pointsDrawerView === "throw-away"
                    ? "Throw away points"
                    : "Take a loan"
                }
                description={
                  pointsDrawerView === "menu"
                    ? `Current balance: ${(rewardPoints / 100).toFixed(2)} pts`
                    : pointsDrawerView === "throw-away"
                    ? "Remove points from your balance. This cannot be undone."
                    : "Borrow reward points now and return them later."
                }
              >
                {pointsDrawerView === "menu" && (
                  <div className="grid gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPointsDrawerView("throw-away")}
                      className="h-14 touch-manipulation justify-start rounded-xl px-4"
                    >
                      <FaTrash className="size-4 text-muted-foreground" />
                      Throw away
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPointsDrawerView("loan")}
                      className="h-14 touch-manipulation justify-start rounded-xl px-4"
                    >
                      <FaHandHoldingDollar className="size-4 text-muted-foreground" />
                      Loan
                    </Button>
                  </div>
                )}

                {pointsDrawerView === "throw-away" && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleThrowAway();
                    }}
                    className="grid gap-5 pt-2"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPointsDrawerView("menu")}
                      className="w-fit rounded-full"
                    >
                      <FaArrowLeft /> Back
                    </Button>
                    <div className="grid gap-2">
                      <Label htmlFor="mobile-throwaway">Amount</Label>
                      <Input
                        id="mobile-throwaway"
                        type="number"
                        inputMode="numeric"
                        autoFocus
                        value={throwAwayAmount}
                        onChange={(event) => setThrowAwayAmount(event.target.value)}
                        placeholder="0"
                        className="h-12 rounded-xl text-base"
                        min="1"
                        max={rewardPoints.toString()}
                      />
                    </div>
                    <Button type="submit" variant="destructive" className="h-12 rounded-full">
                      Throw away
                    </Button>
                  </form>
                )}

                {pointsDrawerView === "loan" && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleLoan();
                    }}
                    className="grid gap-5 pt-2"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPointsDrawerView("menu")}
                      className="w-fit rounded-full"
                    >
                      <FaArrowLeft /> Back
                    </Button>
                    <div className="grid gap-2">
                      <Label htmlFor="mobile-loan">Amount</Label>
                      <Input
                        id="mobile-loan"
                        type="number"
                        inputMode="numeric"
                        autoFocus
                        value={loanAmount}
                        onChange={(event) => setLoanAmount(event.target.value)}
                        placeholder="0"
                        className="h-12 rounded-xl text-base"
                        min="1"
                      />
                      <p className="text-sm text-muted-foreground">
                        Balance after loan:{" "}
                        {((rewardPoints + parseInt(loanAmount || "0")) / 100).toFixed(2)} pts
                      </p>
                    </div>
                    <Button type="submit" className="h-12 rounded-full">
                      Take loan
                    </Button>
                  </form>
                )}
              </MobileDrawer>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>{pointsTrigger}</DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
                  <DropdownMenuLabel>Manage points</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setThrowAwayDialogOpen(true)}
                    className="min-h-11 gap-3 rounded-xl px-3"
                  >
                    <FaTrash className="size-3.5" />
                    Throw away points
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLoanDialogOpen(true)}
                    className="min-h-11 gap-3 rounded-xl px-3"
                  >
                    <FaHandHoldingDollar className="size-3.5" />
                    Take a loan
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Desktop point actions remain conventional dialogs. */}
      {!isMobile && <Dialog open={throwAwayDialogOpen} onOpenChange={setThrowAwayDialogOpen}>
        <DialogContent className="top-auto bottom-0 max-w-none translate-y-0 rounded-b-none rounded-t-[1.75rem] border-x-0 border-b-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom-6 data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-bottom-6 data-[state=open]:zoom-in-100 sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:p-6">
          <form onSubmit={(event) => { event.preventDefault(); handleThrowAway(); }} className="grid gap-5">
            <DialogHeader className="pr-8 text-left">
              <DialogTitle>Throw away reward points?</DialogTitle>
              <DialogDescription>
                Choose how many points to remove. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="throwaway">Amount</Label>
              <Input
                id="throwaway"
                type="number"
                inputMode="numeric"
                autoFocus
                value={throwAwayAmount}
                onChange={(e) => setThrowAwayAmount(e.target.value)}
                placeholder="0"
                className="h-12 rounded-xl text-base"
                min="1"
                max={rewardPoints.toString()}
              />
              <p className="text-sm text-muted-foreground">
                Current balance: {(rewardPoints / 100).toFixed(2)} pts
              </p>
            </div>
            <DialogFooter className="grid grid-cols-2 gap-3 sm:flex">
              <Button
                type="button"
                variant="outline"
                onClick={() => setThrowAwayDialogOpen(false)}
                className="h-12 rounded-full px-5"
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" className="h-12 rounded-full px-5">
                Throw away
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>}

      {/* Take Loan Dialog */}
      {!isMobile && <Dialog open={loanDialogOpen} onOpenChange={setLoanDialogOpen}>
        <DialogContent className="top-auto bottom-0 max-w-none translate-y-0 rounded-b-none rounded-t-[1.75rem] border-x-0 border-b-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom-6 data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-bottom-6 data-[state=open]:zoom-in-100 sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:p-6">
          <form onSubmit={(event) => { event.preventDefault(); handleLoan(); }} className="grid gap-5">
            <DialogHeader className="pr-8 text-left">
              <DialogTitle>Take a loan</DialogTitle>
              <DialogDescription>
                Choose how many reward points to borrow. You can return them later.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="loan">Amount</Label>
              <Input
                id="loan"
                type="number"
                inputMode="numeric"
                autoFocus
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="0"
                className="h-12 rounded-xl text-base"
                min="1"
              />
              <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                <span>Current: {(rewardPoints / 100).toFixed(2)} pts</span>
                <span>
                  After: {((rewardPoints + parseInt(loanAmount || "0")) / 100).toFixed(2)} pts
                </span>
              </div>
            </div>
            <DialogFooter className="grid grid-cols-2 gap-3 sm:flex">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLoanDialogOpen(false)}
                className="h-12 rounded-full px-5"
              >
                Cancel
              </Button>
              <Button type="submit" className="h-12 rounded-full px-5">
                Take loan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>}
    </>
  );
}
