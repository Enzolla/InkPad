"use client";

import { NotebookPen } from "lucide-react";

export function LoadingScreen({
  message = "Sincronizando suas notas…",
}: {
  message?: string;
}) {
  return (
    <div className="ink-wash flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="anim-fade-up flex flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-primary text-white shadow-[var(--shadow)]">
            <NotebookPen size={24} strokeWidth={2.2} />
          </div>
          <span className="loader-ring" aria-hidden />
        </div>

        <div className="text-[18px] font-semibold tracking-[-0.03em] text-ink">
          InkPad
        </div>
        <p className="mt-2 text-[13px] text-muted">{message}</p>

        <div className="mt-8 flex w-40 flex-col gap-2">
          <div className="skeleton h-2 w-full rounded-full" />
          <div className="skeleton h-2 w-[72%] self-center rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function AppSkeleton() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1280px] bg-bg md:flex-row">
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-border bg-panel p-4 md:flex">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="skeleton h-8 w-8 rounded-[10px]" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 w-20 rounded-full" />
            <div className="skeleton h-2 w-28 rounded-full" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-10 w-full rounded-[12px]" />
          ))}
        </div>
        <div className="mt-8 space-y-2">
          <div className="skeleton h-2 w-12 rounded-full" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-8 w-full rounded-[10px]" />
          ))}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div
          className="border-b border-border px-4 pb-3"
          style={{ paddingTop: "calc(0.75rem + var(--safe-top))" }}
        >
          <div className="mb-3 flex items-center justify-between md:hidden">
            <div className="flex items-center gap-2.5">
              <div className="skeleton h-8 w-8 rounded-[10px]" />
              <div className="skeleton h-3 w-16 rounded-full" />
            </div>
            <div className="skeleton h-10 w-10 rounded-full" />
          </div>
          <div className="skeleton h-11 w-full rounded-[12px]" />
        </div>
        <div className="flex flex-1">
          <div className="w-full space-y-2 p-3 md:w-[380px] md:border-r md:border-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-[14px] bg-surface p-3.5">
                <div className="mb-2 flex justify-between">
                  <div className="skeleton h-3 w-28 rounded-full" />
                  <div className="skeleton h-2.5 w-10 rounded-full" />
                </div>
                <div className="skeleton mb-1.5 h-2.5 w-full rounded-full" />
                <div className="skeleton h-2.5 w-2/3 rounded-full" />
              </div>
            ))}
          </div>
          <div className="hidden flex-1 items-center justify-center p-8 md:flex">
            <div className="flex flex-col items-center gap-3">
              <div className="skeleton h-14 w-14 rounded-[16px]" />
              <div className="skeleton h-3 w-36 rounded-full" />
              <div className="skeleton h-2.5 w-48 rounded-full" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
