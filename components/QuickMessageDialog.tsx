/**
 * Quick Message Dropdown Component
 *
 * Provides a dropdown menu for selecting and sending predefined
 * status messages via webhook. Integrates with the existing webhook
 * system to send notifications to Discord or other configured endpoints.
 *
 * Features:
 * - Selectable predefined messages with icons from a dropdown
 * - Visual feedback on send success/failure
 * - Webhook validation before sending
 * - Loading states during transmission
 *
 * @fileoverview Quick message selection and sending dropdown
 * @author BIT Focus Development Team
 * @since v0.13.0-beta
 */

"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FaMessage } from "react-icons/fa6";
import { QUICK_MESSAGES } from "@/lib/quickMessages";
import { sendMessage } from "@/lib/webhook";
import { useConfig } from "@/hooks/useConfig";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";

/**
 * Quick Message Dropdown Component
 *
 * Renders a dropdown menu with predefined message options that can be sent
 * via webhook. Handles message selection, webhook validation, and
 * provides user feedback on send status.
 *
 * @component
 * @returns {JSX.Element} Quick message dropdown menu
 *
 * @example
 * ```tsx
 * <QuickMessageDropdown />
 * ```
 */
export default function QuickMessageDropdown() {
  const { webhook, name } = useConfig();
  const [sending, setSending] = useState(false);
  const isMobile = useIsMobile();

  /**
   * Handles sending a selected quick message via webhook
   *
   * Validates webhook configuration, sends the message, and provides
   * appropriate user feedback based on success or failure.
   *
   * @param {string} message - The predefined message to send
   */
  const handleSendMessage = async (message: string) => {
    // Validate webhook configuration
    if (!webhook) {
      toast.error("No webhook configured. Please set up your webhook in settings.");
      return;
    }

    setSending(true);

    try {
      // Format message with user name if available
      const formattedMessage = name ? `${name}: ${message}` : message;

      // Send message via webhook
      const success = await sendMessage(formattedMessage, webhook);

      if (success) {
        toast.success("Message sent successfully!");
      } else {
        toast.error("Failed to send message. Please check your webhook URL.");
      }
    } catch (error) {
      console.error("Error sending quick message:", error);
      toast.error("An error occurred while sending the message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={sending}>
          {sending ? (
            <>
              <Loader2 className={`h-4 w-4 animate-spin ${!isMobile ? "mr-2" : ""}`} />
              {!isMobile && "Sending..."}
            </>
          ) : (
            <>
              <FaMessage className={!isMobile ? "mr-2" : ""} />
              {!isMobile && "Quick Message"}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Send a Quick Message</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {QUICK_MESSAGES.map((item, index) => (
          <DropdownMenuItem
            key={index}
            onSelect={() => handleSendMessage(item.message)}
            disabled={sending}
            className="flex items-center gap-2 cursor-pointer"
          >
            <item.icon className="h-4 w-4 text-muted-foreground" />
            <span>{item.message}</span>
          </DropdownMenuItem>
        ))}
        {!webhook && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              ⚠️ No webhook configured.
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
