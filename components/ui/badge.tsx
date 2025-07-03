/**
 * Badge UI Component - Status and Category Indicators
 * 
 * This component provides visual badges for displaying status indicators,
 * categories, and labels throughout the BIT Focus application. It supports
 * multiple variants for different use cases and contexts.
 * 
 * Features:
 * - Multiple style variants (default, secondary, destructive, outline)
 * - Consistent sizing and typography
 * - Theme-aware color schemes
 * - Flexible content support
 * - Accessible design with proper contrast
 * 
 * Use Cases:
 * - Priority indicators in task management
 * - Status labels for focus sessions
 * - Category tags for organization
 * - Count indicators in navigation
 * - Warning and error states
 * 
 * Dependencies:
 * - Class Variance Authority for style variants
 * - Tailwind CSS for styling
 * - React for component architecture
 * 
 * @fileoverview Badge component for status and category indicators
 * @author BIT Focus Development Team
 * @since v0.7.1-alpha
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Badge Variant Styles
 * 
 * Defines the available style variants for badges using Class Variance Authority.
 * Each variant provides appropriate colors and styling for different contexts.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/**
 * Badge Component Props Interface
 * 
 * Extends standard div props with badge-specific variant styling options.
 */
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Badge Component
 * 
 * Renders a styled badge element with configurable variants for different
 * contexts and use cases. Provides consistent visual indicators throughout
 * the application with proper accessibility support.
 * 
 * The component automatically applies appropriate colors, borders, and
 * hover states based on the selected variant. Content is flexible and
 * can include text, icons, or other elements.
 * 
 * @component
 * @param {BadgeProps} props - Component props including variant and content
 * @returns {JSX.Element} Styled badge element
 * 
 * @example
 * ```tsx
 * // Basic usage with different variants
 * <Badge variant="default">Active</Badge>
 * <Badge variant="secondary">Draft</Badge>
 * <Badge variant="destructive">Error</Badge>
 * <Badge variant="outline">Pending</Badge>
 * 
 * // With custom styling
 * <Badge variant="secondary" className="text-green-600">
 *   Completed
 * </Badge>
 * 
 * // With icon content
 * <Badge variant="outline">
 *   <FaExclamation className="mr-1" />
 *   High Priority
 * </Badge>
 * 
 * // Count indicators
 * <Badge variant="default">{taskCount}</Badge>
 * ```
 * 
 * @see {@link badgeVariants} for available style variants
 * @see {@link VariantProps} for variant prop types
 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }