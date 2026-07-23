export type ItemType = "note" | "sql" | "event";

export interface Workspace {
  id: string;
  name: string;
  accent: string;
  sortOrder: number;
}

export interface Folder {
  id: string;
  workspaceId: string;
  name: string;
  sortOrder: number;
}

export interface NoteItem {
  id: string;
  workspaceId: string;
  folderId?: string;
  type: ItemType;
  title: string;
  content: string;
  pinned: boolean;
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const TYPE_LABELS: Record<ItemType, string> = {
  note: "Nota",
  sql: "SQL",
  event: "Evento",
};

export const ACCENT_PRESETS = [
  "oklch(0.47 0.185 28)",
  "oklch(0.52 0.13 320)",
  "oklch(0.52 0.11 160)",
  "oklch(0.46 0.11 230)",
  "oklch(0.55 0.14 55)",
  "oklch(0.5 0.12 280)",
  "oklch(0.48 0.1 200)",
  "oklch(0.45 0.08 145)",
];

export const DEFAULT_WORKSPACES: Array<{
  name: string;
  accent: string;
  legacyIds: string[];
}> = [
  { name: "Anotações", accent: "oklch(0.47 0.185 28)", legacyIds: ["anotacoes"] },
  { name: "Pessoal", accent: "oklch(0.52 0.13 320)", legacyIds: ["pessoal"] },
  { name: "Agenda", accent: "oklch(0.52 0.11 160)", legacyIds: ["agenda"] },
  { name: "SQL", accent: "oklch(0.46 0.11 230)", legacyIds: ["sql"] },
];
