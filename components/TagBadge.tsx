import { cn, stringToHexColor } from "@/lib/utils";
import { FaTrash } from "react-icons/fa6";

interface TagBadgeProps {
  tag: string;
  deletable?: boolean;
  noHover?: boolean;
  removeTag?: () => void;
}

export default function TagBadge(props: TagBadgeProps) {
  const { tag } = props;
  const color = stringToHexColor(tag, 0.6);

  if (props.deletable) {
    const { removeTag } = props;
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-sm",
          "px-2.5 py-0.5 text-xs font-medium select-none",
          "opacity-80 hover:opacity-100 transition-opacity",

          // Deletable
          "cursor-pointer",
          "group",
          props.noHover ? "" : "hover:space-x-1"
        )}
        style={{
          backgroundColor: color[0],
          color: color[1] ? "white" : "black",
        }}
        onClick={removeTag}
      >
        <span>#{tag}</span>
        {!props.noHover && (
          <span
            className={cn(
              "w-0 group-hover:w-3",
              "overflow-hidden",
              "transition-all"
            )}
          >
            <FaTrash />
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium select-none opacity-80 hover:opacity-100 transition-opacity"
      style={{
        backgroundColor: color[0],
        color: color[1] ? "white" : "black",
      }}
    >
      #{tag}
    </span>
  );
}

// className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
