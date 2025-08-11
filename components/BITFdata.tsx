import { useIsMobile } from "@/hooks/useIsMobile";
import SaveManager from "@/lib/SaveManager";
import { type JSX, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { FaFileCsv, FaFileExport, FaFileImport } from "react-icons/fa6";

/**
 * BITF Data Management Component
 *
 * Provides import and export functionality for BIT Focus data in .bitf.json format.
 * Includes keyboard shortcuts for quick access and handles file operations with
 * proper error handling and user feedback through toast notifications.
 *
 * Features:
 * - Export all application data to .bitf.json file
 * - Import data from .bitf.json files with validation
 * - Keyboard shortcuts (W for export, Q for import)
 * - Error handling with user-friendly messages
 * - Automatic page reload after successful import
 *
 * @component
 * @returns {JSX.Element} Dropdown menu with import/export options
 *
 * @example
 * ```tsx
 * // Used within the focus page for data management
 * <BITFdata />
 * ```
 *
 * @see {@link SaveManager} for data import/export operations
 */
export default function BITFdata(): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  /**
   * Handles data export operation
   *
   * Triggers the export process through SaveManager and provides
   * user feedback via toast notifications. Catches and handles
   * any errors that occur during the export process.
   *
   * @async
   * @returns {Promise<void>}
   */
  const handleExport = async (): Promise<void> => {
    try {
      await SaveManager.exportData();
      toast.success("Backup exported successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Export failed.");
    }
  };

  /**
   * Triggers the file input dialog for import
   *
   * Programmatically clicks the hidden file input element
   * to open the file selection dialog for import operations.
   *
   * @returns {void}
   */
  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  /**
   * Handles file selection and import process
   *
   * Processes the selected file through SaveManager import functionality.
   * Provides user feedback and handles the page reload sequence after
   * successful import to ensure all data is properly refreshed.
   *
   * @async
   * @param {React.ChangeEvent<HTMLInputElement>} e - File input change event
   * @returns {Promise<void>}
   */
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await SaveManager.importData(file);
      toast.success("Backup imported successfully!");
      toast.info("Reloading in 2 seconds to apply changes...");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error(err);
      toast.error("Import failed. Check file format.");
    } finally {
      e.target.value = "";
    }
  };

  /**
   * Set up keyboard shortcuts when dropdown is open
   *
   * Listens for keyboard events and triggers appropriate actions
   * when specific keys are pressed. Only active when the dropdown
   * is open and not interfering with other input elements.
   */
  useEffect(() => {
    if (!isOpen) return;

    const listener = (e: KeyboardEvent) => {
      // Skip if modifier keys are pressed or if user is typing in inputs
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA")
      )
        return;

      if (e.key.toLowerCase() === "w") {
        e.preventDefault();
        handleExport();
      } else if (e.key.toLowerCase() === "q") {
        e.preventDefault();
        handleImportClick();
      }
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [isOpen]);

  return (
    <>
      {/* Hidden File Input for Import */}
      <input
        type="file"
        accept=".bitf.json"
        onChange={handleFileChange}
        ref={fileInputRef}
        className="hidden"
      />

      {/* Dropdown Menu */}
      <DropdownMenu onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <FaFileCsv className="mr-2" />
            {!isMobile && "BITF Data"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={handleExport}>
            <FaFileExport className="mr-2" />
            <span>Export</span>
            <DropdownMenuShortcut>W</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick}>
            <FaFileImport className="mr-2" />
            <span>Import</span>
            <DropdownMenuShortcut>Q</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
