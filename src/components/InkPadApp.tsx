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
import {
  createItem,
  deleteItem,
  fetchItems,
  seedIfEmpty,
  togglePin,
  updateItem,
} from "@/lib/cloud";
import { supabase } from "@/lib/supabase";
import {
  TYPE_LABELS,
  WORKSPACES,
  type ItemType,
  type NoteItem,
  type WorkspaceId,
} from "@/lib/types";
import { cn, formatEventTime, formatRelative, highlightSql, previewText } from "@/lib/utils";

type Tab = "notes" | "agenda" | "sql";

const SETUP_SQL = `-- Cole no SQL Editor do Supabase e clique Run
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id text not null,
  type text not null check (type in ('note', 'sql', 'event')),
  title text not null default '',
  content text not null default '',
  pinned boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists items_user_updated_idx on public.items (user_id, updated_at desc);
alter table public.items enable row level security;
drop policy if exists "items_select_own" on public.items;
drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_update_own" on public.items;
drop policy if exists "items_delete_own" on public.items;
create policy "items_select_own" on public.items for select using (auth.uid() = user_id);
create policy "items_insert_own" on public.items for insert with check (auth.uid() = user_id);
create policy "items_update_own" on public.items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "items_delete_own" on public.items for delete using (auth.uid() = user_id);`;

const TAB_META: Record<
  Tab,
  { label: string; icon: typeof NotebookPen; workspace: WorkspaceId; type: ItemType }
> = {
  notes: { label: "Notas", icon: NotebookPen, workspace: "anotacoes", type: "note" },
  agenda: { label: "Agenda", icon: CalendarDays, workspace: "agenda", type: "event" },
  sql: { label: "SQL", icon: Code2, workspace: "sql", type: "sql" },
};

export default function InkPadApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<NoteItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("notes");
  const [workspaceFilter, setWorkspaceFilter] = useState<WorkspaceId | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  const refreshItems = useCallback(async () => {
    try {
      const list = await seedIfEmpty();
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
    refreshItems().finally(() => setReady(true));

    const channel = supabase
      .channel("items-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        () => {
          void refreshItems();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session, refreshItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (tab === "notes" && item.type === "sql") return false;
      if (tab === "sql" && item.type !== "sql") return false;
      if (tab === "agenda" && item.type !== "event") return false;
      if (workspaceFilter !== "all" && item.workspaceId !== workspaceFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q)
      );
    });
  }, [items, tab, workspaceFilter, query]);

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

  async function handleCreate() {
    const meta = TAB_META[tab];
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
      workspaceId:
        workspaceFilter !== "all"
          ? workspaceFilter
          : meta.type === "event"
            ? "agenda"
            : meta.type === "sql"
              ? "sql"
              : "anotacoes",
      type: meta.type,
      startsAt,
      endsAt,
    });
    setItems((prev) => [item, ...prev]);
    setSelectedId(item.id);
  }

  if (!authReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-pulse rounded-full bg-primary/20" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-pulse rounded-full bg-primary/20" />
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
              refreshItems().finally(() => setReady(true));
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
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col bg-bg md:min-h-dvh md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="px-5 pb-3 pt-[calc(1.25rem+var(--safe-top))]">
          <Brand />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
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
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  tab === key
                    ? "bg-primary text-white"
                    : "text-ink hover:bg-surface-2",
                )}
              >
                <Icon size={18} strokeWidth={2} />
                {meta.label}
              </button>
            );
          })}
          <div className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Tipos
          </div>
          <WorkspaceFilters
            value={workspaceFilter}
            onChange={setWorkspaceFilter}
          />
        </nav>
        <div className="border-t border-border p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs text-muted">
            <Cloud size={12} />
            Nuvem Supabase
          </div>
          <p className="mb-3 truncate text-xs text-ink">{session.user.email}</p>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink"
          >
            <LogOut size={12} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main column */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-20 border-b border-border bg-bg/90 px-4 backdrop-blur-md"
          style={{ paddingTop: "calc(0.75rem + var(--safe-top))" }}
        >
          <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
            <Brand />
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-[var(--shadow)]"
              aria-label="Criar"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="flex items-center gap-2 pb-3">
            {selected && (
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-surface-2 md:hidden"
                onClick={() => setSelectedId(null)}
                aria-label="Voltar"
              >
                <ChevronLeft size={22} />
              </button>
            )}
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
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
                className="h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-9 text-[15px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
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
              className="hidden h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[var(--shadow)] transition hover:opacity-95 md:inline-flex"
            >
              <Plus size={16} />
              Novo
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-3 md:hidden">
            <WorkspaceFilters
              value={workspaceFilter}
              onChange={setWorkspaceFilter}
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
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-md md:hidden"
          style={{ paddingBottom: "var(--safe-bottom)" }}
        >
          <div className="mx-auto grid h-16 max-w-lg grid-cols-3">
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
                    "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted",
                  )}
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                  {meta.label}
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
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <NotebookPen size={18} strokeWidth={2.2} />
      </div>
      <div>
        <div className="text-[17px] font-semibold tracking-tight text-ink">
          InkPad
        </div>
        <div className="text-[11px] text-muted">notas · agenda · sql</div>
      </div>
    </div>
  );
}

function WorkspaceFilters({
  value,
  onChange,
  chips,
}: {
  value: WorkspaceId | "all";
  onChange: (v: WorkspaceId | "all") => void;
  chips?: boolean;
}) {
  const options: Array<{ id: WorkspaceId | "all"; name: string; accent?: string }> = [
    { id: "all", name: "Todos" },
    ...WORKSPACES,
  ];

  if (chips) {
    return (
      <>
        {options.map((ws) => (
          <button
            key={ws.id}
            type="button"
            onClick={() => onChange(ws.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
              value === ws.id
                ? "bg-ink text-white"
                : "bg-surface-2 text-ink",
            )}
          >
            {ws.name}
          </button>
        ))}
      </>
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-0.5">
      {options.map((ws) => (
        <button
          key={ws.id}
          type="button"
          onClick={() => onChange(ws.id)}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
            value === ws.id ? "bg-surface-2 font-medium text-ink" : "text-muted hover:bg-surface-2/70 hover:text-ink",
          )}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background:
                ws.id === "all"
                  ? "var(--ink)"
                  : WORKSPACES.find((w) => w.id === ws.id)?.accent,
            }}
          />
          {ws.name}
        </button>
      ))}
    </div>
  );
}

function ItemList({
  items,
  selectedId,
  onSelect,
  emptyLabel,
}: {
  items: NoteItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div className="anim-fade-in px-6 py-16 text-center text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  const pinned = items.filter((i) => i.pinned);
  const rest = items.filter((i) => !i.pinned);

  return (
    <div className="anim-fade-up px-3 py-3">
      {pinned.length > 0 && (
        <SectionLabel icon={<Pin size={12} />} label="Fixadas" />
      )}
      {pinned.map((item, i) => (
        <ItemRow
          key={item.id}
          item={item}
          active={item.id === selectedId}
          onSelect={onSelect}
          style={{ animationDelay: `${i * 30}ms` }}
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
          style={{ animationDelay: `${(pinned.length + i) * 30}ms` }}
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
    <div className="mb-1 mt-2 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
      {icon}
      {label}
    </div>
  );
}

function ItemRow({
  item,
  active,
  onSelect,
  style,
}: {
  item: NoteItem;
  active: boolean;
  onSelect: (id: string) => void;
  style?: React.CSSProperties;
}) {
  const ws = WORKSPACES.find((w) => w.id === item.workspaceId);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      style={style}
      className={cn(
        "anim-fade-up mb-1 w-full rounded-2xl border px-3.5 py-3 text-left transition",
        active
          ? "border-primary/25 bg-primary-soft"
          : "border-transparent bg-transparent hover:bg-surface",
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="line-clamp-1 text-[15px] font-semibold tracking-tight text-ink">
          {item.title || "Sem título"}
        </h3>
        <span className="shrink-0 text-[11px] text-muted">
          {formatRelative(item.updatedAt)}
        </span>
      </div>
      <p className="line-clamp-2 font-mono text-[12px] leading-relaxed text-muted" style={item.type === "sql" ? undefined : { fontFamily: "inherit" }}>
        {item.type === "sql" ? previewText(item.content, 80) : previewText(item.content)}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            background: `color-mix(in oklch, ${ws?.accent ?? "var(--primary)"} 14%, white)`,
            color: ws?.accent ?? "var(--primary)",
          }}
        >
          {TYPE_LABELS[item.type]}
        </span>
        <span className="text-[11px] text-muted">{ws?.name}</span>
        {item.pinned && <Pin size={11} className="text-primary" />}
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
    <div className="anim-fade-up px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize tracking-tight">
          {format(monthCursor, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2"
            onClick={() => setMonthCursor(addDays(startOfMonth(monthCursor), -1))}
          >
            ‹
          </button>
          <button
            type="button"
            className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2"
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
            className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2"
            onClick={() => setMonthCursor(addDays(endOfMonth(monthCursor), 1))}
          >
            ›
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
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
                "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition",
                !inMonth && "text-muted/40",
                selected && "bg-primary font-semibold text-white",
                !selected && today && "bg-primary-soft font-semibold text-primary",
                !selected && !today && "hover:bg-surface-2",
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

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold capitalize text-ink">
          {format(selectedDay, "EEEE, d MMM", { locale: ptBR })}
        </h3>
        {dayEvents.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-6 text-sm text-muted">
            Nenhum compromisso neste dia.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {dayEvents.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => onSelect(ev.id)}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition",
                  selectedId === ev.id
                    ? "border-primary/25 bg-primary-soft"
                    : "border-border bg-surface hover:bg-surface-2",
                )}
              >
                <div className="flex items-center gap-2 text-xs font-medium text-muted">
                  <Clock3 size={12} />
                  {formatEventTime(ev)}
                </div>
                <div className="mt-1 text-[15px] font-semibold">{ev.title}</div>
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
  onChange,
  onDelete,
  onTogglePin,
}: {
  item: NoteItem;
  onChange: (patch: Partial<NoteItem>) => void | Promise<void>;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
    <div className="anim-fade-in mx-auto w-full max-w-2xl px-4 pt-4 md:px-8 md:pt-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TypeBadge type={item.type} />
        <select
          value={item.workspaceId}
          onChange={(e) =>
            onChange({ workspaceId: e.target.value as WorkspaceId })
          }
          className="h-9 rounded-lg border border-border bg-surface px-2 text-xs font-medium outline-none focus:border-primary"
        >
          {WORKSPACES.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={onTogglePin}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-lg transition",
              item.pinned ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2",
            )}
            aria-label="Fixar"
          >
            <Pin size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
            aria-label="Excluir"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {item.type === "event" && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted">
            Início
            <input
              type="datetime-local"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
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
          <label className="text-xs font-medium text-muted">
            Fim
            <input
              type="datetime-local"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
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
        className="mb-3 w-full bg-transparent text-[28px] font-semibold tracking-tight outline-none placeholder:text-muted/50"
      />

      {item.type === "sql" ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-[oklch(0.975_0.01_230)] shadow-[var(--shadow)]">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-accent">
              <Code2 size={14} /> SQL
            </span>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-muted hover:bg-white"
              onClick={() => navigator.clipboard.writeText(content)}
            >
              Copiar
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="min-h-[220px] w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-6 text-ink outline-none"
            placeholder="SELECT …"
          />
          {content.trim() && (
            <div className="border-t border-border bg-white/70 px-4 py-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
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
          className="min-h-[50vh] w-full resize-none bg-transparent text-[16px] leading-7 outline-none placeholder:text-muted/50"
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
    <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 text-xs font-semibold text-ink">
      <Icon size={14} />
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
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon size={24} />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{copy.title}</h2>
      <p className="mt-1 max-w-xs text-sm text-muted">{copy.body}</p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white"
      >
        <Plus size={16} />
        {copy.cta}
      </button>
      <div className="mt-10 flex items-center gap-2 text-xs text-muted">
        <UserRound size={12} />
        Separado por tipos · funciona no iPhone
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
