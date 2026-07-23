"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type PromptOptions = {
  title: string;
  description?: string;
  placeholder?: string;
  confirmLabel?: string;
  initialValue?: string;
};

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type DialogApi = {
  prompt: (opts: PromptOptions) => Promise<string | null>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

type ActiveDialog =
  | ({ kind: "prompt"; resolve: (v: string | null) => void } & PromptOptions)
  | ({ kind: "confirm"; resolve: (v: boolean) => void } & ConfirmOptions);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveDialog | null>(null);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setActive({ kind: "prompt", resolve, ...opts });
    });
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setActive({ kind: "confirm", resolve, ...opts });
    });
  }, []);

  function closePrompt(value: string | null) {
    if (active?.kind !== "prompt") return;
    active.resolve(value);
    setActive(null);
  }

  function closeConfirm(value: boolean) {
    if (active?.kind !== "confirm") return;
    active.resolve(value);
    setActive(null);
  }

  return (
    <DialogContext.Provider value={{ prompt, confirm }}>
      {children}
      {active?.kind === "prompt" && (
        <PromptModal
          title={active.title}
          description={active.description}
          placeholder={active.placeholder}
          confirmLabel={active.confirmLabel}
          initialValue={active.initialValue}
          onCancel={() => closePrompt(null)}
          onConfirm={(v) => closePrompt(v)}
        />
      )}
      {active?.kind === "confirm" && (
        <ConfirmModal
          title={active.title}
          description={active.description}
          confirmLabel={active.confirmLabel}
          cancelLabel={active.cancelLabel}
          danger={active.danger}
          onCancel={() => closeConfirm(false)}
          onConfirm={() => closeConfirm(true)}
        />
      )}
    </DialogContext.Provider>
  );
}

function ModalShell({
  children,
  onClose,
  labelledBy,
}: {
  children: ReactNode;
  onClose: () => void;
  labelledBy: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px] anim-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="anim-fade-up relative w-full max-w-[400px] rounded-[20px] border border-border bg-bg p-5 shadow-[var(--shadow-lg)]"
      >
        {children}
      </div>
    </div>
  );
}

function PromptModal({
  title,
  description,
  placeholder,
  confirmLabel = "Criar",
  initialValue = "",
  onCancel,
  onConfirm,
}: PromptOptions & {
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, []);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  return (
    <ModalShell onClose={onCancel} labelledBy={id}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id={id} className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-faint transition hover:bg-surface-2 hover:text-ink"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </div>

      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder={placeholder}
        className="h-12 w-full rounded-[12px] border border-border bg-surface px-3.5 text-[15px] text-ink outline-none transition focus:border-primary focus:bg-bg focus:ring-4 focus:ring-[var(--primary-ring)]"
      />

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-[12px] border border-border text-[13px] font-semibold text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className="h-11 flex-1 rounded-[12px] bg-primary text-[13px] font-semibold text-white shadow-[var(--shadow-sm)] transition hover:brightness-[1.03] disabled:opacity-45"
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger,
  onCancel,
  onConfirm,
}: ConfirmOptions & {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const id = useId();

  return (
    <ModalShell onClose={onCancel} labelledBy={id}>
      <h2 id={id} className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      {description && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{description}</p>
      )}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-[12px] border border-border text-[13px] font-semibold text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn(
            "h-11 flex-1 rounded-[12px] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)] transition hover:brightness-[1.03]",
            danger ? "bg-danger" : "bg-primary",
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
