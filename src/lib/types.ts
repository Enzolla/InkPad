export type ItemType = "note" | "sql" | "event";

export type WorkspaceId =
  | "anotacoes"
  | "agenda"
  | "sql"
  | "pessoal";

export interface Workspace {
  id: WorkspaceId;
  name: string;
  description: string;
  accent: string;
}

export interface NoteItem {
  id: string;
  workspaceId: WorkspaceId;
  type: ItemType;
  title: string;
  content: string;
  pinned: boolean;
  /** ISO datetime — used by agenda events */
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ViewMode = "inbox" | "agenda" | "editor";

export const WORKSPACES: Workspace[] = [
  {
    id: "anotacoes",
    name: "Anotações",
    description: "Ideias, rascunhos e texto livre",
    accent: "var(--ws-notes)",
  },
  {
    id: "pessoal",
    name: "Pessoal",
    description: "Agenda e notas da vida pessoal",
    accent: "var(--ws-personal)",
  },
  {
    id: "agenda",
    name: "Agenda",
    description: "Compromissos e lembretes",
    accent: "var(--ws-agenda)",
  },
  {
    id: "sql",
    name: "SQL",
    description: "Queries e snippets guardados",
    accent: "var(--ws-sql)",
  },
];

export const TYPE_LABELS: Record<ItemType, string> = {
  note: "Nota",
  sql: "SQL",
  event: "Evento",
};
