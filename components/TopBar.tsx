/**
 * Top Navigation Bar Component - Enhanced with Rewards System
 * 
 * This component provides the secondary navigation bar that appears at the top
 * of the application interface, now including a reward points display and
 * management dropdown.
 * 
 * Features:
 * - Sidebar toggle for responsive navigation
 * - Quick access to external resources (Discord, GitHub)
 * - Reward points display with dropdown actions
 * - Responsive button layout and sizing
 * - Consistent styling with application theme
 * 
 * Layout Structure:
 * - Left side: Sidebar trigger and external links
 * - Right side: Reward points with management dropdown
 * - Responsive design for mobile and desktop
 * 
 * Dependencies:
 * - UI components for consistent styling
 * - React Icons for visual elements
 * - Rewards hook for points management
 * 
 * @fileoverview Top navigation bar with rewards system integration
 * @author BIT Focus Development Team
 * @since v0.1.0-alpha
 * @updated v0.11.0-beta
 */

"use client";

import { FaDiscord, FaGithub, FaTrash, FaHandHoldingDollar } from "react-icons/fa6";
import { FaCoffee } from "react-icons/fa"
import { Button } from "./ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRewards } from "@/hooks/useRewards";
import { useState, useEffect, type JSX } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * TopBar Button Props Interface
 * 
 * Defines the properties for individual action buttons in the top bar
 * including click handlers and icon display.
 */
interface TopBarButtonProps {
  /** Click event handler for the button */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Icon element to display in the button */
  icon?: React.ReactNode;
}

/**
 * TopBar Button Component
 * 
 * Renders individual action buttons with consistent styling and behavior.
 * Handles click events with proper propagation control for overlay scenarios.
 * 
 * @component
 * @param {TopBarButtonProps} props - Button configuration
 * @returns {JSX.Element} Styled action button
 */
function TopBarButton(props: TopBarButtonProps): JSX.Element {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (props.onClick) {
          props.onClick(event);
        }
      }}
    >
      {props.icon}
    </Button>
  );
}

/**
 * Main TopBar Component
 * 
 * Renders the complete top navigation bar with sidebar controls, external
 * links, and the rewards system display with management dropdown.
 * 
 * @component
 * @returns {JSX.Element} Complete top navigation bar
 */
export default function TopBar(): JSX.Element {
  const { rewardPoints, throwAwayPoints, takeLoan, loadRewards } = useRewards();
  const [throwAwayDialogOpen, setThrowAwayDialogOpen] = useState(false);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [throwAwayAmount, setThrowAwayAmount] = useState("");
  const [loanAmount, setLoanAmount] = useState("");

  // Load rewards data on mount
  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  /**
   * Handle throwing away points
   */
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

  /**
   * Handle taking a loan
   */
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
      <div className="px-2 py-2.5 border-b border-secondary flex items-center justify-between gap-2">
        {/* Left Side: Navigation and External Links */}
        <div className="flex items-center justify-start gap-2">
          {/* Sidebar Toggle */}
          <SidebarTrigger />
          
          {/* Discord Link */}
          <TopBarButton
            icon={<FaDiscord />}
            onClick={() => {
              window.open("https://discord.gg/XXkSFkdx8H", "_blank");
            }}
          />
          
          {/* GitHub Repository Link */}
          <TopBarButton
            icon={<FaGithub />}
            onClick={() =>
              window.open("https://github.com/BrazeDaGreat/bit-focus", "_blank")
            }
          />
        </div>
        
        {/* Right Side: Reward Points Display */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-2 font-medium",
                  rewardPoints < 0 && "text-red-500"
                )}
              >
                <FaCoffee />
                <span>{rewardPoints.toFixed(0)}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Manage Points</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setThrowAwayDialogOpen(true)}
                className="gap-2"
              >
                <FaTrash className="size-4" />
                Throw Away Points
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLoanDialogOpen(true)}
                className="gap-2"
              >
                <FaHandHoldingDollar className="size-4" />
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
              How many reward points would you like to throw away? This action cannot be undone.
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
              Current balance: {rewardPoints.toFixed(0)} RP
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThrowAwayDialogOpen(false)}>
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
              How many reward points would you like to borrow? Make sure to return them afterwards.
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
              Current balance: {rewardPoints.toFixed(0)} RP
            </p>
            <p className="text-sm text-muted-foreground">
              After loan: {(rewardPoints + parseInt(loanAmount || "0")).toFixed(0)} RP
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLoan}>
              Take Loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}