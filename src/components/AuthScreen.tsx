"use client";

import { FormEvent, useState } from "react";
import { NotebookPen } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        if (!data.session) {
          setMessage(
            "Conta criada. Se pedir confirmação, abra o e-mail e depois entre aqui.",
          );
        }
      }
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Falha na autenticação";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ink-wash flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="anim-fade-up w-full max-w-[400px]">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary text-white shadow-[var(--shadow)]">
            <NotebookPen size={22} strokeWidth={2.25} />
          </div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-ink">
            InkPad
          </h1>
          <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-muted">
            Notas, agenda e SQL — um bloco preciso na nuvem.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-[20px] border border-border bg-bg p-2 shadow-[var(--shadow-lg)]"
        >
          <div className="mb-1 grid grid-cols-2 gap-0.5 rounded-[14px] bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-[10px] py-2.5 text-[13px] font-semibold transition-colors duration-150 ${
                mode === "login"
                  ? "bg-bg text-ink shadow-[var(--shadow-sm)]"
                  : "text-muted hover:text-ink"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-[10px] py-2.5 text-[13px] font-semibold transition-colors duration-150 ${
                mode === "signup"
                  ? "bg-bg text-ink shadow-[var(--shadow-sm)]"
                  : "text-muted hover:text-ink"
              }`}
            >
              Criar conta
            </button>
          </div>

          <div className="space-y-3 px-3 pb-3 pt-4">
            <label className="block text-[12px] font-medium text-muted">
              E-mail
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-[12px] border border-border bg-surface px-3.5 text-[15px] text-ink outline-none transition focus:border-primary focus:bg-bg focus:ring-4 focus:ring-[var(--primary-ring)]"
                placeholder="voce@email.com"
              />
            </label>

            <label className="block text-[12px] font-medium text-muted">
              Senha
              <input
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-[12px] border border-border bg-surface px-3.5 text-[15px] text-ink outline-none transition focus:border-primary focus:bg-bg focus:ring-4 focus:ring-[var(--primary-ring)]"
                placeholder="mínimo 6 caracteres"
              />
            </label>

            {error && (
              <p className="rounded-[12px] bg-danger/8 px-3 py-2.5 text-[13px] text-danger">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-[12px] bg-accent-soft px-3 py-2.5 text-[13px] text-accent">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex h-12 w-full items-center justify-center rounded-[12px] bg-primary text-[14px] font-semibold text-white shadow-[var(--shadow-sm)] transition hover:brightness-[1.03] active:scale-[0.99] disabled:opacity-55"
            >
              {loading
                ? "Aguarde…"
                : mode === "login"
                  ? "Continuar"
                  : "Criar conta"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-[12px] leading-relaxed text-faint">
          Mesmo e-mail no iPhone e no computador.
          <br />
          Seus dados ficam protegidos por conta.
        </p>
      </div>
    </div>
  );
}
