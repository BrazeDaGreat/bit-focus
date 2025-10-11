/**
 * Quick Messages Configuration
 *
 * Predefined status messages, each with an associated icon, that can
 * be sent via webhook for quick communication.
 *
 * @fileoverview Predefined quick message templates with icons
 * @author BIT Focus Development Team
 * @since v0.13.0-beta
 */

import { IconType } from "react-icons";
import {
  FaBed,
  FaBrain,
  FaCoffee,
  FaUserSecret,
  FaSignOutAlt,
  FaRunning,
  FaRocket,
  FaHeadphones,
} from "react-icons/fa";

// Define the structure for a quick message object
export interface QuickMessage {
  message: string;
  icon: IconType;
}

export const QUICK_MESSAGES: QuickMessage[] = [
  { message: "I'm feeling tired", icon: FaBed },
  { message: "Focusing Right Now", icon: FaBrain },
  { message: "Taking a short break", icon: FaCoffee },
  { message: "Deep work mode", icon: FaUserSecret },
  { message: "Wrapping up for the day", icon: FaSignOutAlt },
  { message: "Running behind schedule", icon: FaRunning },
  { message: "Making great progress!", icon: FaRocket },
  { message: "Need some quiet time", icon: FaHeadphones },
];
