import { type JSX } from "react";
import { FaExternalLinkSquareAlt } from "react-icons/fa";
import { FaGithub, FaSlack, FaDiscord, FaYoutube } from "react-icons/fa6";
import { RiAnthropicFill, RiNotionFill } from "react-icons/ri";

export default function getIconFromLink(url: string): JSX.Element {
    if (url.includes("github")) return <FaGithub className="text-black" />
    if (url.includes("youtube")) return <FaYoutube className="text-red-500" />
    if (url.includes("slack")) return <FaSlack className="text-[#3Aaf85]" />
    if (url.includes("discord")) return <FaDiscord className="text-[#5865F2]" />
    if (url.includes("claude")) return <RiAnthropicFill className="text-[#C15F3C]" />
    if (url.includes("notion")) return <RiNotionFill className="text-[#FFFFFF]" />
    return <FaExternalLinkSquareAlt />
}