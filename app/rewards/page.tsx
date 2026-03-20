"use client";

import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  FaHourglassEnd,
  FaGamepad,
} from "react-icons/fa6";
import { toast } from "sonner";
import type { RewardItem } from "@/lib/db";
import { IoFastFood, IoFootball } from "react-icons/io5";
import { IoIosPhonePortrait } from "react-icons/io";

const EMOJI_OPTIONS = [
  <FaHourglassEnd key={1} />,
  <FaGamepad key={2} />,
  <IoFastFood key={3} />,
  <IoIosPhonePortrait key={4} />,
  <IoFootball key={5} />,
];

const DEFAULT_CATEGORIES = ["Breaks", "Gaming", "Treats", "Others"];

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
    addPoints,
    takeLoan,
  } = useRewards();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [discountsSheetOpen, setDiscountsSheetOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [addPointsDialogOpen, setAddPointsDialogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    cost: "",
    category: DEFAULT_CATEGORIES[0],
    emoji: "0",
  });
  const [editingItem, setEditingItem] = useState<RewardItem | null>(null);
  const [purchasingItem, setPurchasingItem] = useState<RewardItem | null>(null);
  const [newDiscount, setNewDiscount] = useState({ title: "", percentage: "" });
  const [addPointsAmount, setAddPointsAmount] = useState("");
  const [addPointsMode, setAddPointsMode] = useState<"add" | "loan">("add");

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

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
    setNewItem({ title: "", description: "", cost: "", category: DEFAULT_CATEGORIES[0], emoji: "0" });
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !editingItem.id) return;
    await updateRewardItem(editingItem.id, editingItem);
    setEditDialogOpen(false);
    setEditingItem(null);
  };

  const handlePurchase = () => {
    if (!purchasingItem) return;
    const discount = getTotalDiscount();
    const finalCost = Math.floor(purchasingItem.cost * (1 - discount / 100));
    if (rewardPoints < finalCost && rewardPoints >= 0) {
      toast.error(`Not enough points! You need ${finalCost - rewardPoints} more.`);
      setPurchaseDialogOpen(false);
      return;
    }
    purchaseItem(purchasingItem);
    setPurchaseDialogOpen(false);
    setPurchasingItem(null);
  };

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
    setNewDiscount({ title: "", percentage: "" });
  };

  const handleAddPoints = () => {
    const amount = parseInt(addPointsAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (addPointsMode === "add") {
      addPoints(amount);
    } else {
      takeLoan(amount);
    }
    setAddPointsDialogOpen(false);
    setAddPointsAmount("");
  };

  const totalDiscount = getTotalDiscount();
  const activeDiscounts = discounts.filter((d) => d.active);
  const filteredItems =
    activeCategory === "All"
      ? rewardItems
      : rewardItems.filter((item) => item.category === activeCategory);

  const finalCostFor = (cost: number) =>
    Math.floor(cost * (1 - totalDiscount / 100));

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-8">
      {/* Balance Header */}
      <div className="pb-8 border-b mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Your Balance
            </p>
            <p
              className={cn(
                "text-5xl font-mono font-semibold tracking-tight",
                rewardPoints < 0 && "text-destructive"
              )}
            >
              ⬡ {rewardPoints.toFixed(0)}
              <span className="text-2xl text-muted-foreground ml-2 font-normal">
                pts
              </span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 mt-1 shrink-0"
            onClick={() => setAddPointsDialogOpen(true)}
          >
            <FaPlus className="size-3" />
            Add Points
          </Button>
        </div>

        {activeDiscounts.length > 0 ? (
          <button
            onClick={() => setDiscountsSheetOpen(true)}
            className="mt-4 w-full text-left bg-accent text-accent-foreground rounded-lg px-4 py-2.5 text-sm flex items-center gap-2.5 hover:bg-accent/80 transition-colors"
          >
            <FaTags className="size-3 shrink-0" />
            <span className="font-medium">
              {activeDiscounts.length === 1
                ? `ACTIVE DISCOUNT: −${activeDiscounts[0].percentage}% ${activeDiscounts[0].title}`
                : `${activeDiscounts.length} ACTIVE DISCOUNTS: ${activeDiscounts.map((d) => `−${d.percentage}%`).join(", ")}`}
            </span>
            <span className="ml-auto text-xs text-muted-foreground shrink-0">
              Manage →
            </span>
          </button>
        ) : (
          <button
            onClick={() => setDiscountsSheetOpen(true)}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <FaPercent className="size-2.5" />
            Manage Discounts
          </button>
        )}
      </div>

      {/* Category Tabs + Add Item */}
      <div className="flex items-center gap-2 py-3 border-b mb-6 flex-wrap">
        {["All", ...DEFAULT_CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              activeCategory === cat
                ? "bg-primary text-primary-foreground"
                : "border text-muted-foreground hover:text-foreground hover:border-foreground/40"
            )}
          >
            {cat}
          </button>
        ))}
        <div className="ml-auto">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <FaPlus className="size-3" />
                Add Item
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
                    Cost (pts)*
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
                    className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Icon</Label>
                  <div className="col-span-3 flex flex-wrap gap-2">
                    {EMOJI_OPTIONS.map((emoji, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          setNewItem({ ...newItem, emoji: `${i}` })
                        }
                        className={cn(
                          "text-2xl p-2 rounded-lg hover:bg-accent transition-colors",
                          newItem.emoji === `${i}` &&
                            "bg-accent ring-1 ring-primary"
                        )}
                      >
                        {emoji}
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
        </div>
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="border rounded-xl p-5 h-48 animate-pulse bg-muted/30"
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-4 text-center">
          <FaCartShopping className="size-10 opacity-20" />
          <p className="text-sm text-muted-foreground">
            {activeCategory === "All"
              ? "No rewards yet. Add your first item to the shop."
              : `No items in ${activeCategory}. Add one to get started.`}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateDialogOpen(true)}
          >
            <FaPlus className="size-3 mr-1.5" />
            Add Item
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredItems.map((item) => {
            const finalCost = finalCostFor(item.cost);
            const isAffordable = rewardPoints >= finalCost || rewardPoints < 0;
            const hasDiscount = totalDiscount > 0;

            return (
              <div
                key={item.id}
                className={cn(
                  "group relative border rounded-xl p-5 flex flex-col hover:shadow-md transition-shadow",
                  !isAffordable && rewardPoints >= 0 && "opacity-60"
                )}
              >
                {/* Actions menu — visible on hover */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7">
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
                        onClick={() => item.id && deleteRewardItem(item.id)}
                      >
                        <FaTrash className="size-3 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Icon */}
                {item.emoji !== undefined && (
                  <span className="text-4xl mb-3 block">
                    {EMOJI_OPTIONS[parseInt(item.emoji)]}
                  </span>
                )}

                {/* Title */}
                <p className="text-base font-semibold leading-snug pr-6">
                  {item.title}
                </p>

                {/* Description */}
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}

                <div className="flex-grow" />

                {/* Footer */}
                <div className="flex items-center justify-between border-t mt-4 pt-4">
                  <div className="flex flex-col gap-0.5">
                    {hasDiscount ? (
                      <>
                        <span className="text-xs line-through text-muted-foreground font-mono">
                          ⬡ {item.cost}
                        </span>
                        <span className="text-sm font-mono font-semibold text-primary">
                          ⬡ {finalCost} pts
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-mono font-semibold">
                        ⬡ {item.cost} pts
                      </span>
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
                    Redeem
                  </Button>
                </div>
              </div>
            );
          })}
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
                  Cost (pts)
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
            <DialogTitle>Confirm Redemption</DialogTitle>
            <DialogDescription>
              Review the cost before redeeming this reward.
            </DialogDescription>
          </DialogHeader>
          {purchasingItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl border">
                {purchasingItem.emoji !== undefined && (
                  <span className="text-3xl">
                    {EMOJI_OPTIONS[parseInt(purchasingItem.emoji)]}
                  </span>
                )}
                <div>
                  <p className="font-semibold">{purchasingItem.title}</p>
                  {purchasingItem.description && (
                    <p className="text-sm text-muted-foreground">
                      {purchasingItem.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original cost</span>
                  <span className="font-mono">⬡ {purchasingItem.cost}</span>
                </div>
                {totalDiscount > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Active discount
                      </span>
                      <span className="text-primary font-mono">
                        −{totalDiscount}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">You save</span>
                      <span className="text-primary font-mono">
                        −⬡{" "}
                        {Math.floor(
                          (purchasingItem.cost * totalDiscount) / 100
                        )}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Final cost</span>
                  <span className="font-mono text-primary">
                    ⬡ {finalCostFor(purchasingItem.cost)}
                  </span>
                </div>
                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Your balance</span>
                    <span
                      className={cn(
                        "font-mono",
                        rewardPoints < 0 && "text-destructive"
                      )}
                    >
                      ⬡ {rewardPoints.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>After redemption</span>
                    <span
                      className={cn(
                        "font-mono",
                        rewardPoints - finalCostFor(purchasingItem.cost) < 0 &&
                          "text-destructive"
                      )}
                    >
                      ⬡{" "}
                      {(
                        rewardPoints - finalCostFor(purchasingItem.cost)
                      ).toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={() => setPurchaseDialogOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <Button onClick={handlePurchase}>Confirm Redemption</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Points Dialog */}
      <Dialog open={addPointsDialogOpen} onOpenChange={setAddPointsDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Add Points</DialogTitle>
            <DialogDescription>
              Add points to your balance or take a loan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setAddPointsMode("add")}
                className={cn(
                  "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                  addPointsMode === "add"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Add Points
              </button>
              <button
                onClick={() => setAddPointsMode("loan")}
                className={cn(
                  "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                  addPointsMode === "loan"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Take Loan
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="points-amount">Amount</Label>
              <Input
                id="points-amount"
                type="number"
                value={addPointsAmount}
                onChange={(e) => setAddPointsAmount(e.target.value)}
                placeholder="100"
                min="1"
              />
              {addPointsMode === "loan" && (
                <p className="text-xs text-muted-foreground">
                  A loan adds points now that you&apos;ll earn back through
                  focus sessions.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddPoints}>
              {addPointsMode === "add" ? "Add Points" : "Take Loan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discounts Sheet */}
      <Sheet open={discountsSheetOpen} onOpenChange={setDiscountsSheetOpen}>
        <SheetContent className="w-96">
          <SheetHeader>
            <SheetTitle>Discounts</SheetTitle>
            <SheetDescription>
              Active discounts are applied to all purchases.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* Add Discount Form */}
            <div className="space-y-3 pb-6 border-b">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                New Discount
              </p>
              <div className="space-y-2">
                <Input
                  value={newDiscount.title}
                  onChange={(e) =>
                    setNewDiscount({ ...newDiscount, title: e.target.value })
                  }
                  placeholder="Discount name"
                />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={newDiscount.percentage}
                    onChange={(e) =>
                      setNewDiscount({
                        ...newDiscount,
                        percentage: e.target.value,
                      })
                    }
                    placeholder="% off"
                    min="1"
                    max="100"
                    className="w-24"
                  />
                  <Button onClick={handleCreateDiscount} className="flex-1">
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Existing Discounts */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Existing
              </p>
              {discounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No discounts yet.
                </p>
              ) : (
                discounts.map((discount) => (
                  <div
                    key={discount.id}
                    className="flex items-center justify-between py-2.5 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={discount.active}
                        onCheckedChange={() =>
                          discount.id && toggleDiscount(discount.id)
                        }
                      />
                      <div>
                        <p className="text-sm font-medium">{discount.title}</p>
                        <p
                          className={cn(
                            "text-xs font-mono",
                            discount.active
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        >
                          −{discount.percentage}%
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
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
        </SheetContent>
      </Sheet>
    </div>
  );
}
