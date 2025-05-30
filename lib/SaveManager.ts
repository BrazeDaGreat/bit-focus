import db from "./db";

type ExportedData = {
  localStorage: Record<string, string>;
  indexedDB: {
    configuration: {
      name: string;
      dob: string; // parsed from JSON as string
      webhook: string;
    }[];
    focus: {
      id?: number;
      tag: string;
      startTime: string;
      endTime: string;
    }[];
    tasks: {
      id?: number;
      task: string;
      subtasks: string[];
      duedate: string;
      tags: string[];
    }[];
    notes: {
      id?: number;
      title: string;
      type: "document" | "board";
      parentId?: number | null;
      content?: string;
      boardData?: { category: string; children: number[] }[];
      createdAt: string;
      updatedAt: string;
    }[];
  };
};

class SaveManager {
  static async exportData(): Promise<void> {
    const data: ExportedData = {
      localStorage: {},
      indexedDB: {
        configuration: (await db.configuration.toArray()).map((c) => ({
          ...c,
          dob: c.dob.toISOString(),
        })),
        focus: (await db.focus.toArray()).map((f) => ({
          ...f,
          startTime: f.startTime.toISOString(),
          endTime: f.endTime.toISOString(),
        })),
        tasks: (await db.tasks.toArray()).map((t) => ({
          ...t,
          duedate: t.duedate.toISOString(),
        })),
        notes: (await db.notes.toArray()).map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
          updatedAt: n.updatedAt.toISOString(),
        })),
      },
    };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        data.localStorage[key] = localStorage.getItem(key) || "";
      }
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `data-${new Date().toISOString()}.bitf.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static async importData(file: File): Promise<void> {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;

    // Type assertion — assume it's correct, or do additional validation
    const data = parsed as ExportedData;

    // Reconstruct dates
    const configuration = data.indexedDB.configuration.map((c) => ({
      ...c,
      dob: new Date(c.dob),
    }));

    const focus = data.indexedDB.focus.map((f) => ({
      ...f,
      startTime: new Date(f.startTime),
      endTime: new Date(f.endTime),
    }));

    const tasks = data.indexedDB.tasks.map((t) => ({
      ...t,
      duedate: new Date(t.duedate),
    }));

    const notes = data.indexedDB.notes.map((n) => ({
      ...n,
      createdAt: new Date(n.createdAt),
      updatedAt: new Date(n.updatedAt),
    }));

    await db.transaction(
      "rw",
      db.configuration,
      db.focus,
      db.tasks,
      db.notes,
      async () => {
        await db.configuration.clear();
        await db.focus.clear();
        await db.tasks.clear();
        await db.notes.clear();

        await db.configuration.bulkAdd(configuration);
        await db.focus.bulkAdd(focus);
        await db.tasks.bulkAdd(tasks);
        await db.notes.bulkAdd(notes);
      }
    );

    localStorage.clear();
    for (const [key, value] of Object.entries(data.localStorage)) {
      localStorage.setItem(key, value);
    }
  }
}

export default SaveManager;
