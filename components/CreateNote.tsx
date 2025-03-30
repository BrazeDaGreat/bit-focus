"use client";
import { useState } from "react";
import { useNotes } from "@/hooks/useNotes";

export default function CreateNote() {
  const { addNote, getChildNotes } = useNotes();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"document" | "board">("document");
  const [parentId, setParentId] = useState<number | null>(null);

  const handleAddNote = async () => {
    if (!title.trim()) return; // Prevent adding empty notes

    await addNote({ title, type, parentId, content: "" }); // Pass as an object
    setTitle(""); // Clear input after adding
  };

  return (
    <div className="p-2">
      <input
        type="text"
        placeholder="Note title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border p-2 w-full rounded"
      />

      <select
        value={type}
        onChange={(e) => setType(e.target.value as "document" | "board")}
        className="border p-2 w-full mt-2 rounded"
      >
        <option value="document">Document</option>
        <option value="board">Board</option>
      </select>

      <select
        value={parentId ?? ""}
        onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
        className="border p-2 w-full mt-2 rounded"
      >
        <option value="">No Parent</option>
        {getChildNotes(null).map((note) => (
          <option key={note.id} value={note.id}>
            {note.title}
          </option>
        ))}
      </select>

      <button
        onClick={handleAddNote}
        className="bg-blue-500 text-white p-2 w-full mt-2 rounded"
      >
        Create Note
      </button>
    </div>
  );
}
