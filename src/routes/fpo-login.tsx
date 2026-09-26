import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite } from "@/lib/atap/district.functions";
import { Button } from "@/components/ui/button";
import agrivahMark from "@/assets/agrivah-mark.png.asset.json";
import { LanguageSwitcher, useLanguage } from "@/components/atap/LanguageProvider";

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
  const { t } = useLanguage();
  const { denied } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    denied ? "not_staff" : null,
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
      setError(e instanceof Error ? e.message.replaceAll("_", " ") : "invite_failed");
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
      <div className="absolute right-4 top-4"><LanguageSwitcher /></div>
      <form onSubmit={submit} className="panel w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-3">
          <img src={agrivahMark.url} alt="Agrivah logo" className="h-10 w-auto" />
          <div>
             <p className="font-display text-lg font-semibold text-primary">{t("fpo.portal.title")}</p>
             <p className="text-xs text-muted-foreground">{t("fpo.portal.forStaff")}</p>
          </div>
        </div>
        <label className="block space-y-1 text-sm">
           <span>{t("fpo.portal.email")}</span>
          <input type="email" required className="field-base" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block space-y-1 text-sm">
           <span>{t("fpo.portal.password")}</span>
          <input type="password" required className="field-base" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
         {error ? <p className="text-sm text-destructive">{error === "not_staff" ? t("fpo.portal.notStaff") : error === "invite_failed" ? t("fpo.portal.inviteFailed") : error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
           {busy ? t("fpo.portal.signingIn") : t("fpo.portal.signIn")}
        </Button>
        {denied ? (
          <div className="space-y-2 border-t border-border pt-3">
             <p className="text-xs text-muted-foreground">{t("fpo.portal.inviteHelp")}</p>
             <input className="field-base" placeholder={t("fpo.portal.inviteRef")} value={inviteRef} onChange={(e) => setInviteRef(e.target.value)} />
            <Button type="button" variant="outline" className="w-full" disabled={!inviteRef || busy} onClick={acceptRef}>
               {t("fpo.portal.acceptInvite")}
            </Button>
          </div>
        ) : null}
        <p className="text-center text-xs text-muted-foreground">
           {t("fpo.portal.farmerQuestion")} <a href="/auth" className="underline">{t("fpo.portal.farmerSignIn")}</a>
        </p>
      </form>
    </div>
  );
}
