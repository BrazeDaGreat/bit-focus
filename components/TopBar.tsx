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
import { useRewards } from "@/hooks/useRewards";
import { useState, useEffect, type JSX } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import BITFdata from "./BITFdata";
import FloatingNotepad from "./FloatingNotepad";
import QuickMessageDialog from "./QuickMessageDialog";
import MiniTimer from "./MiniTimer";
import SyncChip from "./auth/SyncChip";
import { usePathname } from "next/navigation";
import { FaTrash, FaHandHoldingDollar, FaCoins } from "react-icons/fa6";

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
    setThrowAwayDialogOpen(false);
    setThrowAwayAmount("");
  };

  const handleLoan = () => {
    const amount = parseInt(loanAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid loan amount");
      return;
    }
    takeLoan(amount);
    setLoanDialogOpen(false);
    setLoanAmount("");
  };

  return (
    <>
      <header className="grid min-h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 border-b px-3 py-2 sm:px-4 lg:h-14 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-x-3 lg:py-0">
        {/* Left: sidebar trigger + page title */}
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 sm:gap-3">
          <SidebarTrigger className="size-8" />
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
            {pageTitle}
          </h1>
        </div>

        {/* Mobile gets a dedicated command row; desktop folds it back inline. */}
        <div className="col-span-2 row-start-2 flex min-w-0 items-center gap-1 lg:col-span-1 lg:col-start-2 lg:row-start-1">
          {/* Mini timer — start/pause a session from anywhere */}
          <MiniTimer className="min-w-0 flex-1 lg:flex-none" />
          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

          <SyncChip />
          <QuickMessageDialog />
          <FloatingNotepad />
          <BITFdata />
        </div>

        {/* Points stay glanceable beside the title on mobile. */}
        <div className="col-start-2 row-start-1 lg:col-start-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  rewardPoints < 0 && "text-red-500 border-red-500/40"
                )}
              >
                <FaCoins className="mr-2" />
                {(rewardPoints / 100).toFixed(2)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Manage Points</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setThrowAwayDialogOpen(true)}
                className="gap-2"
              >
                <FaTrash className="size-3.5" />
                Throw Away Points
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLoanDialogOpen(true)}
                className="gap-2"
              >
                <FaHandHoldingDollar className="size-3.5" />
                Take a Loan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Throw Away Points Dialog */}
      <Dialog open={throwAwayDialogOpen} onOpenChange={setThrowAwayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Throw Away Reward Points</DialogTitle>
            <DialogDescription>
              How many reward points would you like to throw away? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="throwaway" className="text-right">
                Amount
              </Label>
              <Input
                id="throwaway"
                type="number"
                value={throwAwayAmount}
                onChange={(e) => setThrowAwayAmount(e.target.value)}
                placeholder="0"
                className="col-span-3"
                min="0"
                max={rewardPoints.toString()}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Current balance: {(rewardPoints / 100).toFixed(2)} pts
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setThrowAwayDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleThrowAway}>
              Throw Away
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Take Loan Dialog */}
      <Dialog open={loanDialogOpen} onOpenChange={setLoanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Take a Loan</DialogTitle>
            <DialogDescription>
              How many reward points would you like to borrow? Make sure to
              return them afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="loan" className="text-right">
                Amount
              </Label>
              <Input
                id="loan"
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="0"
                className="col-span-3"
                min="1"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Current balance: {(rewardPoints / 100).toFixed(2)} pts
            </p>
            <p className="text-sm text-muted-foreground">
              After loan:{" "}
              {((rewardPoints + parseInt(loanAmount || "0")) / 100).toFixed(2)} pts
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLoan}>Take Loan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
