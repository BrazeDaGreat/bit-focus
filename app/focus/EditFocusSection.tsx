/**
 * Edit Focus Session Component - Dropdown Menu Item Wrapper
 *
 * This component wraps the EditFocusSessionDialog to work as a dropdown menu item.
 * It provides the trigger (dropdown menu item) and manages the dialog open state.
 *
 * @fileoverview Edit focus session dropdown menu item component
 * @author BIT Focus Development Team
 * @since v0.2.0-alpha
 */

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FocusSession } from "@/hooks/useFocus";
import { useState } from "react";
import type { JSX } from "react";
import { FaPencil } from "react-icons/fa6";
import { EditFocusSessionDialog } from "@/components/EditFocusSessionDialog";

/**
 * Props interface for the EditFocusSession component
 */
interface EditFocusSessionProps {
  /** The focus session item to be edited */
  item: FocusSession;
  /** Callback function to control the parent dropdown state */
  setIsDropdownOpen: (state: boolean) => void;
}

/**
 * Edit Focus Session Component
 *
 * Renders a dropdown menu item that, when clicked, opens the edit dialog.
 * Uses the shared EditFocusSessionDialog component for the actual editing form.
 *
 * @component
 * @param {EditFocusSessionProps} props - Component props
 * @param {FocusSession} props.item - The focus session to edit
 * @param {function} props.setIsDropdownOpen - Function to control dropdown state
 * @returns {JSX.Element} The edit focus session dropdown menu item
 *
 * @example
 * ```tsx
 * <EditFocusSession
 *   item={focusSession}
 *   setIsDropdownOpen={setDropdownOpen}
 * />
 * ```
 */
export function EditFocusSession({
  item,
  setIsDropdownOpen,
}: EditFocusSessionProps): JSX.Element {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setIsDropdownOpen(false);
    }
  };

  return (
    <>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          setIsDialogOpen(true);
        }}
      >
        <FaPencil />
        <span>Edit</span>
      </DropdownMenuItem>

      <EditFocusSessionDialog
        session={item}
        open={isDialogOpen}
        onOpenChange={handleOpenChange}
      />
    </>
  );
}
