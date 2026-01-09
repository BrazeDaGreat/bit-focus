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
import { FaFileCsv, FaFileExport, FaFileImport, FaUpload, FaTriangleExclamation } from "react-icons/fa6";
import { useConfig } from "@/hooks/useConfig";
import { VERSION } from "@/app/changelog/CHANGELOG";
import axios from "axios";

/**
 * BITF Data Management Component
 *
 * Provides import, export, and upload functionality for BIT Focus data in .bitf.json format.
 * Includes keyboard shortcuts for quick access and handles file operations with
 * proper error handling and user feedback through toast notifications.
 *
 * Features:
 * - Export all application data to .bitf.json file
 * - Import data from .bitf.json files with validation
 * - Upload backup to Discord via webhook
 * - Keyboard shortcuts (W for export, Q for import, E for upload)
 * - Error handling with user-friendly messages
 * - Automatic page reload after successful import
 *
 * @component
 * @returns {JSX.Element} Dropdown menu with import/export/upload options
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
  const { webhook } = useConfig();
  const hasWebhook = webhook && webhook.trim().length > 0;

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
   * Handles upload to Discord webhook
   *
   * Exports the current data and uploads it as a file attachment to the
   * configured Discord webhook. Provides user feedback and handles errors
   * during the upload process.
   *
   * @async
   * @returns {Promise<void>}
   */
  const handleUpload = async (): Promise<void> => {
    if (!hasWebhook) {
      toast.error("No webhook configured. Please set a webhook in settings.");
      return;
    }

    try {

      toast.info("Uploading BITF data to Discord...");

      // Get the exported data as JSON
      const data = await SaveManager.exportJSON();

      // Create a blob and file from the JSON data
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `bitfocus-${timestamp}.bitf.json`;

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", blob, filename);

      // Add message content
      const avatarUrl = "https://bitfocus.vercel.app/bit_focus.png";
      formData.append("username", "BIT Focus");
      formData.append("avatar_url", avatarUrl);
      formData.append("content", `📦 Backup uploaded from BIT Focus ${VERSION}`);

      // Send to webhook
      await axios.post(webhook, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("BITF data uploaded to Discord successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Check your webhook URL.");
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
      } else if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (hasWebhook) {
          handleUpload();
        }
      }
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [isOpen, hasWebhook]);

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
          <DropdownMenuItem
            onClick={handleUpload}
            disabled={!hasWebhook}
          >
            {hasWebhook ? (
              <FaUpload className="mr-2" />
            ) : (
              <FaTriangleExclamation className="mr-2 text-yellow-500" />
            )}
            <span>Upload</span>
            <DropdownMenuShortcut>A</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
