import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { MyFarmerQr } from "@/components/atap/farmer/MyFarmerQr";
import { useLanguage } from "@/components/atap/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  getProfileWorkspace,
  registerDocument,
  saveProfile,
  setProfilePhoto,
  type ProfileInput,
} from "@/lib/atap/profile.functions";
import {
  DOC_KINDS,
  OWNERSHIP_TYPES,
  SOCIAL_CATEGORIES,
  deriveAge,
  maskAccount,
  type DocKind,
} from "@/lib/atap/profile";

const TITLE = "My farmer profile — AgriGhar ATAP";
const DESCRIPTION =
  "Capture your photograph, age, social category, land ownership, extent, location and passbook details — or photograph a document and let AgriGhar read it for you.";

export const Route = createFileRoute("/_authenticated/profile")({
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
  component: ProfilePage,
  errorComponent: ProfileError,
});

function ProfileError() {
  const { t } = useLanguage();
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-sm text-muted-foreground">{t("pf.loadError")}</main>
  );
}

const DOC_LABEL: Record<DocKind, string> = {
  photo: "Photograph",
  bank_passbook: "Bank passbook",
  land_record: "Land record / pattadar passbook",
  id_proof: "Identity proof",
  other: "Other document",
};

const CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  obc: "OBC / BC",
  sc: "SC",
  st: "ST",
  ews: "EWS",
  not_disclosed: "Prefer not to say",
};

const OWNERSHIP_LABEL: Record<string, string> = {
  owner: "Owner",
  leased: "Leased / tenant",
  share_cropped: "Share cropped",
  mixed: "Owned + leased",
  landless: "Landless",
};

type FormState = ProfileInput & { bank_account_number?: string | null };

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

function ProfilePage() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const fetchWorkspace = useServerFn(getProfileWorkspace);
  const save = useServerFn(saveProfile);
  const register = useServerFn(registerDocument);
  const savePhoto = useServerFn(setProfilePhoto);

  const workspace = useQuery({
    queryKey: ["atap", "profile-workspace"],
    queryFn: () => fetchWorkspace(),
  });

  const [form, setForm] = useState<FormState>({});
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [docKind, setDocKind] = useState<DocKind>("bank_passbook");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const p = workspace.data?.profile;
    if (!p) return;
    setForm({
      full_name: p.full_name,
      date_of_birth: p.date_of_birth,
      gender: p.gender,
      social_category: p.social_category,
      ownership_type: p.ownership_type,
      total_extent_acres: p.total_extent_acres,
      irrigation_source: p.irrigation_source,
      state_geography_id: p.state_geography_id,
      district_geography_id: p.district_geography_id,
      village_code: p.village_code,
      bank_account_holder: p.bank_account_holder,
      bank_name: p.bank_name,
      bank_branch: p.bank_branch,
      bank_ifsc: p.bank_ifsc,
    });
  }, [workspace.data?.profile]);

  const saveMutation = useMutation({
    mutationFn: (input: FormState) => save({ data: { ...input, confirmedFields: confirmed } }),
    onSuccess: async () => {
      toast.success(t("pf.saved"));
      setConfirmed([]);
      await queryClient.invalidateQueries({ queryKey: ["atap", "profile-workspace"] });
      await queryClient.invalidateQueries({ queryKey: ["atap", "scheme-discovery"] });
    },
    onError: () => toast.error(t("pf.saveFailed")),
  });

  const data = workspace.data;
  const states = (data?.geographies ?? []).filter((g) => g.level === "state");
  const districts = (data?.geographies ?? []).filter(
    (g) => g.level === "district" && (!form.state_geography_id || g.parent_id === form.state_geography_id),
  );
  const age = deriveAge(form.date_of_birth ?? null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function upload(file: File, kind: DocKind) {
    if (!data) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${data.userId}/${kind}-${Date.now()}.${ext.replace(/[^a-z0-9]/gi, "").slice(0, 5)}`;
      const { error } = await supabase.storage.from("farmer-documents").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;

      if (kind === "photo") {
        await savePhoto({ data: { storagePath: path } });
        toast.success(t("pf.photoSaved"));
      } else {
        const dataUrl = await toDataUrl(file);
        const result = await register({
          data: { docKind: kind, storagePath: path, mimeType: file.type, dataUrl },
        });
        if (result.extractionError) {
          toast.message(t("pf.readFailed"));
        } else if (result.suggestions.length === 0) {
          toast.message(t("pf.nothingRead"));
        } else {
          toast.success(`${result.suggestions.length} ${t("pf.fieldsRead")}`);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["atap", "profile-workspace"] });
    } catch {
      toast.error(t("pf.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  function applySuggestion(field: string, value: string | number) {
    const map: Record<string, keyof FormState> = {
      bank_account_holder: "bank_account_holder",
      bank_name: "bank_name",
      bank_branch: "bank_branch",
      bank_ifsc: "bank_ifsc",
      bank_account_number: "bank_account_number",
      full_name: "full_name",
      date_of_birth: "date_of_birth",
      total_extent_acres: "total_extent_acres",
      village_code: "village_code",
      ownership_type: "ownership_type",
    };
    const target = map[field];
    if (!target) {
      toast.message(t("pf.keptOnDoc"));
      return;
    }
    set(target, value as never);
    setConfirmed((prev) => (prev.includes(String(target)) ? prev : [...prev, String(target)]));
    toast.success(t("pf.applied"));
  }

  if (workspace.isLoading) {
    return <main className="mx-auto max-w-5xl px-6 py-12 text-sm text-muted-foreground">{t("common.loading")}</main>;
  }
  if (workspace.isError || !data) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12 text-sm text-field-invalid">
        {t("pf.loadErrorShort")}
      </main>
    );
  }

  const completeness = data.completeness;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <PageHeader
        eyebrow={t("pf.eyebrow")}
        title={t("pf.title")}
        description={t("pf.description")}
      />

      <MyFarmerQr />


      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("pf.completeness")}
            </h2>
            <p className="mt-1 text-2xl font-semibold">{completeness.score}%</p>
          </div>
          <Badge variant={completeness.schemeReady ? "secondary" : "destructive"}>
            {completeness.schemeReady ? t("pf.schemeReady") : t("pf.schemeIncomplete")}
          </Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {completeness.fields.map((f) => (
            <Badge key={String(f.field)} variant={f.done ? "secondary" : "outline"}>
              {f.done ? "✓" : "•"} {f.label}
              {f.required && !f.done ? ` ${t("pf.required")}` : ""}
            </Badge>
          ))}
        </div>
        {completeness.schemeReady ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("pf.prefillNote")}{" "}
            <Link to="/discovery" className="underline">
              {t("pf.browseSchemes")}
            </Link>
            .
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("pf.missing")}: {completeness.missingRequired.join(", ")}. {t("pf.missingHelp")}
          </p>
        )}
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("pf.docsTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("pf.docsHelp")}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="photo">{t("pf.photo")}</Label>
            <Input
              id="photo"
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file, "photo");
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {data.profile?.photo_path ? t("pf.photoOnFile") : t("pf.photoNone")}
            </p>
          </div>

          <div>
            <Label htmlFor="doc">{t("pf.document")}</Label>
            <select
              id="doc-kind"
              className="mb-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={docKind}
              onChange={(e) => setDocKind(e.target.value as DocKind)}
            >
              {DOC_KINDS.filter((k) => k !== "photo").map((k) => (
                <option key={k} value={k}>
                  {t(`pf.doc.${k}`)}
                </option>
              ))}
            </select>
            <Input
              id="doc"
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file, docKind);
              }}
            />
          </div>
        </div>

        {data.documents.length > 0 ? (
          <div className="space-y-3">
            {data.documents.map((doc) => (
              <div key={doc.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{t(`pf.doc.${doc.doc_kind}`)}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleString()}
                  </span>
                </div>
                {doc.extraction_error ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("pf.cannotRead")} ({doc.extraction_error}). {t("pf.enterManually")}
                  </p>
                ) : null}
                {doc.suggestions.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {doc.suggestions.map((s) => (
                      <div
                        key={`${doc.id}-${s.field}`}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span>
                          <span className="text-muted-foreground">{s.label}:</span> {String(s.value)}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({Math.round(s.confidence * 100)}% {t("pf.confidence")})
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => applySuggestion(s.field, s.value)}
                        >
                          {t("pf.useThis")}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("pf.detailsTitle")}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="full_name">{t("pf.fullName")}</Label>
            <Input
              id="full_name"
              value={form.full_name ?? ""}
              onChange={(e) => set("full_name", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="dob">{t("pf.dob")}</Label>
            <Input
              id="dob"
              type="date"
              value={form.date_of_birth ?? ""}
              onChange={(e) => set("date_of_birth", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {age === null ? t("pf.ageHint") : `${t("pf.age")} ${age} ${t("pf.years")}`}
            </p>
          </div>
          <div>
            <Label htmlFor="gender">{t("pf.gender")}</Label>
            <select
              id="gender"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.gender ?? ""}
              onChange={(e) => set("gender", e.target.value)}
            >
              <option value="">{t("pf.select")}</option>
              <option value="female">{t("pf.female")}</option>
              <option value="male">{t("pf.male")}</option>
              <option value="other">{t("pf.other")}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="category">{t("pf.category")}</Label>
            <select
              id="category"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.social_category ?? ""}
              onChange={(e) => set("social_category", e.target.value)}
            >
              <option value="">{t("pf.select")}</option>
              {SOCIAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c] ? t(`pf.cat.${c}`) : c}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("pf.categoryHint")}
            </p>
          </div>
          <div>
            <Label htmlFor="ownership">{t("pf.ownership")}</Label>
            <select
              id="ownership"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.ownership_type ?? ""}
              onChange={(e) => set("ownership_type", e.target.value)}
            >
              <option value="">{t("pf.select")}</option>
              {OWNERSHIP_TYPES.map((o) => (
                <option key={o} value={o}>
                  {OWNERSHIP_LABEL[o] ? t(`pf.own.${o}`) : o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="extent">{t("pf.extent")}</Label>
            <Input
              id="extent"
              type="number"
              step="0.01"
              min="0"
              value={form.total_extent_acres ?? ""}
              onChange={(e) =>
                set("total_extent_acres", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </div>
          <div>
            <Label htmlFor="state">{t("pf.state")}</Label>
            <select
              id="state"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.state_geography_id ?? ""}
              onChange={(e) => {
                set("state_geography_id", e.target.value || null);
                set("district_geography_id", null);
              }}
            >
              <option value="">{t("pf.select")}</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="district">{t("pf.district")}</Label>
            <select
              id="district"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.district_geography_id ?? ""}
              onChange={(e) => set("district_geography_id", e.target.value || null)}
            >
              <option value="">{t("pf.select")}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="village">{t("pf.village")}</Label>
            <Input
              id="village"
              value={form.village_code ?? ""}
              onChange={(e) => set("village_code", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="irrigation">{t("pf.irrigation")}</Label>
            <Input
              id="irrigation"
              value={form.irrigation_source ?? ""}
              onChange={(e) => set("irrigation_source", e.target.value)}
              placeholder={t("pf.irrigationPh")}
            />
          </div>
        </div>

        <h3 className="pt-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("pf.bankTitle")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="holder">{t("pf.holder")}</Label>
            <Input
              id="holder"
              value={form.bank_account_holder ?? ""}
              onChange={(e) => set("bank_account_holder", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="bank">{t("pf.bank")}</Label>
            <Input
              id="bank"
              value={form.bank_name ?? ""}
              onChange={(e) => set("bank_name", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="branch">{t("pf.branch")}</Label>
            <Input
              id="branch"
              value={form.bank_branch ?? ""}
              onChange={(e) => set("bank_branch", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ifsc">IFSC</Label>
            <Input
              id="ifsc"
              value={form.bank_ifsc ?? ""}
              onChange={(e) => set("bank_ifsc", e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <Label htmlFor="account">{t("pf.account")}</Label>
            <Input
              id="account"
              inputMode="numeric"
              placeholder={maskAccount(data.profile?.bank_account_last4 ?? null)}
              value={form.bank_account_number ?? ""}
              onChange={(e) => set("bank_account_number", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("pf.accountHint")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
            {saveMutation.isPending ? t("pf.saving") : t("pf.save")}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/farm">{t("pf.captureParcel")}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
