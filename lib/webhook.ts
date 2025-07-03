/**
 * Discord Webhook Integration - External Notification System
 * 
 * This module provides functionality for sending formatted messages to Discord
 * channels via webhooks. It's used to notify users about focus session activities
 * and milestones through their preferred Discord channels, enabling integration
 * with productivity workflows and team coordination.
 * 
 * Features:
 * - Rich embed message formatting with timestamps
 * - Custom branding with application avatar and footer
 * - URL validation for security and reliability
 * - Error handling and status reporting
 * - Version-aware message attribution
 * - Color-coded embeds for visual consistency
 * 
 * Use Cases:
 * - Focus session start/end notifications
 * - Productivity milestone achievements
 * - Task completion announcements
 * - Team coordination and accountability
 * 
 * Dependencies:
 * - Axios for HTTP requests
 * - Application version constants
 * 
 * @fileoverview Discord webhook integration for external notifications
 * @author BIT Focus Development Team
 * @since v0.3.2-alpha
 */

import { VERSION } from "@/app/changelog/CHANGELOG";
import axios from "axios";

/**
 * Send Message to Discord Webhook
 * 
 * Sends a formatted message to a Discord channel via webhook URL. The message
 * is embedded with rich formatting including color, timestamp, and application
 * branding. Includes comprehensive error handling and URL validation for
 * security and reliability.
 * 
 * The function validates the webhook URL format before attempting to send,
 * preventing issues with malformed or potentially malicious URLs. Messages
 * are formatted as Discord embeds with consistent styling and branding.
 * 
 * @async
 * @param {string} message - The message content to send
 * @param {string} webhookUrl - Discord webhook URL for message delivery
 * @returns {Promise<boolean>} Success status of the webhook delivery
 * 
 * @example
 * ```typescript
 * // Send focus session start notification
 * const success = await sendMessage(
 *   "Started focusing on #Work project",
 *   "https://discord.com/api/webhooks/123456789/abcdef..."
 * );
 * 
 * if (success) {
 *   console.log("Notification sent successfully");
 * } else {
 *   console.log("Failed to send notification");
 * }
 * 
 * // Send completion notification
 * await sendMessage(
 *   "Completed 45 minutes of focused work on #Study",
 *   webhookUrl
 * );
 * ```
 * 
 * @see {@link https://discord.com/developers/docs/resources/webhook} for Discord webhook documentation
 * @see {@link VERSION} for application version information
 */
export const sendMessage = async (
  message: string,
  webhookUrl: string
): Promise<boolean> => {
  // Validate webhook URL format for security
  if (!webhookUrl || !/^https?:\/\/.+\..+/.test(webhookUrl)) {
    return false;
  }
  
  // Application branding configuration
  const avatarUrl = "https://bitfocus.vercel.app/bit_focus.png";

  // Discord embed message structure
  const embed = {
    description: message,
    color: 0xec938b, // Brand color in hexadecimal
    timestamp: new Date().toISOString(),
    footer: {
      text: `Sent via BIT Focus ${VERSION}`,
      icon_url: avatarUrl,
    },
  };

  try {
    // Send webhook request with Discord-compatible payload
    await axios.post(webhookUrl, {
      username: "BIT Focus",
      avatar_url: avatarUrl,
      embeds: [embed],
    });
    return true;
  } catch (error) {
    console.error("Failed to send webhook:", error);
    return false;
  }
};