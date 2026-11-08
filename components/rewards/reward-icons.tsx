/**
 * Reward Item Icons
 *
 * Items store an icon id from this list, or a literal emoji the person typed.
 * Ids are stable strings, so the list can grow and be reordered freely.
 * The first five ids are the icons offered before v0.25.0 (`LEGACY_ICON_IDS`).
 *
 * @since v0.25.0-beta
 */

import type { LucideIcon } from "lucide-react";
import {
  Bath, Bed, Beer, Bike, BookOpen, Brush, Cake, Camera, Candy, Car, Cat, Clapperboard, Coffee,
  Cookie, Croissant, CupSoda, Dices, Dog, Dumbbell, Footprints, Gamepad2, Gift, Headphones,
  Heart, Hourglass, IceCreamCone, Joystick, Laptop, MessageCircle, Mountain, Music, Palette,
  PartyPopper, Pizza, Plane, Popcorn, Puzzle, ShoppingBag, Shirt, Smartphone, Sofa, Sparkles,
  Star, Sun, Ticket, TreePine, Trophy, Tv, Users, Volleyball, Waves, Wine,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** One choosable icon. */
export interface RewardIconOption {
  id: string;
  label: string;
  Icon: LucideIcon;
}

/** Every icon offered for shop items, legacy ids first. */
export const REWARD_ICONS: readonly RewardIconOption[] = [
  { id: "hourglass", label: "Break", Icon: Hourglass },
  { id: "gamepad", label: "Gaming", Icon: Gamepad2 },
  { id: "burger", label: "Food", Icon: Pizza },
  { id: "smartphone", label: "Phone", Icon: Smartphone },
  { id: "ball", label: "Sport", Icon: Volleyball },
  { id: "coffee", label: "Coffee", Icon: Coffee },
  { id: "cookie", label: "Cookie", Icon: Cookie },
  { id: "ice-cream", label: "Ice cream", Icon: IceCreamCone },
  { id: "soda", label: "Drink", Icon: CupSoda },
  { id: "cake", label: "Cake", Icon: Cake },
  { id: "candy", label: "Sweets", Icon: Candy },
  { id: "croissant", label: "Pastry", Icon: Croissant },
  { id: "popcorn", label: "Popcorn", Icon: Popcorn },
  { id: "beer", label: "Beer", Icon: Beer },
  { id: "wine", label: "Wine", Icon: Wine },
  { id: "tv", label: "TV", Icon: Tv },
  { id: "film", label: "Film", Icon: Clapperboard },
  { id: "music", label: "Music", Icon: Music },
  { id: "headphones", label: "Podcast", Icon: Headphones },
  { id: "book", label: "Reading", Icon: BookOpen },
  { id: "joystick", label: "Arcade", Icon: Joystick },
  { id: "puzzle", label: "Puzzle", Icon: Puzzle },
  { id: "dice", label: "Board game", Icon: Dices },
  { id: "laptop", label: "Browsing", Icon: Laptop },
  { id: "chat", label: "Chat", Icon: MessageCircle },
  { id: "friends", label: "Friends", Icon: Users },
  { id: "nap", label: "Nap", Icon: Bed },
  { id: "sofa", label: "Lounge", Icon: Sofa },
  { id: "bath", label: "Bath", Icon: Bath },
  { id: "walk", label: "Walk", Icon: Footprints },
  { id: "bike", label: "Ride", Icon: Bike },
  { id: "gym", label: "Gym", Icon: Dumbbell },
  { id: "nature", label: "Outdoors", Icon: TreePine },
  { id: "mountain", label: "Hike", Icon: Mountain },
  { id: "swim", label: "Swim", Icon: Waves },
  { id: "sun", label: "Sunshine", Icon: Sun },
  { id: "dog", label: "Dog", Icon: Dog },
  { id: "cat", label: "Cat", Icon: Cat },
  { id: "shopping", label: "Shopping", Icon: ShoppingBag },
  { id: "clothes", label: "Clothes", Icon: Shirt },
  { id: "car", label: "Drive", Icon: Car },
  { id: "travel", label: "Trip", Icon: Plane },
  { id: "ticket", label: "Event", Icon: Ticket },
  { id: "party", label: "Party", Icon: PartyPopper },
  { id: "camera", label: "Photos", Icon: Camera },
  { id: "art", label: "Art", Icon: Palette },
  { id: "craft", label: "Craft", Icon: Brush },
  { id: "gift", label: "Gift", Icon: Gift },
  { id: "heart", label: "Self-care", Icon: Heart },
  { id: "star", label: "Treat", Icon: Star },
  { id: "trophy", label: "Big win", Icon: Trophy },
  { id: "sparkles", label: "Special", Icon: Sparkles },
];

const BY_ID = new Map(REWARD_ICONS.map((option) => [option.id, option]));

/** True when the stored icon is an icon id rather than an emoji. */
export function isIconId(icon: string | undefined): boolean {
  return !!icon && BY_ID.has(icon);
}

/**
 * Draw an item's icon: a registered icon, a typed emoji, or a gift as fallback.
 *
 * @param icon - Stored icon id or emoji.
 */
export function RewardIcon({ icon, className }: { icon?: string; className?: string }) {
  const option = icon ? BY_ID.get(icon) : undefined;
  if (option) return <option.Icon aria-hidden className={cn("size-5", className)} />;
  if (icon) {
    return (
      <span aria-hidden className={cn("inline-flex size-5 items-center justify-center leading-none", className)}>
        {icon}
      </span>
    );
  }
  return <Gift aria-hidden className={cn("size-5", className)} />;
}
