import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LockKeyhole, ShieldCheck, Sprout } from "lucide-react";
import agrivahMark from "@/assets/agrivah-mark.png.asset.json";

const TITLE = "Sign in — AgriGhar ATAP";
const DESCRIPTION =
  "Sign in to the AgriGhar ATAP console to review your organisations, roles, consent grants and audit trail.";

/** Where to continue after a successful sign-in; defaults to the console. */
function safeRedirect(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "/dashboard";
  // Only same-site absolute paths are accepted, never an external URL.
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: safeRedirect(search["redirect"]) } : {},
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const continueTo = Route.useSearch().redirect ?? "/dashboard";
  const navigate = useNavigate();
  const router = useRouter();
  const goOn = async () => {
    await router.invalidate();
    await navigate({ to: continueTo, replace: true });
  };
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void goOn();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continueTo]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setAwaitingConfirm(true);
          return;
        }
        await goOn();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await goOn();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth?redirect=${encodeURIComponent(continueTo)}`,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    await goOn();
  }

  return (
    <main className="app-canvas relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-6">
      <div className="relative w-full max-w-[460px]">
        <div className="relative z-10 overflow-hidden rounded-3xl border border-border bg-card/90 p-7 shadow-raised backdrop-blur-xl sm:p-10">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-accent to-primary" />
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Agrivah
          </Link>

          <div className="mb-8 mt-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-raised">
              <img
                src={agrivahMark.url}
                alt="Agrivah"
                width={490}
                height={480}
                className="h-12 w-auto"
              />
            </div>
            <p className="font-display text-xl font-bold text-primary">AGRIVAH</p>
            <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">
              Connect • Collaborate • Transform
            </p>
          </div>

          <h1 className="text-2xl font-bold">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {mode === "signin"
              ? "Access your secure farming workspace."
              : "Create your account, then complete your role profile."}
          </p>

          {awaitingConfirm ? (
            <p className="mt-6 rounded-md border border-border bg-secondary p-4 text-sm text-secondary-foreground">
              Check your email to confirm your address, then return here to sign in.
            </p>
          ) : (
            <>
              <form onSubmit={onSubmit} className="mt-7 space-y-5">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      maxLength={100}
                      required
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  <LockKeyhole /> {mode === "signin" ? "Enter workspace" : "Create account"}
                </Button>
              </form>

              <Button
                type="button"
                variant="outline"
                className="mt-3 h-11 w-full"
                onClick={onGoogle}
                disabled={busy}
              >
                Continue with Google
              </Button>

              <Button
                type="button"
                variant="link"
                className="mt-4 h-auto w-full"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin"
                  ? "No account yet? Create one"
                  : "Already have an account? Sign in"}
              </Button>
            </>
          )}
          <div className="mt-7 flex items-start gap-3 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Your information is private by default. Access is granted only for approved roles and
              purposes.
            </p>
          </div>
        </div>
        <div className="absolute -bottom-3 -right-3 h-full w-full rounded-3xl bg-primary/5" />
        <div className="absolute -bottom-6 -right-6 h-full w-full rounded-3xl bg-accent/5" />
      </div>
    </main>
  );
}
