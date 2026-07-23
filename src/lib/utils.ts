import { clsx, type ClassValue } from "clsx";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { NoteItem } from "./types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatRelative(iso: string) {
  const d = parseISO(iso);
  const now = new Date();
  if (isSameDay(d, now)) return format(d, "HH:mm");
  return format(d, "d MMM", { locale: ptBR });
}

export function formatEventTime(item: NoteItem) {
  if (!item.startsAt) return "";
  const start = parseISO(item.startsAt);
  if (item.allDay) return "Dia todo";
  const startLabel = format(start, "HH:mm");
  if (!item.endsAt) return startLabel;
  return `${startLabel}–${format(parseISO(item.endsAt), "HH:mm")}`;
}

export function previewText(content: string, max = 96) {
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
}

/** Lightweight SQL keyword highlighter for display */
export function highlightSql(sql: string) {
  const keywords =
    /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|ON|AND|OR|NOT|IN|AS|GROUP|BY|ORDER|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|VIEW|WITH|CASE|WHEN|THEN|ELSE|END|DISTINCT|HAVING|UNION|ALL|EXISTS|BETWEEN|LIKE|IS|NULL|TRUE|FALSE|COUNT|SUM|AVG|MIN|MAX|COALESCE|CAST|INTERVAL|CURRENT_DATE|DATE_TRUNC)\b/gi;

  const escaped = sql
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .replace(/(--.*)$/gm, '<span class="sql-comment">$1</span>')
    .replace(/('(?:[^']|'')*')/g, '<span class="sql-string">$1</span>')
    .replace(keywords, '<span class="sql-kw">$&</span>');
}
