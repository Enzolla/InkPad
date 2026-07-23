"use client";

import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Folder, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

export type TaxonomyFilter =
  | { kind: "all" }
  | { kind: "workspace"; workspaceId: string }
  | { kind: "folder"; workspaceId: string; folderId: string };

type Props = {
  workspaces: Workspace[];
  folders: Folder[];
  filter: TaxonomyFilter;
  onFilterChange: (f: TaxonomyFilter) => void;
  onCreateWorkspace: () => void;
  onCreateFolder: (workspaceId: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  chips?: boolean;
};

export function TaxonomyNav({
  workspaces,
  folders,
  filter,
  onFilterChange,
  onCreateWorkspace,
  onCreateFolder,
  onDeleteWorkspace,
  onDeleteFolder,
  chips,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const foldersByWs = useMemo(() => {
    const map = new Map<string, Folder[]>();
    for (const f of folders) {
      const list = map.get(f.workspaceId) ?? [];
      list.push(f);
      map.set(f.workspaceId, list);
    }
    return map;
  }, [folders]);

  if (chips) {
    return (
      <>
        <button
          type="button"
          onClick={() => onFilterChange({ kind: "all" })}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition duration-150",
            filter.kind === "all"
              ? "bg-ink text-white"
              : "bg-surface-2 text-muted hover:text-ink",
          )}
        >
          Todos
        </button>
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            type="button"
            onClick={() =>
              onFilterChange({ kind: "workspace", workspaceId: ws.id })
            }
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition duration-150",
              filter.kind !== "all" &&
                "workspaceId" in filter &&
                filter.workspaceId === ws.id &&
                filter.kind === "workspace"
                ? "bg-ink text-white"
                : filter.kind === "folder" && filter.workspaceId === ws.id
                  ? "bg-ink/80 text-white"
                  : "bg-surface-2 text-muted hover:text-ink",
            )}
          >
            {ws.name}
          </button>
        ))}
        <button
          type="button"
          onClick={onCreateWorkspace}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
          aria-label="Novo tipo"
        >
          <Plus size={14} strokeWidth={2.25} />
        </button>
      </>
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-0.5">
      <div className="mb-1 flex items-center justify-between px-3">
        <span className="text-[11px] font-semibold tracking-[0.04em] text-faint">
          Tipos
        </span>
        <button
          type="button"
          onClick={onCreateWorkspace}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-faint transition hover:bg-surface-2 hover:text-ink"
          aria-label="Novo tipo"
          title="Novo tipo"
        >
          <Plus size={14} strokeWidth={2.25} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onFilterChange({ kind: "all" })}
        className={cn(
          "flex items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] transition duration-150",
          filter.kind === "all"
            ? "bg-surface-2 font-medium text-ink"
            : "text-muted hover:bg-surface-2/80 hover:text-ink",
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-ink" />
        Todos
      </button>

      {workspaces.map((ws) => {
        const kids = foldersByWs.get(ws.id) ?? [];
        const isOpen = expanded[ws.id] ?? kids.length > 0;
        const wsActive =
          (filter.kind === "workspace" && filter.workspaceId === ws.id) ||
          (filter.kind === "folder" && filter.workspaceId === ws.id);

        return (
          <div key={ws.id} className="group/ws">
            <div
              className={cn(
                "flex items-center gap-0.5 rounded-[10px] transition duration-150",
                wsActive && filter.kind === "workspace"
                  ? "bg-surface-2"
                  : "hover:bg-surface-2/80",
              )}
            >
              <button
                type="button"
                className="inline-flex h-8 w-6 shrink-0 items-center justify-center text-faint"
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [ws.id]: !(prev[ws.id] ?? kids.length > 0),
                  }))
                }
                aria-label={isOpen ? "Recolher" : "Expandir"}
              >
                {kids.length > 0 ? (
                  isOpen ? (
                    <ChevronDown size={13} />
                  ) : (
                    <ChevronRight size={13} />
                  )
                ) : (
                  <span className="w-[13px]" />
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  onFilterChange({ kind: "workspace", workspaceId: ws.id })
                }
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 py-2 pr-1 text-left text-[13px]",
                  wsActive ? "font-medium text-ink" : "text-muted",
                )}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: ws.accent }}
                />
                <span className="truncate">{ws.name}</span>
              </button>
              <button
                type="button"
                onClick={() => onCreateFolder(ws.id)}
                className="mr-0.5 hidden h-7 w-7 items-center justify-center rounded-md text-faint transition hover:bg-bg hover:text-ink group-hover/ws:inline-flex"
                aria-label="Nova pasta"
                title="Nova pasta"
              >
                <FolderPlus size={13} />
              </button>
              {workspaces.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeleteWorkspace(ws.id)}
                  className="mr-1 hidden h-7 w-7 items-center justify-center rounded-md text-faint transition hover:bg-danger/10 hover:text-danger group-hover/ws:inline-flex"
                  aria-label="Excluir tipo"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            {isOpen && kids.length > 0 && (
              <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-2">
                {kids.map((folder) => {
                  const active =
                    filter.kind === "folder" && filter.folderId === folder.id;
                  return (
                    <div
                      key={folder.id}
                      className={cn(
                        "group/folder flex items-center rounded-[8px]",
                        active ? "bg-surface-2" : "hover:bg-surface-2/70",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onFilterChange({
                            kind: "folder",
                            workspaceId: ws.id,
                            folderId: folder.id,
                          })
                        }
                        className={cn(
                          "min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-[12.5px]",
                          active
                            ? "font-medium text-ink"
                            : "text-muted",
                        )}
                      >
                        {folder.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteFolder(folder.id)}
                        className="mr-1 hidden h-6 w-6 items-center justify-center rounded-md text-faint hover:text-danger group-hover/folder:inline-flex"
                        aria-label="Excluir pasta"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
