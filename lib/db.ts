import Dexie from "dexie";

class BitFocusDB extends Dexie {
  configuration: Dexie.Table<
    { name: string; dob: Date; webhook: string },
    string
  >;
  focus: Dexie.Table<
    { id?: number; tag: string; startTime: Date; endTime: Date },
    number
  >;
  tasks: Dexie.Table<
    {
      id?: number;
      task: string;
      subtasks: string[];
      duedate: Date;
      tags: string[];
    },
    number
  >;
  notes: Dexie.Table<
    {
      id?: number;
      title: string;
      type: "document" | "board";
      parentId?: number | null;
      content?: string;
      boardData?: { category: string; children: number[] }[];
      createdAt: Date;
      updatedAt: Date;
    },
    number
  >;

  constructor() {
    super("BitFocusDB");

    this.version(1).stores({
      configuration: "name",
      focus: "++id, tag, startTime, endTime",
      tasks: "++id, task, duedate, tags",
      notes: "++id, title, type, parentId, createdAt, updatedAt",
    });

    this.configuration = this.table("configuration");
    this.focus = this.table("focus");
    this.tasks = this.table("tasks");
    this.notes = this.table("notes");
  }
}

const db = new BitFocusDB();
export default db;
