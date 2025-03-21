import { stringToHexColor } from "@/lib/utils";

export default function TagBadge({ tag }: { tag: string }) {
    const color = stringToHexColor(tag, 0.5);
    return <span className="inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium" style={{
        backgroundColor: color[0],
        color: color[1] ? "white" : "black"
    }}>#{tag}</span>
}

// className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"