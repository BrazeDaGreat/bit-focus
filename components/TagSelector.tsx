import TagBadge from "@/components/TagBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTag } from "@/hooks/useTag";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { FaPencil } from "react-icons/fa6";

export default function TagSelector() {
    const { tag, setTag, removeTag } = useTag();
    const [tempTag, setTempTag] = useState("");
  
    if (tag)
      return (
        <div className="">
          <TagBadge tag={tag} deletable removeTag={removeTag} />
        </div>
      );
  
    return (
      <div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              size={"sm"}
              className={cn(
                // Style
                "space-x-2",
                // Function
                "w-9 justify-start overflow-hidden",
                "hover:w-32",
                "transition-all"
              )}
            >
              <FaPencil />
              <span>Choose Tag</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="flex flex-col space-y-4">
            <Label htmlFor="tag">Assign a Tag</Label>
            <Input
              id="tag"
              value={tempTag}
              onChange={(e) => setTempTag(e.target.value)}
            />
            <Button onClick={() => setTag(tempTag)}>Save</Button>
          </PopoverContent>
        </Popover>
      </div>
    );
  }