import type { NoteItem, WorkspaceId } from "./types";
import { supabase } from "./supabase";

export type ItemRow = {
  id: string;
  user_id: string;
  workspace_id: string;
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

function uid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

export function rowToItem(row: ItemRow): NoteItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id as WorkspaceId,
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

async function requireUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw error ?? new Error("Não autenticado");
  return user;
}

export async function fetchItems(): Promise<NoteItem[]> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as ItemRow[]).map(rowToItem);
}

export async function createItem(input: {
  workspaceId: WorkspaceId;
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

export async function seedIfEmpty() {
  const items = await fetchItems();
  if (items.length > 0) return items;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(11, 0, 0, 0);

  await createItem({
    workspaceId: "anotacoes",
    type: "note",
    title: "Bem-vindo ao InkPad",
    content:
      "Seus dados agora ficam na nuvem (Supabase).\n\n• Notas, agenda e SQL sincronizam entre aparelhos\n• Entre com o mesmo e-mail no iPhone e no PC\n• Toque em + para criar",
    pinned: true,
  });

  await createItem({
    workspaceId: "sql",
    type: "sql",
    title: "Clientes ativos",
    content: `SELECT c.id, c.name, c.email, COUNT(o.id) AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE c.active = true
GROUP BY c.id, c.name, c.email
ORDER BY orders DESC
LIMIT 50;`,
    pinned: true,
  });

  await createItem({
    workspaceId: "agenda",
    type: "event",
    title: "Revisão semanal",
    content: "Revisar notas e queries da semana.",
    startsAt: tomorrow.toISOString(),
    endsAt: tomorrowEnd.toISOString(),
  });

  return fetchItems();
}
