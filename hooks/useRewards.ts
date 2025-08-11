/**
 * Rewards Management Hook - Points and Shop System
 * 
 * This hook manages the rewards system including reward points tracking,
 * shop items management, discounts, and point transactions. It provides
 * a centralized store for all rewards-related functionality with
 * persistent storage via IndexedDB and localStorage.
 * 
 * Features:
 * - Reward points tracking and persistence
 * - Shop items CRUD operations
 * - Special discounts management
 * - Point transactions (spend, loan, throw away)
 * - Real-time updates across components
 * - Integration with focus timer for point earning
 * 
 * @since v0.11.0-beta
 */

import { create } from "zustand";
import db from "@/lib/db";
import type { RewardItem, SpecialDiscount } from "@/lib/db";
import { toast } from "sonner";

/**
 * Rewards State Interface
 * 
 * Defines the complete state structure for the rewards system
 */
interface RewardsState {
  /** Current reward points (can be negative) */
  rewardPoints: number;
  /** All reward shop items */
  rewardItems: RewardItem[];
  /** Active special discounts */
  discounts: SpecialDiscount[];
  /** Loading state for database operations */
  loading: boolean;
  
  // Point management
  /** Add reward points (called by timer) */
  addPoints: (points: number) => void;
  /** Spend points on a reward item */
  spendPoints: (amount: number, itemTitle?: string) => void;
  /** Throw away points */
  throwAwayPoints: (amount: number) => void;
  /** Take a loan (negative points) */
  takeLoan: (amount: number) => void;
  /** Set points directly (for initialization) */
  setPoints: (points: number) => void;
  
  // Shop management
  /** Load all rewards data from database */
  loadRewards: () => Promise<void>;
  /** Add a new reward item to the shop */
  addRewardItem: (title: string, description: string | undefined, cost: number, category: string | undefined, emoji: string | undefined) => Promise<void>;
  /** Update an existing reward item */
  updateRewardItem: (id: number, updates: Partial<RewardItem>) => Promise<void>;
  /** Delete a reward item */
  deleteRewardItem: (id: number) => Promise<void>;
  /** Purchase a reward item */
  purchaseItem: (item: RewardItem) => void;
  
  // Discount management
  /** Add a new special discount */
  addDiscount: (title: string, percentage: number) => Promise<void>;
  /** Toggle discount active state */
  toggleDiscount: (id: number) => Promise<void>;
  /** Delete a discount */
  deleteDiscount: (id: number) => Promise<void>;
  /** Get total active discount percentage */
  getTotalDiscount: () => number;
}

/**
 * Rewards Store
 * 
 * Creates a Zustand store for managing the rewards system with
 * persistent storage and reactive updates
 */
export const useRewards = create<RewardsState>((set, get) => ({
  rewardPoints: 0,
  rewardItems: [],
  discounts: [],
  loading: false,

  /**
   * Initialize reward points from localStorage
   */
  initializePoints: () => {
    if (typeof window !== "undefined") {
      const savedPoints = localStorage.getItem("rewardPoints");
      if (savedPoints) {
        set({ rewardPoints: parseFloat(savedPoints) || 0 });
      }
    }
  },

  /**
   * Add reward points
   * @param points - Number of points to add
   */
  addPoints: (points: number) => {
    set((state) => {
      const newPoints = state.rewardPoints + points;
      if (typeof window !== "undefined") {
        localStorage.setItem("rewardPoints", String(newPoints));
      }
      return { rewardPoints: newPoints };
    });
  },

  /**
   * Spend points on rewards
   * @param amount - Amount of points to spend
   * @param itemTitle - Optional title of the item purchased
   */
  spendPoints: (amount: number, itemTitle?: string) => {
    set((state) => {
      const newPoints = state.rewardPoints - amount;
      if (typeof window !== "undefined") {
        localStorage.setItem("rewardPoints", String(newPoints));
      }
      
      if (itemTitle) {
        toast.success(`Purchased "${itemTitle}" for ${amount} RP!`);
      }
      
      return { rewardPoints: newPoints };
    });
  },

  /**
   * Throw away points
   * @param amount - Amount of points to discard
   */
  throwAwayPoints: (amount: number) => {
    set((state) => {
      const newPoints = state.rewardPoints - amount;
      if (typeof window !== "undefined") {
        localStorage.setItem("rewardPoints", String(newPoints));
      }
      
      toast.info(`Threw away ${amount} RP`);
      
      return { rewardPoints: newPoints };
    });
  },

  /**
   * Take a loan
   * @param amount - Amount of loan to take
   */
  takeLoan: (amount: number) => {
    set((state) => {
      const newPoints = state.rewardPoints + amount;
      if (typeof window !== "undefined") {
        localStorage.setItem("rewardPoints", String(newPoints));
      }
      
      toast.warning(`Took a loan of ${amount} RP. Current balance: ${newPoints} RP`);
      
      return { rewardPoints: newPoints };
    });
  },

  /**
   * Set points directly
   * @param points - New point value
   */
  setPoints: (points: number) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rewardPoints", String(points));
    }
    set({ rewardPoints: points });
  },

  /**
   * Load all rewards data from database
   */
  loadRewards: async () => {
    set({ loading: true });
    try {
      const [items, discountsList] = await Promise.all([
        db.rewards.toArray(),
        db.discounts.toArray(),
      ]);
      
      // Initialize points from localStorage
      let points = 0;
      if (typeof window !== "undefined") {
        const savedPoints = localStorage.getItem("rewardPoints");
        points = savedPoints ? parseFloat(savedPoints) || 0 : 0;
      }
      
      set({
        rewardItems: items,
        discounts: discountsList,
        rewardPoints: points,
        loading: false,
      });
    } catch (error) {
      console.error("Failed to load rewards:", error);
      toast.error("Failed to load rewards data");
      set({ loading: false });
    }
  },

  /**
   * Add a new reward item
   */
  addRewardItem: async (title: string, description: string | undefined, cost: number, category: string | undefined, emoji: string | undefined) => {
    try {
      const newItem: RewardItem = {
        title,
        description,
        cost,
        category,
        emoji,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const id = await db.rewards.add(newItem);
      const addedItem = { ...newItem, id };
      
      set((state) => ({
        rewardItems: [...state.rewardItems, addedItem],
      }));
      
      toast.success(`Added "${title}" to rewards shop!`);
    } catch (error) {
      console.error("Failed to add reward item:", error);
      toast.error("Failed to add reward item");
    }
  },

  /**
   * Update an existing reward item
   */
  updateRewardItem: async (id: number, updates: Partial<RewardItem>) => {
    try {
      await db.rewards.update(id, {
        ...updates,
        updatedAt: new Date(),
      });
      
      set((state) => ({
        rewardItems: state.rewardItems.map((item) =>
          item.id === id ? { ...item, ...updates, updatedAt: new Date() } : item
        ),
      }));
      
      toast.success("Reward item updated!");
    } catch (error) {
      console.error("Failed to update reward item:", error);
      toast.error("Failed to update reward item");
    }
  },

  /**
   * Delete a reward item
   */
  deleteRewardItem: async (id: number) => {
    try {
      await db.rewards.delete(id);
      
      set((state) => ({
        rewardItems: state.rewardItems.filter((item) => item.id !== id),
      }));
      
      toast.success("Reward item deleted!");
    } catch (error) {
      console.error("Failed to delete reward item:", error);
      toast.error("Failed to delete reward item");
    }
  },

  /**
   * Purchase a reward item
   */
  purchaseItem: (item: RewardItem) => {
    const state = get();
    const discount = state.getTotalDiscount();
    const finalCost = Math.floor(item.cost * (1 - discount / 100));
    
    state.spendPoints(finalCost, item.title);
  },

  /**
   * Add a new special discount
   */
  addDiscount: async (title: string, percentage: number) => {
    try {
      const newDiscount: SpecialDiscount = {
        title,
        percentage,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const id = await db.discounts.add(newDiscount);
      const addedDiscount = { ...newDiscount, id };
      
      set((state) => ({
        discounts: [...state.discounts, addedDiscount],
      }));
      
      toast.success(`Added ${percentage}% discount!`);
    } catch (error) {
      console.error("Failed to add discount:", error);
      toast.error("Failed to add discount");
    }
  },

  /**
   * Toggle discount active state
   */
  toggleDiscount: async (id: number) => {
    try {
      const discount = await db.discounts.get(id);
      if (!discount) return;
      
      const newActiveState = !discount.active;
      await db.discounts.update(id, {
        active: newActiveState,
        updatedAt: new Date(),
      });
      
      set((state) => ({
        discounts: state.discounts.map((d) =>
          d.id === id ? { ...d, active: newActiveState, updatedAt: new Date() } : d
        ),
      }));
      
      toast.success(newActiveState ? "Discount activated!" : "Discount deactivated!");
    } catch (error) {
      console.error("Failed to toggle discount:", error);
      toast.error("Failed to toggle discount");
    }
  },

  /**
   * Delete a discount
   */
  deleteDiscount: async (id: number) => {
    try {
      await db.discounts.delete(id);
      
      set((state) => ({
        discounts: state.discounts.filter((d) => d.id !== id),
      }));
      
      toast.success("Discount deleted!");
    } catch (error) {
      console.error("Failed to delete discount:", error);
      toast.error("Failed to delete discount");
    }
  },

  /**
   * Get total active discount percentage
   */
  getTotalDiscount: () => {
    const state = get();
    const activeDiscounts = state.discounts.filter((d) => d.active);
    return Math.min(100, activeDiscounts.reduce((sum, d) => sum + d.percentage, 0));
  },
}));