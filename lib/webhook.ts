import { VERSION } from "@/app/changelog/CHANGELOG";
import axios from "axios";

export const sendMessage = async (
  message: string,
  webhookUrl: string
): Promise<boolean> => {
  if (!webhookUrl || !/^https?:\/\/.+\..+/.test(webhookUrl)) {
    return false;
  }
  const avatarUrl = "https://bitfocus.vercel.app/bit_focus.png";

  const embed = {
    description: message,
    color: 0xec938b,
    timestamp: new Date().toISOString(),
    footer: {
      text: `Sent via BIT Focus ${VERSION}`,
      icon_url: avatarUrl,
    },
  };

  try {
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
