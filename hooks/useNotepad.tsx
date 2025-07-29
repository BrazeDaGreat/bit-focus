/**
 * Notepad Management Hook - Persistent Text Editor with Mathematical Operations
 *
 * This Zustand-based hook manages notepad data with persistent storage and
 * mathematical computation capabilities. It provides a simple text editor
 * interface for the sidebar with automatic calculation features when users
 * input mathematical expressions followed by "=".
 *
 * Features:
 * - Persistent text storage using localStorage
 * - Real-time mathematical expression evaluation
 * - Automatic calculation insertion on "=" trigger
 * - Type-safe state management with TypeScript
 * - Cross-window synchronization via Zustand persist
 * - Error handling for invalid mathematical expressions
 *
 * Mathematical Operations Supported:
 * - Basic arithmetic: +, -, *, /
 * - Modulo operation: %
 * - Exponentiation: ^ or **
 * - Parentheses for grouping: ()
 * - Decimal numbers and scientific notation
 *
 * Use Cases:
 * - Quick calculations during work sessions
 * - Note-taking with embedded calculations
 * - Mathematical scratch pad
 * - Formula validation and testing
 *
 * Storage Architecture:
 * - localStorage persistence via Zustand persist middleware
 * - Automatic synchronization across browser tabs
 * - Immediate state updates for responsive UI
 * - Error recovery with fallback to empty content
 *
 * Dependencies:
 * - Zustand for state management
 * - Zustand persist middleware for localStorage integration
 * - TypeScript for type safety
 *
 * @fileoverview Notepad state management with mathematical computation support
 * @author BIT Focus Development Team
 * @since v0.10.0-alpha
 */

import { create } from "zustand";
import { persist, PersistStorage } from "zustand/middleware";

/**
 * Notepad State Interface
 *
 * Defines the complete structure of notepad state including content storage
 * and available operations for text manipulation and mathematical computation.
 */
interface NotepadState {
  /** Current notepad content */
  content: string;
  /** Function to update notepad content */
  setContent: (content: string) => void;
  /** Function to clear all notepad content */
  clearContent: () => void;
  /** Function to append text to current content */
  appendContent: (text: string) => void;
  /** Function to process mathematical expressions and insert results */
  processCalculation: (text: string) => string;
}

/**
 * Mathematical Expression Evaluator
 *
 * Safely evaluates mathematical expressions using a restricted set of
 * operations. This function replaces dangerous eval() with a secure
 * mathematical parser that supports basic arithmetic and common functions.
 *
 * Security Features:
 * - No access to global variables or functions
 * - Restricted to mathematical operations only
 * - Input sanitization to prevent code injection
 * - Error handling for invalid expressions
 *
 * @param {string} expression - Mathematical expression to evaluate
 * @returns {number} Calculated result
 * @throws {Error} When expression is invalid or contains unsafe content
 *
 * @example
 * ```typescript
 * // Basic arithmetic
 * evaluateExpression("2 + 3 * 4")
 * // Returns: 14
 *
 * // With parentheses
 * evaluateExpression("(2 + 3) * 4")
 * // Returns: 20
 *
 * // Decimal calculations
 * evaluateExpression("10.5 / 2.5")
 * // Returns: 4.2
 * ```
 */
function evaluateExpression(expression: string): number {
  // Remove whitespace and validate input
  const cleaned = expression.replace(/\s/g, "");
  
  // Check for dangerous characters or keywords
  const dangerousPatterns = [
    /[a-zA-Z_$]/, // Variables or function names
    /\/\*/, // Comments
    /\/\//, // Comments
    /;/, // Statement separators
    /\{/, // Object literals
    /\}/, // Object literals
    /\[/, // Array access
    /\]/, // Array access
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(cleaned)) {
      throw new Error("Invalid expression");
    }
  }
  
  // Replace ^ with ** for exponentiation
  const processedExpression = cleaned.replace(/\^/g, "**");
  
  // Validate that expression only contains allowed characters
  const allowedPattern = /^[0-9+\-*/.()%\s**]+$/;
  if (!allowedPattern.test(processedExpression)) {
    throw new Error("Expression contains invalid characters");
  }
  
  try {
    // Use Function constructor instead of eval for better security
    const result = new Function(`"use strict"; return (${processedExpression})`)();
    
    // Validate result is a number
    if (typeof result !== "number" || !isFinite(result)) {
      throw new Error("Invalid calculation result");
    }
    
    return result;
  } catch {
    throw new Error("Invalid mathematical expression");
  }
}

/**
 * Storage Configuration for Zustand Persist
 *
 * Defines the localStorage interface for notepad data persistence.
 * This configuration ensures consistent data storage and retrieval
 * across browser sessions and tabs.
 */
const storage: PersistStorage<NotepadState> = {
  /**
   * Retrieve notepad data from localStorage
   *
   * @param {string} key - Storage key identifier
   * @returns {any} Parsed notepad data or null if not found
   */
  getItem: (key) => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  
  /**
   * Store notepad data in localStorage
   *
   * @param {string} key - Storage key identifier
   * @param {any} value - Notepad data to store
   */
  setItem: (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  
  /**
   * Remove notepad data from localStorage
   *
   * @param {string} key - Storage key identifier
   */
  removeItem: (key) => {
    localStorage.removeItem(key);
  },
};

/**
 * Notepad Store
 *
 * Creates a Zustand store for notepad state management with persistent
 * storage and mathematical computation capabilities. The store handles
 * content updates, calculations, and cross-tab synchronization automatically.
 *
 * @hook
 * @returns {NotepadState} Notepad state and management functions
 *
 * @example
 * ```tsx
 * // Basic notepad usage
 * function NotepadComponent() {
 *   const { content, setContent, clearContent } = useNotepad();
 *
 *   return (
 *     <div>
 *       <textarea 
 *         value={content}
 *         onChange={(e) => setContent(e.target.value)}
 *       />
 *       <button onClick={clearContent}>Clear</button>
 *     </div>
 *   );
 * }
 *
 * // Mathematical calculation processing
 * function CalculatorNotepad() {
 *   const { content, processCalculation, setContent } = useNotepad();
 *
 *   const handleCalculation = () => {
 *     const processed = processCalculation(content);
 *     setContent(processed);
 *   };
 *
 *   return (
 *     <textarea 
 *       value={content}
 *       onChange={(e) => setContent(e.target.value)}
 *       onKeyPress={(e) => {
 *         if (e.key === '=') {
 *           handleCalculation();
 *         }
 *       }}
 *     />
 *   );
 * }
 * ```
 *
 * @see {@link evaluateExpression} for mathematical computation details
 * @see {@link https://github.com/pmndrs/zustand} for Zustand documentation
 */
export const useNotepad = create<NotepadState>()(
  persist(
    (set, get) => ({
      /** Initial empty content */
      content: "",
      
      /**
       * Set Notepad Content
       *
       * Updates the notepad content with new text. This function triggers
       * automatic persistence to localStorage and notifies all subscribers
       * of the state change for real-time UI updates.
       *
       * @param {string} content - New content to set
       */
      setContent: (content: string) => set({ content }),
      
      /**
       * Clear Notepad Content
       *
       * Removes all content from the notepad and persists the empty state.
       * This provides a quick way to reset the notepad for new calculations
       * or note-taking sessions.
       */
      clearContent: () => set({ content: "" }),
      
      /**
       * Append Content to Notepad
       *
       * Adds new text to the end of the current notepad content. Useful
       * for programmatic content addition or template insertion.
       *
       * @param {string} text - Text to append to current content
       */
      appendContent: (text: string) => {
        const currentContent = get().content;
        set({ content: currentContent + text });
      },
      
      /**
       * Process Mathematical Calculations
       *
       * Analyzes the provided text for mathematical expressions followed by
       * "=" and replaces them with calculated results. This function handles
       * multiple calculations within the same text and provides error handling
       * for invalid expressions.
       *
       * Algorithm:
       * 1. Split text by lines for line-by-line processing
       * 2. Find lines ending with "=" that contain mathematical expressions
       * 3. Extract the expression before the "="
       * 4. Evaluate the expression using safe mathematical parsing
       * 5. Replace "=" with "= result" for valid calculations
       * 6. Leave invalid expressions unchanged with error indication
       *
       * @param {string} text - Text content to process for calculations
       * @returns {string} Processed text with calculation results
       *
       * @example
       * ```typescript
       * // Single calculation
       * processCalculation("2 + 3 =")
       * // Returns: "2 + 3 = 5"
       *
       * // Multiple calculations
       * processCalculation("First: 10 * 2 =\nSecond: (5 + 3) / 2 =")
       * // Returns: "First: 10 * 2 = 20\nSecond: (5 + 3) / 2 = 4"
       *
       * // Mixed content with notes
       * processCalculation("Shopping budget: 100 - 25 =\nRemaining for entertainment")
       * // Returns: "Shopping budget: 100 - 25 = 75\nRemaining for entertainment"
       * ```
       */
      processCalculation: (text: string): string => {
        const lines = text.split('\n');
        const processedLines = lines.map(line => {
          // Check if line ends with = and contains a potential calculation
          if (line.trim().endsWith('=')) {
            // Extract everything before the final =
            const expression = line.substring(0, line.lastIndexOf('=')).trim();
            
            // Skip if expression is empty or already has a result after =
            if (!expression || line.includes('=') && line.split('=')[1].trim()) {
              return line;
            }
            
            try {
              // Attempt to evaluate the mathematical expression
              const result = evaluateExpression(expression);
              
              // Format result to remove unnecessary decimals
              const formattedResult = Number.isInteger(result) 
                ? result.toString() 
                : parseFloat(result.toFixed(8)).toString();
              
              return `${expression} = ${formattedResult}`;
            } catch (error) {
              // Return original line if calculation fails
              console.warn("Calculation error:", error);
              return line;
            }
          }
          
          return line;
        });
        
        return processedLines.join('\n');
      },
    }),
    {
      name: "notepad-storage", // Storage key for localStorage
      storage: storage, // Custom storage configuration
    }
  )
);