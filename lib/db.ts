import Dexie from "dexie";

class BitFocusDB extends Dexie {
  configuration: Dexie.Table<{ name: string; dob: Date }, string>;
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

  constructor() {
    super("BitFocusDB");

    this.version(1).stores({
      configuration: "name",
      focus: "++id, tag, startTime, endTime",
      tasks: "++id, task, duedate, tags",
    });

    this.configuration = this.table("configuration");
    this.focus = this.table("focus");
    this.tasks = this.table("tasks");
  }
}

const db = new BitFocusDB();
export default db;
