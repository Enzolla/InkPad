import {
  ACCENT_PRESETS,
  DEFAULT_WORKSPACES,
  type Folder,
  type NoteItem,
  type Workspace,
} from "./types";
import { supabase } from "./supabase";

export type ItemRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  folder_id: string | null;
  type: NoteItem["type"];
  title: string;
  content: string;
  pinned: boolean;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  created_at: string;
  updated_at: string;
};

type WorkspaceRow = {
  id: string;
  user_id: string;
  name: string;
  accent: string;
  sort_order: number;
};

type FolderRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  sort_order: number;
};

function uid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

export function rowToItem(row: ItemRow): NoteItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    folderId: row.folder_id ?? undefined,
    type: row.type,
    title: row.title,
    content: row.content,
    pinned: row.pinned,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    allDay: row.all_day,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    accent: row.accent,
    sortOrder: row.sort_order,
  };
}

function rowToFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    sortOrder: row.sort_order,
  };
}

async function requireUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw error ?? new Error("Não autenticado");
  return user;
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as WorkspaceRow[]).map(rowToWorkspace);
}

export async function fetchFolders(): Promise<Folder[]> {
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as FolderRow[]).map(rowToFolder);
}

export async function fetchItems(): Promise<NoteItem[]> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as ItemRow[]).map(rowToItem);
}

export async function createWorkspace(name: string, accent?: string) {
  const user = await requireUser();
  const existing = await fetchWorkspaces();
  const row = {
    id: uid(),
    user_id: user.id,
    name: name.trim() || "Novo tipo",
    accent: accent ?? ACCENT_PRESETS[existing.length % ACCENT_PRESETS.length],
    sort_order: existing.length,
  };
  const { data, error } = await supabase
    .from("workspaces")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return rowToWorkspace(data as WorkspaceRow);
}

export async function renameWorkspace(id: string, name: string) {
  const { error } = await supabase
    .from("workspaces")
    .update({ name: name.trim() || "Sem nome" })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteWorkspace(id: string) {
  const others = (await fetchWorkspaces()).filter((w) => w.id !== id);

  if (others[0]) {
    const { error: moveErr } = await supabase
      .from("items")
      .update({ workspace_id: others[0].id, folder_id: null })
      .eq("workspace_id", id);
    if (moveErr) throw moveErr;
  } else {
    const { error: delItems } = await supabase
      .from("items")
      .delete()
      .eq("workspace_id", id);
    if (delItems) throw delItems;
  }

  const { error: folderErr } = await supabase
    .from("folders")
    .delete()
    .eq("workspace_id", id);
  if (folderErr) throw folderErr;

  const { error } = await supabase.from("workspaces").delete().eq("id", id);
  if (error) throw error;
}

export async function createFolder(workspaceId: string, name: string) {
  const user = await requireUser();
  const existing = (await fetchFolders()).filter(
    (f) => f.workspaceId === workspaceId,
  );
  const row = {
    id: uid(),
    user_id: user.id,
    workspace_id: workspaceId,
    name: name.trim() || "Nova pasta",
    sort_order: existing.length,
  };
  const { data, error } = await supabase
    .from("folders")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return rowToFolder(data as FolderRow);
}

export async function renameFolder(id: string, name: string) {
  const { error } = await supabase
    .from("folders")
    .update({ name: name.trim() || "Sem nome" })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(id: string) {
  const { error: itemsErr } = await supabase
    .from("items")
    .update({ folder_id: null })
    .eq("folder_id", id);
  if (itemsErr) throw itemsErr;

  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) throw error;
}

export async function createItem(input: {
  workspaceId: string;
  folderId?: string;
  type: NoteItem["type"];
  title?: string;
  content?: string;
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
  pinned?: boolean;
}) {
  const user = await requireUser();
  const t = now();
  const row = {
    id: uid(),
    user_id: user.id,
    workspace_id: input.workspaceId,
    folder_id: input.folderId ?? null,
    type: input.type,
    title:
      input.title?.trim() ||
      (input.type === "sql"
        ? "Nova query"
        : input.type === "event"
          ? "Novo evento"
          : "Sem título"),
    content: input.content ?? (input.type === "sql" ? "SELECT " : ""),
    pinned: input.pinned ?? false,
    starts_at: input.startsAt ?? null,
    ends_at: input.endsAt ?? null,
    all_day: input.allDay ?? false,
    created_at: t,
    updated_at: t,
  };

  const { data, error } = await supabase
    .from("items")
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;
  return rowToItem(data as ItemRow);
}

export async function updateItem(id: string, patch: Partial<NoteItem>) {
  const payload: Partial<ItemRow> & { updated_at: string } = {
    updated_at: now(),
  };

  if (patch.workspaceId !== undefined) payload.workspace_id = patch.workspaceId;
  if ("folderId" in patch) payload.folder_id = patch.folderId ?? null;
  if (patch.type !== undefined) payload.type = patch.type;
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.content !== undefined) payload.content = patch.content;
  if (patch.pinned !== undefined) payload.pinned = patch.pinned;
  if (patch.startsAt !== undefined) payload.starts_at = patch.startsAt ?? null;
  if (patch.endsAt !== undefined) payload.ends_at = patch.endsAt ?? null;
  if (patch.allDay !== undefined) payload.all_day = patch.allDay;

  const { error } = await supabase.from("items").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}

export async function togglePin(id: string, pinned: boolean) {
  await updateItem(id, { pinned: !pinned });
}

/** Ensure default tipos exist and remap legacy slug workspace_ids */
export async function ensureTaxonomy() {
  let workspaces = await fetchWorkspaces();
  const folders = await fetchFolders();

  if (workspaces.length === 0) {
    const user = await requireUser();
    const rows = DEFAULT_WORKSPACES.map((ws, i) => ({
      id: uid(),
      user_id: user.id,
      name: ws.name,
      accent: ws.accent,
      sort_order: i,
    }));
    const { data, error } = await supabase
      .from("workspaces")
      .insert(rows)
      .select("*");
    if (error) throw error;
    workspaces = (data as WorkspaceRow[]).map(rowToWorkspace);
  }

  // Remap legacy slug IDs on items → real workspace UUIDs
  const items = await fetchItems();
  const known = new Set(workspaces.map((w) => w.id));
  const legacyMap = new Map<string, string>();
  for (const def of DEFAULT_WORKSPACES) {
    const match = workspaces.find(
      (w) => w.name.toLowerCase() === def.name.toLowerCase(),
    );
    if (!match) continue;
    for (const legacy of def.legacyIds) legacyMap.set(legacy, match.id);
  }

  for (const item of items) {
    if (known.has(item.workspaceId)) continue;
    const mapped = legacyMap.get(item.workspaceId) ?? workspaces[0]?.id;
    if (!mapped) continue;
    await updateItem(item.id, {
      workspaceId: mapped,
      folderId: undefined,
    });
  }

  return {
    workspaces: await fetchWorkspaces(),
    folders: await fetchFolders().catch(() => folders),
    items: await fetchItems(),
  };
}

export async function seedIfEmpty(defaultWorkspaceId: string) {
  const items = await fetchItems();
  if (items.length > 0) return items;

  const workspaces = await fetchWorkspaces();
  const sqlWs =
    workspaces.find((w) => w.name.toLowerCase() === "sql")?.id ??
    defaultWorkspaceId;
  const agendaWs =
    workspaces.find((w) => w.name.toLowerCase() === "agenda")?.id ??
    defaultWorkspaceId;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(11, 0, 0, 0);

  await createItem({
    workspaceId: defaultWorkspaceId,
    type: "note",
    title: "Bem-vindo ao InkPad",
    content:
      "Crie tipos e subpastas na barra lateral.\n\n• Tipos organizam suas notas\n• Pastas ficam dentro de cada tipo\n• Tudo sincroniza na nuvem",
    pinned: true,
  });

  await createItem({
    workspaceId: sqlWs,
    type: "sql",
    title: "Clientes ativos",
    content: `SELECT c.id, c.name, c.email
FROM customers c
WHERE c.active = true
ORDER BY c.name
LIMIT 50;`,
    pinned: true,
  });

  await createItem({
    workspaceId: agendaWs,
    type: "event",
    title: "Revisão semanal",
    content: "Revisar notas e queries da semana.",
    startsAt: tomorrow.toISOString(),
    endsAt: tomorrowEnd.toISOString(),
  });

  return fetchItems();
}
