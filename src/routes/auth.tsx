import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, LockKeyhole } from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { safeAdminRedirect } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  head: () => ({
    meta: [
      { title: "Entrar no painel · Barbearia Genario Souza" },
      { name: "description", content: "Acesso restrito à equipe da Barbearia Genario Souza." },
      { property: "og:title", content: "Entrar no painel · Barbearia Genario Souza" },
      { property: "og:description", content: "Acesso restrito à equipe da Barbearia Genario Souza." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const target = safeAdminRedirect(search.redirect);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ href: target, replace: true });
    });
  }, [navigate, target]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes("confirm")
          ? "Confirme seu e-mail antes de entrar."
          : "E-mail ou senha incorretos.",
      );
      return;
    }
    navigate({ href: target, replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex justify-center">
          <BrandMark />
        </Link>
        <form onSubmit={onSubmit} className="rounded-2xl border border-gold/30 bg-card p-7 shadow-card">
          <div className="mb-6 text-center">
            <LockKeyhole className="mx-auto size-8 text-gold" />
            <h1 className="mt-3 text-3xl font-semibold">Painel da barbearia</h1>
            <p className="mt-1 text-sm text-muted-foreground">Acesso restrito à equipe.</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="gold" size="xl" className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />} Entrar
            </Button>
          </div>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-gold">Voltar para a página de agendamento</Link>
        </p>
      </div>
    </div>
  );
}
