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
import { usePathname } from "next/navigation";
import { FaTrash, FaHandHoldingDollar } from "react-icons/fa6";
import { FaCoffee } from "react-icons/fa";

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
      <div className="h-14 px-4 border-b flex items-center justify-between gap-2 shrink-0">
        {/* Left: sidebar trigger + page title */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="size-8" />
          <h1 className="text-lg font-semibold tracking-tight">{pageTitle}</h1>
        </div>

        {/* Right: utility actions */}
        <div className="flex items-center gap-1">
          <QuickMessageDialog />
          <FloatingNotepad />
          <BITFdata />

          {/* Points pill */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 gap-1.5 px-3 font-mono text-xs font-semibold rounded-full",
                  rewardPoints < 0 && "text-red-500 border-red-500/40"
                )}
              >
                <FaCoffee className="size-3" />
                {rewardPoints.toFixed(0)} pts
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
      </div>

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
              Current balance: {rewardPoints.toFixed(0)} pts
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
              Current balance: {rewardPoints.toFixed(0)} pts
            </p>
            <p className="text-sm text-muted-foreground">
              After loan:{" "}
              {(rewardPoints + parseInt(loanAmount || "0")).toFixed(0)} pts
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
