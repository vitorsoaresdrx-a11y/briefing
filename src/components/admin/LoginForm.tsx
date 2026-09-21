"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const notAllowed = params.get("not-allowed") === "1";
  const configError = params.get("error") === "config";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Quem chegou aqui sem permissão teve a sessão encerrada.
  React.useEffect(() => {
    if (notAllowed) {
      void createClient().auth.signOut();
    }
  }, [notAllowed]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) {
        setError(
          signError.message.includes("Invalid login")
            ? "E-mail ou senha incorretos."
            : "Não foi possível entrar. Tente de novo.",
        );
        return;
      }
      router.push("/admin");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {notAllowed ? (
        <p role="alert" className="rounded-ctl border border-burgundy-glow bg-burgundy/20 p-4 text-sm">
          Este e-mail não tem acesso ao painel.
        </p>
      ) : null}
      {configError ? (
        <p role="alert" className="rounded-ctl border border-burgundy-glow bg-burgundy/20 p-4 text-sm">
          Painel sem configuração (Supabase/ADMIN_EMAILS). Confira o .env no servidor.
        </p>
      ) : null}
      <Input
        label="E-mail"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Senha"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error ? (
        <p role="alert" className="text-sm text-burgundy-glow">
          {error}
        </p>
      ) : null}
      <Button variant="primary" type="submit" disabled={loading}>
        {loading ? "Entrando…" : "Entrar no painel"}
      </Button>
    </form>
  );
}
