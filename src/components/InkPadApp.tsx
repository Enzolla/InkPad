"use client";

import type { Session } from "@supabase/supabase-js";
import {
  CalendarDays,
  Code2,
  Cloud,
  LogOut,
  NotebookPen,
  Pin,
  Search,
  Trash2,
  UserRound,
  X,
  Plus,
  ChevronLeft,
  Clock3,
} from "lucide-react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { useDialog } from "@/components/Dialog";
import {
  TaxonomyNav,
  type TaxonomyFilter,
} from "@/components/TaxonomyNav";
import {
  createFolder,
  createItem,
  createWorkspace,
  deleteFolder,
  deleteItem,
  deleteWorkspace,
  ensureTaxonomy,
  seedIfEmpty,
  togglePin,
  updateItem,
} from "@/lib/cloud";
import { supabase } from "@/lib/supabase";
import {
  TYPE_LABELS,
  type Folder,
  type ItemType,
  type NoteItem,
  type Workspace,
} from "@/lib/types";
import { cn, formatEventTime, formatRelative, highlightSql, previewText } from "@/lib/utils";

type Tab = "notes" | "agenda" | "sql";

const SETUP_SQL = `-- Cole no SQL Editor do Supabase e clique Run
alter table public.items add column if not exists folder_id text;
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  accent text not null default 'oklch(0.47 0.185 28)',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
alter table public.folders enable row level security;
drop policy if exists "workspaces_select_own" on public.workspaces;
drop policy if exists "workspaces_insert_own" on public.workspaces;
drop policy if exists "workspaces_update_own" on public.workspaces;
drop policy if exists "workspaces_delete_own" on public.workspaces;
create policy "workspaces_select_own" on public.workspaces for select using (auth.uid() = user_id);
create policy "workspaces_insert_own" on public.workspaces for insert with check (auth.uid() = user_id);
create policy "workspaces_update_own" on public.workspaces for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workspaces_delete_own" on public.workspaces for delete using (auth.uid() = user_id);
drop policy if exists "folders_select_own" on public.folders;
drop policy if exists "folders_insert_own" on public.folders;
drop policy if exists "folders_update_own" on public.folders;
drop policy if exists "folders_delete_own" on public.folders;
create policy "folders_select_own" on public.folders for select using (auth.uid() = user_id);
create policy "folders_insert_own" on public.folders for insert with check (auth.uid() = user_id);
create policy "folders_update_own" on public.folders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "folders_delete_own" on public.folders for delete using (auth.uid() = user_id);`;

const TAB_META: Record<
  Tab,
  { label: string; icon: typeof NotebookPen; type: ItemType }
> = {
  notes: { label: "Notas", icon: NotebookPen, type: "note" },
  agenda: { label: "Agenda", icon: CalendarDays, type: "event" },
  sql: { label: "SQL", icon: Code2, type: "sql" },
};

export default function InkPadApp() {
  const dialog = useDialog();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<NoteItem[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("notes");
  const [filter, setFilter] = useState<TaxonomyFilter>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  const refreshAll = useCallback(async () => {
    try {
      const tax = await ensureTaxonomy();
      setWorkspaces(tax.workspaces);
      setFolders(tax.folders);
      const list = await seedIfEmpty(tax.workspaces[0]?.id ?? "");
      setItems(list);
      setLoadError(null);
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : err instanceof Error
            ? err.message
            : "Erro ao carregar";
      if (
        message.includes("schema cache") ||
        message.includes("Could not find the table") ||
        message.includes("PGRST205")
      ) {
        setLoadError("MISSING_TABLE");
      } else {
        setLoadError(message || "Erro ao carregar");
      }
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setReady(false);
      setItems([]);
      return;
    }
    setReady(false);
    refreshAll().finally(() => setReady(true));

    const channel = supabase
      .channel("items-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        () => {
          void refreshAll();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session, refreshAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (tab === "notes" && item.type === "sql") return false;
      if (tab === "sql" && item.type !== "sql") return false;
      if (tab === "agenda" && item.type !== "event") return false;
      if (filter.kind === "workspace" && item.workspaceId !== filter.workspaceId)
        return false;
      if (filter.kind === "folder") {
        if (item.folderId !== filter.folderId) return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q)
      );
    });
  }, [items, tab, filter, query]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  const eventsForDay = useMemo(
    () =>
      items.filter(
        (i) =>
          i.type === "event" &&
          i.startsAt &&
          isSameDay(parseISO(i.startsAt), selectedDay),
      ),
    [items, selectedDay],
  );

  function resolveCreateTarget() {
    if (filter.kind === "folder") {
      return { workspaceId: filter.workspaceId, folderId: filter.folderId };
    }
    if (filter.kind === "workspace") {
      return { workspaceId: filter.workspaceId, folderId: undefined as string | undefined };
    }
    const byName = (n: string) =>
      workspaces.find((w) => w.name.toLowerCase() === n)?.id;
    const fallback =
      (tab === "sql" ? byName("sql") : null) ||
      (tab === "agenda" ? byName("agenda") : null) ||
      byName("anotações") ||
      workspaces[0]?.id;
    return { workspaceId: fallback ?? "", folderId: undefined as string | undefined };
  }

  async function handleCreate() {
    const meta = TAB_META[tab];
    const target = resolveCreateTarget();
    if (!target.workspaceId) return;

    let startsAt: string | undefined;
    let endsAt: string | undefined;
    if (meta.type === "event") {
      const start = new Date(selectedDay);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setHours(10, 0, 0, 0);
      startsAt = start.toISOString();
      endsAt = end.toISOString();
    }
    const item = await createItem({
      workspaceId: target.workspaceId,
      folderId: target.folderId,
      type: meta.type,
      startsAt,
      endsAt,
    });
    setItems((prev) => [item, ...prev]);
    setSelectedId(item.id);
  }

  async function handleCreateWorkspace() {
    const name = await dialog.prompt({
      title: "Novo tipo",
      description: "Organize notas, agenda e SQL em categorias.",
      placeholder: "Ex: Trabalho, Estudos…",
      confirmLabel: "Criar tipo",
    });
    if (!name) return;
    const ws = await createWorkspace(name);
    setWorkspaces((prev) => [...prev, ws]);
    setFilter({ kind: "workspace", workspaceId: ws.id });
  }

  async function handleCreateFolder(workspaceId: string) {
    const ws = workspaces.find((w) => w.id === workspaceId);
    const name = await dialog.prompt({
      title: "Nova subpasta",
      description: ws
        ? `Dentro de “${ws.name}”.`
        : "Crie uma pasta dentro do tipo.",
      placeholder: "Ex: Reuniões, Queries…",
      confirmLabel: "Criar pasta",
    });
    if (!name) return;
    const folder = await createFolder(workspaceId, name);
    setFolders((prev) => [...prev, folder]);
    setFilter({ kind: "folder", workspaceId, folderId: folder.id });
  }

  async function handleDeleteWorkspace(id: string) {
    const ws = workspaces.find((w) => w.id === id);
    const ok = await dialog.confirm({
      title: `Excluir “${ws?.name ?? "tipo"}”?`,
      description: "Os itens desse tipo vão para outro tipo. Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    await deleteWorkspace(id);
    await refreshAll();
    setFilter({ kind: "all" });
  }

  async function handleDeleteFolder(id: string) {
    const folder = folders.find((f) => f.id === id);
    const ok = await dialog.confirm({
      title: `Excluir pasta “${folder?.name ?? ""}”?`,
      description: "As notas da pasta ficam sem pasta, mas não são apagadas.",
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    await deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setItems((prev) =>
      prev.map((i) => (i.folderId === id ? { ...i, folderId: undefined } : i)),
    );
    if (filter.kind === "folder" && filter.folderId === id) {
      setFilter({ kind: "workspace", workspaceId: filter.workspaceId });
    }
  }

  if (!authReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="h-2 w-2 rounded-full bg-primary anim-pulse" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="h-2 w-2 rounded-full bg-primary anim-pulse" />
      </div>
    );
  }

  if (loadError) {
    const isMissingTable = loadError === "MISSING_TABLE";
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg px-6 py-10">
        <div className="w-full max-w-lg text-center">
          <Cloud className="mx-auto mb-3 text-primary" size={28} />
          <h1 className="text-lg font-semibold">Configuração da nuvem</h1>
          <p className="mt-2 text-sm text-muted">
            {isMissingTable
              ? "Falta criar a tabela no Supabase. Cole o SQL abaixo no SQL Editor e clique em Run."
              : loadError}
          </p>
          {isMissingTable && (
            <div className="mt-4 text-left">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted">schema.sql</span>
                <button
                  type="button"
                  className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink"
                  onClick={() =>
                    navigator.clipboard.writeText(SETUP_SQL)
                  }
                >
                  Copiar SQL
                </button>
              </div>
              <pre className="max-h-48 overflow-auto rounded-2xl border border-border bg-surface p-3 text-left font-mono text-[10px] leading-4 text-ink">
                {SETUP_SQL}
              </pre>
              <a
                href="https://supabase.com/dashboard/project/mshlcyogwcnkfehfjxmc/sql/new"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-semibold text-ink"
              >
                Abrir SQL Editor
              </a>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setReady(false);
              refreshAll().finally(() => setReady(true));
            }}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white"
          >
            Já rodei o SQL — tentar de novo
          </button>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="mt-3 block w-full text-sm text-muted"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col bg-bg md:min-h-dvh md:flex-row md:shadow-[var(--shadow-lg)] lg:my-0">
      {/* Desktop sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-border bg-panel md:flex">
        <div className="px-4 pb-4 pt-[calc(1.25rem+var(--safe-top))]">
          <Brand />
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
          {(Object.keys(TAB_META) as Tab[]).map((key) => {
            const meta = TAB_META[key];
            const Icon = meta.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  setSelectedId(null);
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[13px] font-medium transition-colors duration-150",
                  tab === key
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon size={17} strokeWidth={tab === key ? 2.35 : 2} />
                {meta.label}
              </button>
            );
          })}
          <TaxonomyNav
            workspaces={workspaces}
            folders={folders}
            filter={filter}
            onFilterChange={setFilter}
            onCreateWorkspace={handleCreateWorkspace}
            onCreateFolder={handleCreateFolder}
            onDeleteWorkspace={handleDeleteWorkspace}
            onDeleteFolder={handleDeleteFolder}
          />
        </nav>
        <div className="border-t border-border p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-faint">
            <Cloud size={11} />
            Nuvem
          </div>
          <p className="mb-3 truncate text-[12px] font-medium text-ink">
            {session.user.email}
          </p>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition hover:text-ink"
          >
            <LogOut size={12} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main column */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
        <header
          className="glass-bar sticky top-0 z-20 px-4"
          style={{ paddingTop: "calc(0.75rem + var(--safe-top))" }}
        >
          <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
            <Brand />
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-[var(--shadow)] transition active:scale-95"
              aria-label="Criar"
            >
              <Plus size={20} strokeWidth={2.25} />
            </button>
          </div>

          <div className="flex items-center gap-2 pb-3">
            {selected && (
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] text-ink transition hover:bg-surface-2 md:hidden"
                onClick={() => setSelectedId(null)}
                aria-label="Voltar"
              >
                <ChevronLeft size={22} />
              </button>
            )}
            <div className="relative min-w-0 flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tab === "sql"
                    ? "Buscar queries…"
                    : tab === "agenda"
                      ? "Buscar eventos…"
                      : "Buscar notas…"
                }
                className="h-11 w-full rounded-[12px] border border-border bg-surface pl-10 pr-9 text-[14px] outline-none transition focus:border-primary focus:bg-bg focus:ring-4 focus:ring-[var(--primary-ring)]"
              />
              {query && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-surface-2"
                  onClick={() => setQuery("")}
                  aria-label="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className="hidden h-11 items-center gap-2 rounded-[12px] bg-primary px-4 text-[13px] font-semibold text-white shadow-[var(--shadow-sm)] transition hover:brightness-[1.03] md:inline-flex"
            >
              <Plus size={15} strokeWidth={2.25} />
              Novo
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-3 md:hidden">
            <TaxonomyNav
              workspaces={workspaces}
              folders={folders}
              filter={filter}
              onFilterChange={setFilter}
              onCreateWorkspace={handleCreateWorkspace}
              onCreateFolder={handleCreateFolder}
              onDeleteWorkspace={handleDeleteWorkspace}
              onDeleteFolder={handleDeleteFolder}
              chips
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* List / Agenda */}
          <section
            className={cn(
              "scroll-touch w-full overflow-y-auto pb-[calc(var(--nav-h)+var(--safe-bottom)+1rem)] md:w-[380px] md:shrink-0 md:border-r md:border-border md:pb-6",
              selected && "hidden md:block",
            )}
          >
            {tab === "agenda" ? (
              <AgendaPanel
                monthCursor={monthCursor}
                setMonthCursor={setMonthCursor}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                events={items.filter((i) => i.type === "event")}
                dayEvents={eventsForDay}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <ItemList
                items={filtered}
                selectedId={selectedId}
                onSelect={setSelectedId}
                workspaces={workspaces}
                folders={folders}
                emptyLabel={
                  tab === "sql"
                    ? "Nenhuma query ainda. Guarde seu primeiro SQL."
                    : "Nenhuma nota ainda. Comece a escrever."
                }
              />
            )}
          </section>

          {/* Editor */}
          <section
            className={cn(
              "scroll-touch min-w-0 flex-1 overflow-y-auto pb-[calc(var(--nav-h)+var(--safe-bottom)+1rem)] md:pb-8",
              !selected && "hidden md:flex md:items-center md:justify-center",
            )}
          >
            {selected ? (
              <Editor
                item={selected}
                workspaces={workspaces}
                folders={folders}
                onChange={async (patch) => {
                  await updateItem(selected.id, patch);
                  setItems((prev) =>
                    prev
                      .map((i) =>
                        i.id === selected.id
                          ? { ...i, ...patch, updatedAt: new Date().toISOString() }
                          : i,
                      )
                      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
                  );
                }}
                onDelete={async () => {
                  await deleteItem(selected.id);
                  setItems((prev) => prev.filter((i) => i.id !== selected.id));
                  setSelectedId(null);
                }}
                onTogglePin={async () => {
                  await togglePin(selected.id, selected.pinned);
                  setItems((prev) =>
                    prev.map((i) =>
                      i.id === selected.id ? { ...i, pinned: !i.pinned } : i,
                    ),
                  );
                }}
              />
            ) : (
              <EmptyEditor onCreate={handleCreate} tab={tab} />
            )}
          </section>
        </div>

        {/* Mobile bottom nav */}
        <nav
          className="glass-bar fixed inset-x-0 bottom-0 z-30 border-t border-border md:hidden"
          style={{ paddingBottom: "var(--safe-bottom)" }}
        >
          <div className="mx-auto grid h-[60px] max-w-lg grid-cols-3">
            {(Object.keys(TAB_META) as Tab[]).map((key) => {
              const meta = TAB_META[key];
              const Icon = meta.icon;
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTab(key);
                    setSelectedId(null);
                  }}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide transition-colors duration-150",
                    active ? "text-primary" : "text-faint",
                  )}
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
                  {meta.label}
                  {active && (
                    <span className="absolute top-1.5 h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-white shadow-[var(--shadow-sm)]">
        <NotebookPen size={15} strokeWidth={2.4} />
      </div>
      <div>
        <div className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
          InkPad
        </div>
        <div className="text-[11px] tracking-wide text-faint">
          notas · agenda · sql
        </div>
      </div>
    </div>
  );
}

function ItemList({
  items,
  selectedId,
  onSelect,
  workspaces,
  folders,
  emptyLabel,
}: {
  items: NoteItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  workspaces: Workspace[];
  folders: Folder[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div className="anim-fade-in px-8 py-20 text-center">
        <p className="text-[14px] leading-relaxed text-muted">{emptyLabel}</p>
      </div>
    );
  }

  const pinned = items.filter((i) => i.pinned);
  const rest = items.filter((i) => !i.pinned);

  return (
    <div className="anim-fade-up px-2 py-2 md:px-3 md:py-3">
      {pinned.length > 0 && (
        <SectionLabel icon={<Pin size={11} />} label="Fixadas" />
      )}
      {pinned.map((item, i) => (
        <ItemRow
          key={item.id}
          item={item}
          active={item.id === selectedId}
          onSelect={onSelect}
          workspaces={workspaces}
          folders={folders}
          style={{ animationDelay: `${i * 24}ms` }}
        />
      ))}
      {rest.length > 0 && pinned.length > 0 && (
        <SectionLabel label="Recentes" />
      )}
      {rest.map((item, i) => (
        <ItemRow
          key={item.id}
          item={item}
          active={item.id === selectedId}
          onSelect={onSelect}
          workspaces={workspaces}
          folders={folders}
          style={{ animationDelay: `${(pinned.length + i) * 24}ms` }}
        />
      ))}
    </div>
  );
}

function SectionLabel({
  label,
  icon,
}: {
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-1.5 mt-3 flex items-center gap-1.5 px-3 text-[11px] font-semibold tracking-[0.04em] text-faint">
      {icon}
      {label}
    </div>
  );
}

function ItemRow({
  item,
  active,
  onSelect,
  workspaces,
  folders,
  style,
}: {
  item: NoteItem;
  active: boolean;
  onSelect: (id: string) => void;
  workspaces: Workspace[];
  folders: Folder[];
  style?: React.CSSProperties;
}) {
  const ws = workspaces.find((w) => w.id === item.workspaceId);
  const folder = folders.find((f) => f.id === item.folderId);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      style={style}
      className={cn(
        "anim-fade-up mb-0.5 w-full rounded-[14px] px-3.5 py-3 text-left transition duration-150",
        active
          ? "bg-primary-soft"
          : "bg-transparent hover:bg-surface",
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="line-clamp-1 text-[14px] font-semibold tracking-[-0.01em] text-ink">
          {item.title || "Sem título"}
        </h3>
        <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-faint">
          {formatRelative(item.updatedAt)}
        </span>
      </div>
      <p
        className={cn(
          "line-clamp-2 text-[12.5px] leading-relaxed text-muted",
          item.type === "sql" && "font-mono text-[12px]",
        )}
      >
        {item.type === "sql"
          ? previewText(item.content, 80)
          : previewText(item.content)}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
          style={{
            background: `color-mix(in oklch, ${ws?.accent ?? "var(--primary)"} 12%, white)`,
            color: ws?.accent ?? "var(--primary)",
          }}
        >
          {TYPE_LABELS[item.type]}
        </span>
        <span className="text-[11px] text-faint">
          {ws?.name ?? "Tipo"}
          {folder ? ` · ${folder.name}` : ""}
        </span>
        {item.pinned && <Pin size={11} className="ml-auto text-primary" />}
      </div>
    </button>
  );
}

function AgendaPanel({
  monthCursor,
  setMonthCursor,
  selectedDay,
  setSelectedDay,
  events,
  dayEvents,
  selectedId,
  onSelect,
}: {
  monthCursor: Date;
  setMonthCursor: (d: Date) => void;
  selectedDay: Date;
  setSelectedDay: (d: Date) => void;
  events: NoteItem[];
  dayEvents: NoteItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });

  function hasEvent(day: Date) {
    return events.some((e) => e.startsAt && isSameDay(parseISO(e.startsAt), day));
  }

  return (
    <div className="anim-fade-up px-4 py-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold capitalize tracking-[-0.02em] text-ink">
          {format(monthCursor, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <div className="flex gap-0.5 rounded-[10px] bg-surface-2 p-0.5">
          <button
            type="button"
            className="rounded-[8px] px-2.5 py-1.5 text-[13px] text-muted transition hover:bg-bg hover:text-ink"
            onClick={() => setMonthCursor(addDays(startOfMonth(monthCursor), -1))}
          >
            ‹
          </button>
          <button
            type="button"
            className="rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold text-muted transition hover:bg-bg hover:text-ink"
            onClick={() => {
              const today = new Date();
              setMonthCursor(today);
              setSelectedDay(today);
            }}
          >
            Hoje
          </button>
          <button
            type="button"
            className="rounded-[8px] px-2.5 py-1.5 text-[13px] text-muted transition hover:bg-bg hover:text-ink"
            onClick={() => setMonthCursor(addDays(endOfMonth(monthCursor), 1))}
          >
            ›
          </button>
        </div>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-wide text-faint">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <div key={`${d}-${i}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, monthCursor);
          const selected = isSameDay(day, selectedDay);
          const today = isSameDay(day, new Date());
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-[12px] text-[13px] transition duration-150",
                !inMonth && "text-faint/40",
                selected && "bg-primary font-semibold text-white shadow-[var(--shadow-sm)]",
                !selected && today && "bg-primary-soft font-semibold text-primary",
                !selected && !today && inMonth && "text-ink hover:bg-surface-2",
              )}
            >
              {format(day, "d")}
              {hasEvent(day) && (
                <span
                  className={cn(
                    "absolute bottom-1.5 h-1 w-1 rounded-full",
                    selected ? "bg-white" : "bg-primary",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-7">
        <h3 className="mb-3 text-[13px] font-semibold capitalize text-ink">
          {format(selectedDay, "EEEE, d MMM", { locale: ptBR })}
        </h3>
        {dayEvents.length === 0 ? (
          <p className="rounded-[16px] bg-surface px-4 py-7 text-[13px] text-muted">
            Nenhum compromisso neste dia.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {dayEvents.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => onSelect(ev.id)}
                className={cn(
                  "rounded-[14px] px-4 py-3.5 text-left transition duration-150",
                  selectedId === ev.id
                    ? "bg-primary-soft"
                    : "bg-surface hover:bg-surface-2",
                )}
              >
                <div className="flex items-center gap-2 text-[11px] font-medium text-faint">
                  <Clock3 size={12} />
                  {formatEventTime(ev)}
                </div>
                <div className="mt-1 text-[14px] font-semibold tracking-[-0.01em]">
                  {ev.title}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Editor({
  item,
  workspaces,
  folders,
  onChange,
  onDelete,
  onTogglePin,
}: {
  item: NoteItem;
  workspaces: Workspace[];
  folders: Folder[];
  onChange: (patch: Partial<NoteItem>) => void | Promise<void>;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const foldersForWs = folders.filter((f) => f.workspaceId === item.workspaceId);

  useEffect(() => {
    setTitle(item.title);
    setContent(item.content);
  }, [item.id]);

  useEffect(() => {
    if (title === item.title && content === item.content) return;
    const t = setTimeout(() => {
      void onChangeRef.current({ title, content });
    }, 320);
    return () => clearTimeout(t);
  }, [title, content, item.id, item.title, item.content]);

  return (
    <div className="anim-fade-in mx-auto w-full max-w-2xl px-5 pt-5 md:px-10 md:pt-10">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <TypeBadge type={item.type} />
        <select
          value={item.workspaceId}
          onChange={(e) =>
            onChange({
              workspaceId: e.target.value,
              folderId: undefined,
            })
          }
          className="h-9 rounded-[10px] border border-border bg-surface px-2.5 text-[12px] font-medium outline-none transition focus:border-primary focus:ring-4 focus:ring-[var(--primary-ring)]"
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>
        <select
          value={item.folderId ?? ""}
          onChange={(e) =>
            onChange({
              folderId: e.target.value || undefined,
            })
          }
          className="h-9 max-w-[160px] rounded-[10px] border border-border bg-surface px-2.5 text-[12px] font-medium outline-none transition focus:border-primary focus:ring-4 focus:ring-[var(--primary-ring)]"
        >
          <option value="">Sem pasta</option>
          {foldersForWs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={onTogglePin}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-[10px] transition duration-150",
              item.pinned
                ? "bg-primary-soft text-primary"
                : "text-faint hover:bg-surface-2 hover:text-ink",
            )}
            aria-label="Fixar"
          >
            <Pin size={15} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-faint transition hover:bg-danger/10 hover:text-danger"
            aria-label="Excluir"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {item.type === "event" && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <label className="text-[12px] font-medium text-muted">
            Início
            <input
              type="datetime-local"
              className="mt-1.5 h-11 w-full rounded-[12px] border border-border bg-surface px-3 text-[13px] outline-none focus:border-primary focus:ring-4 focus:ring-[var(--primary-ring)]"
              value={toLocalInput(item.startsAt)}
              onChange={(e) =>
                onChange({
                  startsAt: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : undefined,
                })
              }
            />
          </label>
          <label className="text-[12px] font-medium text-muted">
            Fim
            <input
              type="datetime-local"
              className="mt-1.5 h-11 w-full rounded-[12px] border border-border bg-surface px-3 text-[13px] outline-none focus:border-primary focus:ring-4 focus:ring-[var(--primary-ring)]"
              value={toLocalInput(item.endsAt)}
              onChange={(e) =>
                onChange({
                  endsAt: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : undefined,
                })
              }
            />
          </label>
        </div>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        className="mb-4 w-full bg-transparent text-[30px] font-semibold tracking-[-0.03em] outline-none placeholder:text-faint/70"
      />

      {item.type === "sql" ? (
        <div className="overflow-hidden rounded-[16px] border border-border bg-[oklch(0.985_0.008_230)] shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-accent">
              <Code2 size={14} /> SQL
            </span>
            <button
              type="button"
              className="rounded-[8px] px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-bg hover:text-ink"
              onClick={() => navigator.clipboard.writeText(content)}
            >
              Copiar
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="min-h-[240px] w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-6 text-ink outline-none"
            placeholder="SELECT …"
          />
          {content.trim() && (
            <div className="border-t border-border bg-bg/80 px-4 py-3.5">
              <div className="mb-2 text-[10px] font-semibold tracking-[0.06em] text-faint">
                Preview
              </div>
              <pre
                className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-ink"
                dangerouslySetInnerHTML={{ __html: highlightSql(content) }}
              />
            </div>
          )}
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva aqui…"
          className="min-h-[50vh] w-full resize-none bg-transparent text-[16px] leading-[1.7] outline-none placeholder:text-faint/70"
        />
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: ItemType }) {
  const icons = {
    note: NotebookPen,
    sql: Code2,
    event: CalendarDays,
  };
  const Icon = icons[type];
  return (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-surface-2 px-2.5 text-[12px] font-semibold text-ink">
      <Icon size={13} />
      {TYPE_LABELS[type]}
    </span>
  );
}

function EmptyEditor({ onCreate, tab }: { onCreate: () => void; tab: Tab }) {
  const copy = {
    notes: {
      title: "Escolha uma nota",
      body: "Ou crie uma nova para começar a escrever.",
      cta: "Nova nota",
      icon: NotebookPen,
    },
    agenda: {
      title: "Sua agenda",
      body: "Selecione um dia e adicione um compromisso.",
      cta: "Novo evento",
      icon: CalendarDays,
    },
    sql: {
      title: "Biblioteca SQL",
      body: "Guarde queries úteis com highlight e busca.",
      cta: "Nova query",
      icon: Code2,
    },
  }[tab];
  const Icon = copy.icon;

  return (
    <div className="anim-fade-in flex flex-col items-center px-6 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[16px] bg-primary text-white shadow-[var(--shadow)]">
        <Icon size={22} strokeWidth={2.2} />
      </div>
      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
        {copy.title}
      </h2>
      <p className="mt-1.5 max-w-[260px] text-[13px] leading-relaxed text-muted">
        {copy.body}
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-[12px] bg-primary px-5 text-[13px] font-semibold text-white shadow-[var(--shadow-sm)] transition hover:brightness-[1.03]"
      >
        <Plus size={15} strokeWidth={2.25} />
        {copy.cta}
      </button>
      <div className="mt-10 flex items-center gap-1.5 text-[11px] text-faint">
        <UserRound size={11} />
        Separado por tipos · otimizado para iPhone
      </div>
    </div>
  );
}

function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = parseISO(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
