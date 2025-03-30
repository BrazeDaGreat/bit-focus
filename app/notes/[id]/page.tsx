"use client";
import { useEffect, useState } from "react";
import { useNotes, Note } from "@/hooks/useNotes";
import MarkdownEditor from "@/components/MarkdownEditor";
import { useParams } from "next/navigation";

export default function NotePage() {
  const params = useParams();
  const noteId = Number(params?.id);
  const { getNoteById, updateNote } = useNotes();
  const [note, setNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState<string>("");

  // useEffect(() => {
  //   const handler = setTimeout(() => {
  //     updateNote(noteId, { content: noteContent });
  //     console.log("Autosaved after delay");
  //   }, 3000); // Save after 3 seconds of inactivity
  
  //   return () => clearTimeout(handler); // Reset timer if content changes
  // }, [noteContent, noteId, updateNote]);

  useEffect(() => {
    const noteData = getNoteById(noteId);
    setNote(noteData ?? null); // ✅ Ensures we set a valid value
    setNoteContent(noteData?.content ?? "");
  }, [noteId, getNoteById]);

  if (!note) return <p>Loading...</p>; // ✅ Prevents rendering errors

  return (
    <div className="m-6 flex-1">
      {note.type === "document" && (
        <MarkdownEditor
          content={noteContent}
          setContent={setNoteContent}
          title={note.title}
        />
      )}
    </div>
  );
}
