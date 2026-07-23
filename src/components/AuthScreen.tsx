"use client";

import { FormEvent, useState } from "react";
import { Cloud, NotebookPen } from "lucide-react";
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
      setError(err instanceof Error ? err.message : "Falha na autenticação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="anim-fade-up w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <NotebookPen size={26} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">InkPad</h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
            <Cloud size={14} />
            Notas, agenda e SQL na nuvem
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow)]"
        >
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                mode === "login" ? "bg-white text-ink shadow-sm" : "text-muted"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-lg py-2 text-sm font-medium transition ${
                mode === "signup" ? "bg-white text-ink shadow-sm" : "text-muted"
              }`}
            >
              Criar conta
            </button>
          </div>

          <label className="mb-3 block text-xs font-medium text-muted">
            E-mail
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-border bg-bg px-3 text-[15px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="voce@email.com"
            />
          </label>

          <label className="mb-4 block text-xs font-medium text-muted">
            Senha
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-border bg-bg px-3 text-[15px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="mínimo 6 caracteres"
            />
          </label>

          {error && (
            <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          {message && (
            <p className="mb-3 rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading
              ? "Aguarde…"
              : mode === "login"
                ? "Entrar"
                : "Criar conta"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted">
          Seus dados ficam no Supabase, protegidos por conta.
          <br />
          Use o mesmo e-mail no iPhone e no computador.
        </p>
      </div>
    </div>
  );
}
