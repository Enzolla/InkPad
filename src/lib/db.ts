import Dexie, { type EntityTable } from "dexie";
import type { NoteItem, WorkspaceId } from "./types";

const SEED_KEY = "inkpad-seeded-v1";

export class InkPadDB extends Dexie {
  items!: EntityTable<NoteItem, "id">;

  constructor() {
    super("inkpad");
    this.version(1).stores({
      items: "id, workspaceId, type, updatedAt, startsAt, pinned, title",
    });
  }
}

export const db = new InkPadDB();

function uid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

export async function ensureSeed() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_KEY)) return;

  const count = await db.items.count();
  if (count > 0) {
    localStorage.setItem(SEED_KEY, "1");
    return;
  }

  const t = now();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(11, 0, 0, 0);

  const seed: NoteItem[] = [
    {
      id: uid(),
      workspaceId: "anotacoes",
      type: "note",
      title: "Bem-vindo ao InkPad",
      content:
        "Seu bloco de notas com agenda e SQL.\n\n• Separe por tipos: Anotações, Pessoal, Agenda e SQL\n• Guarde queries com highlight\n• Marque compromissos na agenda\n• Funciona offline no iPhone (adicione à tela de início)\n\nToque em + para criar.",
      pinned: true,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: uid(),
      workspaceId: "sql",
      type: "sql",
      title: "Clientes ativos",
      content: `SELECT c.id, c.name, c.email, COUNT(o.id) AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE c.active = true
  AND c.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY c.id, c.name, c.email
ORDER BY orders DESC
LIMIT 50;`,
      pinned: true,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: uid(),
      workspaceId: "sql",
      type: "sql",
      title: "Vendas do mês",
      content: `SELECT
  date_trunc('day', created_at) AS day,
  SUM(total) AS revenue,
  COUNT(*) AS tickets
FROM sales
WHERE created_at >= date_trunc('month', CURRENT_DATE)
GROUP BY 1
ORDER BY 1;`,
      pinned: false,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: uid(),
      workspaceId: "agenda",
      type: "event",
      title: "Revisão semanal",
      content: "Revisar notas e queries da semana.",
      pinned: false,
      startsAt: tomorrow.toISOString(),
      endsAt: tomorrowEnd.toISOString(),
      allDay: false,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: uid(),
      workspaceId: "pessoal",
      type: "note",
      title: "Lista rápida",
      content: "- Ligar para o dentista\n- Comprar café\n- Backup do notebook",
      pinned: false,
      createdAt: t,
      updatedAt: t,
    },
  ];

  await db.items.bulkAdd(seed);
  localStorage.setItem(SEED_KEY, "1");
}

export async function createItem(input: {
  workspaceId: WorkspaceId;
  type: NoteItem["type"];
  title?: string;
  content?: string;
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
}) {
  const t = now();
  const item: NoteItem = {
    id: uid(),
    workspaceId: input.workspaceId,
    type: input.type,
    title: input.title?.trim() || (input.type === "sql" ? "Nova query" : input.type === "event" ? "Novo evento" : "Sem título"),
    content: input.content ?? (input.type === "sql" ? "SELECT " : ""),
    pinned: false,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: input.allDay,
    createdAt: t,
    updatedAt: t,
  };
  await db.items.add(item);
  return item;
}

export async function updateItem(id: string, patch: Partial<NoteItem>) {
  const { id: _ignore, createdAt: _c, ...rest } = patch;
  await db.items.update(id, { ...rest, updatedAt: now() });
}

export async function deleteItem(id: string) {
  await db.items.delete(id);
}

export async function togglePin(id: string) {
  const item = await db.items.get(id);
  if (!item) return;
  await db.items.update(id, { pinned: !item.pinned, updatedAt: now() });
}
