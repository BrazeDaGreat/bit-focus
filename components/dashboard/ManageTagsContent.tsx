/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Manage Tags Content
 *
 * The form and saved-tag list behind the dashboard's "Manage tags" button.
 * Kept in its own module so react-hook-form and the colour picker are only
 * downloaded when someone actually opens the popover.
 */

import { type JSX } from "react";
import { useForm } from "react-hook-form";
import { FaPlus, FaTrash } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import ColorPicker from "@/components/ui/color-picker";
import { useTag } from "@/hooks/useTag";

export const DEFAULT_TAG_COLOR = "#3b82f6";

export default function ManageTagsContent({
  color,
  onColorChange,
}: {
  color: string;
  onColorChange: (color: string) => void;
}): JSX.Element {
  const { savedTags, addSavedTag, removeSavedTag } = useTag();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm();

  const create = (data: any) => {
    addSavedTag(data.tagname, color);
    reset();
    onColorChange(DEFAULT_TAG_COLOR);
  };

  return (
    <>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit(create)}>
        <Label htmlFor="tag-name" className="text-sm md:text-xs">
          Tag name
        </Label>
        <Input
          id="tag-name"
          className="h-12 rounded-xl text-base md:h-8 md:rounded-md md:text-sm"
          {...register("tagname", { required: true })}
        />
        {errors.tagname && (
          <span className="text-xs text-red-500">Enter a tag name</span>
        )}
        <Label htmlFor="tag-color" className="text-sm md:text-xs">
          Color
        </Label>
        <ColorPicker id="tag-color" value={color} onChange={onColorChange} />
        <Button
          type="submit"
          size="sm"
          className="h-12 touch-manipulation gap-2 rounded-full md:h-8 md:gap-1.5 md:rounded-md"
        >
          <FaPlus className="size-3 md:size-2.5" />
          Add tag
        </Button>
      </form>

      {savedTags.length > 0 && (
        <div className="mt-5 border-t pt-4 md:mt-3 md:pt-3">
          <p className="mb-2 text-sm text-muted-foreground md:text-xs">Saved tags</p>
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto overscroll-contain md:max-h-40 md:gap-0.5">
            {savedTags.map((savedTag) => (
              <div
                key={savedTag.t}
                className="group flex min-h-12 shrink-0 items-center gap-3 rounded-xl px-3 hover:bg-muted/60 md:min-h-0 md:gap-2 md:rounded-lg md:px-1.5 md:py-1"
              >
                <span
                  className="size-3 shrink-0 rounded-full md:size-2.5"
                  style={{ backgroundColor: savedTag.c }}
                />
                <span className="min-w-0 flex-1 truncate text-sm md:text-xs">
                  {savedTag.t}
                </span>
                <button
                  type="button"
                  onClick={() => removeSavedTag(savedTag.t)}
                  className="grid size-10 shrink-0 touch-manipulation place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:size-auto md:opacity-0 md:transition-opacity md:hover:bg-transparent md:group-hover:opacity-100"
                  title={`Remove ${savedTag.t}`}
                  aria-label={`Remove ${savedTag.t}`}
                >
                  <FaTrash className="size-3.5 md:size-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
