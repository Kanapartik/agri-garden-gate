import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite } from "@/lib/atap/district.functions";
import { Button } from "@/components/ui/button";
import agrivahMark from "@/assets/agrivah-mark.png.asset.json";

export const Route = createFileRoute("/fpo-login")({
  validateSearch: z.object({ denied: z.coerce.number().optional() }),
  head: () => ({
    meta: [
      { title: "FPO Portal sign in — Agrivah" },
      { name: "description", content: "Sign in to the Agrivah FPO Portal to manage members, vouchers and performance." },
      { property: "og:title", content: "FPO Portal sign in — Agrivah" },
      { property: "og:description", content: "Separate sign-in for FPO administrators and staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FpoLogin,
});

function FpoLogin() {
  const { denied } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    denied ? "This account is not staff of any FPO. Farmers sign in on the farmer site." : null,
  );

  const accept = useServerFn(acceptInvite);
  const [inviteRef, setInviteRef] = useState("");

  async function acceptRef() {
    setBusy(true);
    setError(null);
    try {
      await accept({ data: { inviteId: inviteRef.trim() } });
      navigate({ to: "/fpo-portal" });
    } catch (e) {
      setError(e instanceof Error ? e.message.replaceAll("_", " ") : "Could not accept invitation");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) return setError(err.message);
    navigate({ to: "/fpo-portal" });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <form onSubmit={submit} className="panel w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-3">
          <img src={agrivahMark.url} alt="Agrivah logo" className="h-10 w-auto" />
          <div>
            <p className="font-display text-lg font-semibold text-primary">FPO Portal</p>
            <p className="text-xs text-muted-foreground">For FPO administrators and staff</p>
          </div>
        </div>
        <label className="block space-y-1 text-sm">
          <span>Email</span>
          <input type="email" required className="field-base" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Password</span>
          <input type="password" required className="field-base" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in to FPO Portal"}
        </Button>
        {denied ? (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Invited as FPO staff? Enter the invitation reference while signed in with the invited email.</p>
            <input className="field-base" placeholder="Invitation reference" value={inviteRef} onChange={(e) => setInviteRef(e.target.value)} />
            <Button type="button" variant="outline" className="w-full" disabled={!inviteRef || busy} onClick={acceptRef}>
              Accept invitation
            </Button>
          </div>
        ) : null}
        <p className="text-center text-xs text-muted-foreground">
          Farmer? <a href="/auth" className="underline">Use the farmer sign-in</a>
        </p>
      </form>
    </div>
  );
}
