/**
 * Rewards Shop Page - Gamified Reward System Interface
 *
 * This page provides a comprehensive interface for the rewards system where users
 * can spend their earned reward points on custom items. It includes a shop interface,
 * item management, special discounts, and a points overview. The component serves
 * as a gamification layer to motivate users during focus sessions.
 *
 * Features:
 * - Custom reward items creation and management
 * - Special discount system with percentage-based reductions
 * - Visual shop interface with emoji support
 * - Real-time points balance tracking
 * - Purchase confirmation dialogs
 * - Responsive grid layout for items
 * - Category-based organization
 * - Edit and delete functionality for items
 * - Active discount applier with visual price updates
 *
 * @fileoverview Main rewards shop page with gamified item management
 * @author BIT Focus Development Team
 * @since v0.11.0-beta
 */

"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useRewards } from "@/hooks/useRewards";
import { cn } from "@/lib/utils";
import { useEffect, useState, type JSX } from "react";
import {
  FaPlus,
  FaTrash,
  FaPencil,
  FaEllipsisVertical,
  FaTags,
  FaPercent,
  FaCartShopping,
  FaCheck,
  FaHourglassEnd,
  FaGamepad,
} from "react-icons/fa6";
import { FaTimes, FaCoffee } from "react-icons/fa";
import { toast } from "sonner";
import type { RewardItem, SpecialDiscount } from "@/lib/db";
import { IoFastFood, IoFootball } from "react-icons/io5";
import { IoIosPhonePortrait } from "react-icons/io";

/**
 * Common emoji options for reward items
 */
const EMOJI_OPTIONS = [
  <FaHourglassEnd key={1} />,
  <FaGamepad key={2} />,
  <IoFastFood key={3} />,
  <IoIosPhonePortrait key={4} />,
  <IoFootball key={5} />
];

/**
 * Default categories for organizing rewards
 */
const DEFAULT_CATEGORIES = [
  "Breaks",
  "Gaming",
  "Treats",
  "Others"
];

/**
 * Active Discounts Display Component
 *
 * Shows currently active discounts as a banner at the top of the page
 * with the ability to toggle them on/off quickly
 *
 * @component
 * @param {Object} props - Component props
 * @param {SpecialDiscount[]} props.discounts - Array of all discounts
 * @param {Function} props.onToggle - Callback to toggle discount state
 * @param {number} props.totalDiscount - Total discount percentage
 * @returns {JSX.Element | null} Discount banner or null if no discounts
 */
function ActiveDiscountsBar({
  discounts,
  onToggle,
}: {
  discounts: SpecialDiscount[];
  onToggle: (id: number) => void;
}): JSX.Element | null {

  if (discounts.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 opacity-60">
            <FaTags className="text-primary" />
            <CardTitle>Discounts</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {discounts.map((discount) => (
            <div
              key={discount.id}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md shadow-sm border transition-all cursor-pointer select-none",
                discount.active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50"
              )}
              onClick={() => discount.id && onToggle(discount.id)}
            >
              <div className="flex items-center gap-1.5">
                {discount.active ? (
                  <FaCheck className="size-3" />
                ) : (
                  <FaTimes className="size-3 opacity-50" />
                )}
                <span className="font-medium">{discount.percentage}%</span>
                <span className="text-sm">{discount.title}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Rewards Page Component
 *
 * Main component that renders the complete rewards shop interface including
 * points display, item grid, discount management, and creation dialogs.
 *
 * @component
 * @returns {JSX.Element} Complete rewards page interface
 */
export default function RewardsPage(): JSX.Element {
  const {
    rewardPoints,
    rewardItems,
    discounts,
    loading,
    loadRewards,
    addRewardItem,
    updateRewardItem,
    deleteRewardItem,
    purchaseItem,
    addDiscount,
    toggleDiscount,
    deleteDiscount,
    getTotalDiscount,
  } = useRewards();

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  // Form states
  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    cost: "",
    category: DEFAULT_CATEGORIES[0],
    emoji: `${0}`,
  });

  const [editingItem, setEditingItem] = useState<RewardItem | null>(null);
  const [purchasingItem, setPurchasingItem] = useState<RewardItem | null>(null);
  const [newDiscount, setNewDiscount] = useState({ title: "", percentage: "" });

  // Load rewards data on mount
  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  /**
   * Handle creating a new reward item
   */
  const handleCreateItem = async () => {
    if (!newItem.title || !newItem.cost) {
      toast.error("Please fill in all required fields");
      return;
    }

    const cost = parseInt(newItem.cost);
    if (isNaN(cost) || cost <= 0) {
      toast.error("Please enter a valid cost");
      return;
    }

    await addRewardItem(
      newItem.title,
      newItem.description || undefined,
      cost,
      newItem.category || undefined,
      newItem.emoji || undefined
    );

    setCreateDialogOpen(false);
    setNewItem({
      title: "",
      description: "",
      cost: "",
      category: DEFAULT_CATEGORIES[0],
      emoji: `0`,
    });
  };

  /**
   * Handle updating an existing reward item
   */
  const handleUpdateItem = async () => {
    if (!editingItem || !editingItem.id) return;

    await updateRewardItem(editingItem.id, editingItem);
    setEditDialogOpen(false);
    setEditingItem(null);
  };

  /**
   * Handle purchasing a reward item
   */
  const handlePurchase = () => {
    if (!purchasingItem) return;

    const discount = getTotalDiscount();
    const finalCost = Math.floor(purchasingItem.cost * (1 - discount / 100));

    if (rewardPoints < finalCost && rewardPoints >= 0) {
      toast.error(
        "Not enough reward points! You need " +
          (finalCost - rewardPoints) +
          " more RP."
      );
      setPurchaseDialogOpen(false);
      return;
    }

    purchaseItem(purchasingItem);
    setPurchaseDialogOpen(false);
    setPurchasingItem(null);
  };

  /**
   * Handle creating a new discount
   */
  const handleCreateDiscount = async () => {
    if (!newDiscount.title || !newDiscount.percentage) {
      toast.error("Please fill in all fields");
      return;
    }

    const percentage = parseInt(newDiscount.percentage);
    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      toast.error("Please enter a valid percentage (1-100)");
      return;
    }

    await addDiscount(newDiscount.title, percentage);
    setDiscountDialogOpen(false);
    setNewDiscount({ title: "", percentage: "" });
  };

  /**
   * Quick toggle for discount
   */
  const handleQuickToggleDiscount = (id: number) => {
    toggleDiscount(id);
  };

  // Group items by category
  const itemsByCategory = rewardItems.reduce((acc, item) => {
    const category = item.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, RewardItem[]>);

  const totalDiscount = getTotalDiscount();

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Rewards Shop</h1>
          <p className="text-muted-foreground">
            Spend your reward points on custom rewards
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <FaPlus />
                Add Reward Item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create Reward Item</DialogTitle>
                <DialogDescription>
                  Add a new item to your rewards shop
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="text-right">
                    Title*
                  </Label>
                  <Input
                    id="title"
                    value={newItem.title}
                    onChange={(e) =>
                      setNewItem({ ...newItem, title: e.target.value })
                    }
                    className="col-span-3"
                    placeholder="e.g., Binge Instagram for 30m"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={newItem.description}
                    onChange={(e) =>
                      setNewItem({ ...newItem, description: e.target.value })
                    }
                    className="col-span-3"
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="cost" className="text-right">
                    Cost (RP)*
                  </Label>
                  <Input
                    id="cost"
                    type="number"
                    value={newItem.cost}
                    onChange={(e) =>
                      setNewItem({ ...newItem, cost: e.target.value })
                    }
                    className="col-span-3"
                    placeholder="0"
                    min="1"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="category" className="text-right">
                    Category
                  </Label>
                  <select
                    id="category"
                    value={newItem.category}
                    onChange={(e) =>
                      setNewItem({ ...newItem, category: e.target.value })
                    }
                    className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Emoji</Label>
                  <div className="col-span-3 flex flex-wrap gap-2">
                    {EMOJI_OPTIONS.map((emoji, i) => (
                      <button
                        key={`${i}`}
                        type="button"
                        onClick={() => setNewItem({ ...newItem, emoji: `${i}` })}
                        className={cn(
                          "text-2xl p-1 rounded hover:bg-accent", 
                          newItem.emoji === `${i}` && "bg-accent"
                        )}
                      >
                        {EMOJI_OPTIONS[i]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleCreateItem}>
                  Create Item
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={discountDialogOpen}
            onOpenChange={setDiscountDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <FaPercent />
                Manage Discounts
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Special Discounts</DialogTitle>
                <DialogDescription>
                  Add and manage special discounts for your rewards. Active
                  discounts will be applied to all purchases.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Add Discount Form */}
                <div className="grid gap-4 border-b pb-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="discount-title" className="text-right">
                      Title
                    </Label>
                    <Input
                      id="discount-title"
                      value={newDiscount.title}
                      onChange={(e) =>
                        setNewDiscount({
                          ...newDiscount,
                          title: e.target.value,
                        })
                      }
                      className="col-span-3"
                      placeholder="e.g., Weekend Special"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="discount-percentage" className="text-right">
                      Discount %
                    </Label>
                    <Input
                      id="discount-percentage"
                      type="number"
                      value={newDiscount.percentage}
                      onChange={(e) =>
                        setNewDiscount({
                          ...newDiscount,
                          percentage: e.target.value,
                        })
                      }
                      className="col-span-3"
                      placeholder="10"
                      min="1"
                      max="100"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleCreateDiscount} size="sm">
                      Add Discount
                    </Button>
                  </div>
                </div>

                {/* Existing Discounts */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Existing Discounts</h4>
                  {discounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No discounts created yet
                    </p>
                  ) : (
                    discounts.map((discount) => (
                      <div
                        key={discount.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={discount.active}
                            onCheckedChange={() =>
                              discount.id && toggleDiscount(discount.id)
                            }
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {discount.title}
                              </span>
                              <Badge
                                variant={
                                  discount.active ? "default" : "secondary"
                                }
                              >
                                {discount.percentage}%
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {discount.active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            discount.id && deleteDiscount(discount.id)
                          }
                        >
                          <FaTrash className="size-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Active Discounts Bar */}
      <ActiveDiscountsBar
        discounts={discounts}
        onToggle={handleQuickToggleDiscount}
      />
      {/* Rewards Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading rewards...</p>
        </div>
      ) : rewardItems.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <FaCartShopping className="size-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">No Rewards Yet</h3>
            <p className="text-muted-foreground">
              Start by adding your first reward item to the shop!
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(itemsByCategory).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h2 className="text-xl font-semibold">{category}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((item) => {
                  const finalCost = Math.floor(
                    item.cost * (1 - totalDiscount / 100)
                  );
                  const isAffordable =
                    rewardPoints >= finalCost || rewardPoints < 0;
                  const hasDiscount = totalDiscount > 0;

                  return (
                    <Card
                      key={item.id}
                      className={cn(
                        "relative transition-all hover:shadow-lg",
                        !isAffordable && rewardPoints >= 0 && "opacity-60"
                      )}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-2">
                            {item.emoji && (
                              <span className="text-2xl">
                                {EMOJI_OPTIONS[parseInt(item.emoji)]}
                              </span>
                            )}
                            <CardTitle className="text-base">
                              {item.title}
                            </CardTitle>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6"
                              >
                                <FaEllipsisVertical className="size-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingItem(item);
                                  setEditDialogOpen(true);
                                }}
                              >
                                <FaPencil className="size-3 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  item.id && deleteRewardItem(item.id)
                                }
                              >
                                <FaTrash className="size-3 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>

                      {item.description && (
                        <CardContent className="pt-0 pb-3">
                          <CardDescription className="text-sm">
                            {item.description}
                          </CardDescription>
                        </CardContent>
                      )}

                      <CardFooter className="pt-0">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col gap-1">
                            {hasDiscount ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm line-through text-muted-foreground">
                                    {item.cost} RP
                                  </span>
                                  <Badge
                                    variant="destructive"
                                    className="text-xs"
                                  >
                                    -{totalDiscount}%
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1">
                                  <FaCoffee className="size-3" />
                                  <span className="font-bold text-primary">
                                    {finalCost}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-1">
                                <FaCoffee className="size-3" />
                                <span className="font-bold">{item.cost}</span>
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            disabled={!isAffordable && rewardPoints >= 0}
                            onClick={() => {
                              setPurchasingItem(item);
                              setPurchaseDialogOpen(true);
                            }}
                          >
                            Buy
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Item Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Reward Item</DialogTitle>
            <DialogDescription>
              Make changes to your reward item
            </DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-title" className="text-right">
                  Title
                </Label>
                <Input
                  id="edit-title"
                  value={editingItem.title}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, title: e.target.value })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">
                  Description
                </Label>
                <Textarea
                  id="edit-description"
                  value={editingItem.description || ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      description: e.target.value,
                    })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-cost" className="text-right">
                  Cost (RP)
                </Label>
                <Input
                  id="edit-cost"
                  type="number"
                  value={editingItem.cost}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      cost: parseInt(e.target.value) || 0,
                    })
                  }
                  className="col-span-3"
                  min="1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" onClick={handleUpdateItem}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              Are you sure you want to purchase this reward?
            </DialogDescription>
          </DialogHeader>
          {purchasingItem && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    {purchasingItem.emoji && (
                      <span className="text-2xl">{EMOJI_OPTIONS[parseInt(purchasingItem.emoji)]}</span>
                    )}
                    <CardTitle className="text-base">
                      {purchasingItem.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                {purchasingItem.description && (
                  <CardContent className="pt-0">
                    <CardDescription>
                      {purchasingItem.description}
                    </CardDescription>
                  </CardContent>
                )}
              </Card>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Original Cost:</span>
                  <span>{purchasingItem.cost} RP</span>
                </div>
                {totalDiscount > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Active Discounts:</span>
                      <span className="text-green-600">{totalDiscount}%</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>You Save:</span>
                      <span>
                        -
                        {Math.floor(
                          (purchasingItem.cost * totalDiscount) / 100
                        )}{" "}
                        RP
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Final Cost:</span>
                  <span className="text-primary">
                    {Math.floor(
                      purchasingItem.cost * (1 - totalDiscount / 100)
                    )}{" "}
                    RP
                  </span>
                </div>
                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Your Balance:</span>
                    <span className={cn(rewardPoints < 0 && "text-red-500")}>
                      {rewardPoints.toFixed(0)} RP
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span>After Purchase:</span>
                    <span
                      className={cn(
                        rewardPoints -
                          Math.floor(
                            purchasingItem.cost * (1 - totalDiscount / 100)
                          ) <
                          0 && "text-red-500"
                      )}
                    >
                      {(
                        rewardPoints -
                        Math.floor(
                          purchasingItem.cost * (1 - totalDiscount / 100)
                        )
                      ).toFixed(0)}{" "}
                      RP
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPurchaseDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handlePurchase}>Confirm Purchase</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
