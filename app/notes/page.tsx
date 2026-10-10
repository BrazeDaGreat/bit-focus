import { Suspense } from "react";
import { NotesWorkspace } from "@/components/notes/NotesWorkspace";
import { NotesSkeleton } from "@/components/notes/NotesSkeleton";

export default function NotesPage() {
  return (
    <Suspense fallback={<NotesSkeleton />}>
      <NotesWorkspace />
    </Suspense>
  );
}
