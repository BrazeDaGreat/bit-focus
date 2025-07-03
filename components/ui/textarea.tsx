/**
 * Textarea UI Component - Multi-line Text Input Interface
 * 
 * This component provides a styled textarea element for multi-line text input
 * throughout the BIT Focus application. It maintains consistent styling with
 * other form elements and provides proper accessibility support.
 * 
 * Features:
 * - Consistent styling with other form elements
 * - Theme-aware color schemes and borders
 * - Proper focus states and transitions
 * - Accessibility support with proper labeling
 * - Flexible sizing with row configuration
 * - Error state styling support
 * 
 * Use Cases:
 * - Task descriptions and notes
 * - Multi-line form inputs
 * - Comment and feedback forms
 * - Content creation interfaces
 * - Configuration text areas
 * 
 * Dependencies:
 * - React for component architecture
 * - Utility functions for class name management
 * - Tailwind CSS for styling
 * 
 * @fileoverview Textarea component for multi-line text input
 * @author BIT Focus Development Team
 * @since v0.7.1-alpha
 */

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Textarea Component Props Interface
 * 
 * Extends standard textarea HTML attributes to provide type safety
 * and consistent prop handling throughout the application.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * Textarea Component
 * 
 * Renders a styled textarea element with consistent design patterns
 * and proper accessibility support. The component integrates with
 * the application's theme system and form validation patterns.
 * 
 * The textarea automatically handles focus states, borders, and
 * hover effects to provide a smooth user experience. It supports
 * all standard textarea attributes including rows, cols, placeholder,
 * and validation states.
 * 
 * @component
 * @param {TextareaProps} props - Component props including all textarea attributes
 * @returns {JSX.Element} Styled textarea element
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <Textarea 
 *   placeholder="Enter your description..." 
 *   rows={4}
 * />
 * 
 * // With form integration
 * <Textarea 
 *   {...register("description")}
 *   placeholder="Task description"
 *   rows={3}
 *   className={errors.description ? "border-red-500" : ""}
 * />
 * 
 * // With controlled state
 * <Textarea 
 *   value={content}
 *   onChange={(e) => setContent(e.target.value)}
 *   placeholder="Write your content here..."
 *   rows={6}
 * />
 * 
 * // With custom styling
 * <Textarea 
 *   className="font-mono text-sm"
 *   placeholder="Code or technical content"
 *   rows={8}
 * />
 * ```
 * 
 * @see {@link React.TextareaHTMLAttributes} for available props
 * @see {@link cn} for class name utility
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }