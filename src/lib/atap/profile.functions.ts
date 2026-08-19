/**
 * B2C server functions: farmer profile, document upload + AI-suggested fields,
 * and the scheme-readiness context. Every handler runs as the signed-in user,
 * so RLS keeps profile rows farmer-only.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FormValues } from "@/lib/atap/onboarding";
import {
  DOC_KINDS,
  OWNERSHIP_TYPES,
  SOCIAL_CATEGORIES,
  accountLast4,
  mapExtraction,
  normalizeIfsc,
  profileCompleteness,
  provenanceAfterConfirm,
  schemeContextValues,
  type Completeness,
  type DocKind,
  type ExtractionSuggestion,
  type FarmerProfile,
  type FieldProvenance,
  type OwnershipType,
  type SocialCategory,
} from "@/lib/atap/profile";

export interface DocumentRow {
  id: string;
  doc_kind: DocKind;
  storage_path: string;
  state: "pending" | "extracted" | "failed" | "confirmed";
  extraction_error: string | null;
  created_at: string;
  suggestions: ExtractionSuggestion[];
}

export interface GeographyOption {
  id: string;
  code: string;
  name: string;
  level: string;
  parent_id: string | null;
}

export interface ProfileWorkspace {
  userId: string;
  profile: FarmerProfile | null;
  completeness: Completeness;
  documents: DocumentRow[];
  geographies: GeographyOption[];
  parcels: Array<{ id: string; label: string; area_acres: number | null; primary_crop: string | null }>;
  schemeContext: FormValues;
}

export interface ProfileInput {
  full_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  social_category?: string | null;
  ownership_type?: string | null;
  total_extent_acres?: number | null;
  irrigation_source?: string | null;
  state_geography_id?: string | null;
  district_geography_id?: string | null;
  village_code?: string | null;
  bank_account_holder?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  bank_ifsc?: string | null;
  bank_account_number?: string | null;
  /** Fields the farmer confirmed from an AI suggestion, for provenance. */
  confirmedFields?: string[];
}

const PROFILE_SELECT =
  "farmer_user_id, full_name, photo_path, date_of_birth, gender, social_category, ownership_type, total_extent_acres, irrigation_source, state_geography_id, district_geography_id, village_code, bank_account_holder, bank_name, bank_branch, bank_ifsc, bank_account_last4, field_provenance";

function asProfile(row: unknown): FarmerProfile | null {
  if (!row) return null;
  const r = row as Record<string, unknown>;
  return {
    full_name: (r["full_name"] as string) ?? null,
    photo_path: (r["photo_path"] as string) ?? null,
    date_of_birth: (r["date_of_birth"] as string) ?? null,
    gender: (r["gender"] as string) ?? null,
    social_category: (r["social_category"] as SocialCategory) ?? null,
    ownership_type: (r["ownership_type"] as OwnershipType) ?? null,
    total_extent_acres:
      r["total_extent_acres"] === null || r["total_extent_acres"] === undefined
        ? null
        : Number(r["total_extent_acres"]),
    irrigation_source: (r["irrigation_source"] as string) ?? null,
    state_geography_id: (r["state_geography_id"] as string) ?? null,
    district_geography_id: (r["district_geography_id"] as string) ?? null,
    village_code: (r["village_code"] as string) ?? null,
    bank_account_holder: (r["bank_account_holder"] as string) ?? null,
    bank_name: (r["bank_name"] as string) ?? null,
    bank_branch: (r["bank_branch"] as string) ?? null,
    bank_ifsc: (r["bank_ifsc"] as string) ?? null,
    bank_account_last4: (r["bank_account_last4"] as string) ?? null,
    field_provenance: (r["field_provenance"] as Record<string, FieldProvenance>) ?? {},
  };
}

export const getProfileWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileWorkspace> => {
    const { supabase, userId } = context;
    const { farmerGeographies } = await import("@/lib/atap/profile.server");

    const [{ data: profileRow }, { data: docRows }, { data: extractions }, { data: farms }, geographies] =
      await Promise.all([
        supabase.from("farmer_profiles").select(PROFILE_SELECT).eq("farmer_user_id", userId).maybeSingle(),
        supabase
          .from("farmer_documents")
          .select("id, doc_kind, storage_path, state, extraction_error, created_at")
          .eq("farmer_user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("document_extractions")
          .select("document_id, suggested_fields, confidence, created_at")
          .eq("farmer_user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("farm_records")
          .select("id, label, plot_ref, village_code, primary_crop, area_acres, updated_at")
          .eq("farmer_user_id", userId)
          .order("updated_at", { ascending: false }),
        farmerGeographies(supabase),
      ]);

    const profile = asProfile(profileRow);
    const farmRows = (farms ?? []) as Array<{
      id: string;
      label: string;
      plot_ref: string | null;
      village_code: string | null;
      primary_crop: string | null;
      area_acres: number | null;
    }>;

    const documents = ((docRows ?? []) as Array<Record<string, unknown>>).map((d) => {
      const extraction = (extractions ?? []).find(
        (e) => (e as Record<string, unknown>)["document_id"] === d["id"],
      ) as { suggested_fields?: unknown } | undefined;
      const suggestions = Array.isArray(extraction?.suggested_fields)
        ? (extraction?.suggested_fields as ExtractionSuggestion[])
        : [];
      return {
        id: d["id"] as string,
        doc_kind: d["doc_kind"] as DocKind,
        storage_path: d["storage_path"] as string,
        state: d["state"] as DocumentRow["state"],
        extraction_error: (d["extraction_error"] as string) ?? null,
        created_at: d["created_at"] as string,
        suggestions,
      };
    });

    const firstFarm = farmRows[0] ?? null;

    return {
      userId,
      profile,
      completeness: profileCompleteness(profile, farmRows.length),
      documents,
      geographies,
      parcels: farmRows.map((f) => ({
        id: f.id,
        label: f.label,
        area_acres: f.area_acres === null ? null : Number(f.area_acres),
        primary_crop: f.primary_crop,
      })),
      schemeContext: schemeContextValues({
        profile,
        farm: firstFarm
          ? {
              primary_crop: firstFarm.primary_crop,
              area_acres: firstFarm.area_acres === null ? null : Number(firstFarm.area_acres),
              village_code: firstFarm.village_code,
              plot_ref: firstFarm.plot_ref,
              label: firstFarm.label,
            }
          : null,
        geographies,
      }),
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProfileInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, sha256 } = await import("@/lib/atap/admin.server");

    const str = (v: unknown, max = 120) =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

    const category = SOCIAL_CATEGORIES.includes(data.social_category as SocialCategory)
      ? (data.social_category as SocialCategory)
      : null;
    const ownership = OWNERSHIP_TYPES.includes(data.ownership_type as OwnershipType)
      ? (data.ownership_type as OwnershipType)
      : null;
    const extent =
      typeof data.total_extent_acres === "number" && data.total_extent_acres > 0
        ? Math.min(10000, Math.round(data.total_extent_acres * 100) / 100)
        : null;

    const { data: existing } = await supabase
      .from("farmer_profiles")
      .select("id, field_provenance")
      .eq("farmer_user_id", userId)
      .maybeSingle();

    const currentProvenance =
      ((existing?.field_provenance as Record<string, FieldProvenance> | undefined) ?? {}) as Record<
        string,
        FieldProvenance
      >;
    const confirmed = (data.confirmedFields ?? []).filter((f) => typeof f === "string").slice(0, 30);
    const manual = Object.keys(data).filter(
      (k) => k !== "confirmedFields" && !confirmed.includes(k),
    );

    const last4 = accountLast4(data.bank_account_number ?? null);
    const payload: Record<string, unknown> = {
      farmer_user_id: userId,
      full_name: str(data.full_name),
      date_of_birth: str(data.date_of_birth, 10),
      gender: str(data.gender, 40),
      social_category: category,
      ownership_type: ownership,
      total_extent_acres: extent,
      irrigation_source: str(data.irrigation_source, 60),
      state_geography_id: str(data.state_geography_id, 40),
      district_geography_id: str(data.district_geography_id, 40),
      village_code: str(data.village_code, 60),
      bank_account_holder: str(data.bank_account_holder),
      bank_name: str(data.bank_name),
      bank_branch: str(data.bank_branch),
      bank_ifsc: normalizeIfsc(data.bank_ifsc ?? null),
      field_provenance: provenanceAfterConfirm(currentProvenance, confirmed, manual),
    };
    if (last4) {
      payload["bank_account_last4"] = last4;
      // Full account numbers are never stored in the clear.
      payload["bank_account_hash"] = await sha256(
        `${payload["bank_ifsc"] ?? ""}:${(data.bank_account_number ?? "").replace(/\D/g, "")}`,
      );
    }

    const { error } = existing
      ? await supabase.from("farmer_profiles").update(payload as never).eq("farmer_user_id", userId)
      : await supabase.from("farmer_profiles").insert(payload as never);
    if (error) throw new Error("profile_write_failed");

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: null,
      action: existing ? "farmer.profile.update" : "farmer.profile.create",
      subject_type: "farmer_profile",
      subject_id: userId,
      purpose_code: "farmer_onboarding",
      decision: "allow",
      metadata: { confirmed_fields: confirmed.length, bank_recorded: Boolean(last4) },
    });

    return { ok: true as const };
  });

/**
 * Upload happens client-side into the farmer's own storage folder; this records
 * the document and runs the extraction adapter. Failures degrade to manual entry.
 */
export const registerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { docKind: string; storagePath: string; mimeType?: string; dataUrl?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit } = await import("@/lib/atap/admin.server");
    const { extractDocumentFields } = await import("@/lib/atap/profile.server");

    const docKind = (DOC_KINDS as readonly string[]).includes(data.docKind)
      ? (data.docKind as DocKind)
      : "other";
    if (!data.storagePath.startsWith(`${userId}/`)) throw new Error("invalid_storage_path");

    const { data: doc, error } = await supabase
      .from("farmer_documents")
      .insert({
        farmer_user_id: userId,
        uploaded_by_user_id: userId,
        doc_kind: docKind,
        storage_path: data.storagePath,
        mime_type: data.mimeType ?? null,
        state: "pending",
      } as never)
      .select("id")
      .single();
    if (error || !doc) throw new Error("document_write_failed");

    let suggestions: ExtractionSuggestion[] = [];
    let extractionError: string | null = null;

    if (data.dataUrl && data.dataUrl.startsWith("data:image/")) {
      const outcome = await extractDocumentFields(data.dataUrl, docKind);
      if (outcome.ok) {
        suggestions = mapExtraction(outcome.fields, docKind);
        await supabase.from("document_extractions").insert({
          document_id: doc.id,
          farmer_user_id: userId,
          adapter_code: "lovable_ai_vision",
          model_code: outcome.model,
          suggested_fields: suggestions,
          confidence: Object.fromEntries(suggestions.map((s) => [s.field, s.confidence])),
          provenance: "ai_extracted",
        } as never);
      } else {
        extractionError = outcome.reason;
      }
    } else {
      extractionError = "extraction_skipped_no_image";
    }

    await supabase
      .from("farmer_documents")
      .update({
        state: extractionError ? "failed" : "extracted",
        extraction_error: extractionError,
      } as never)
      .eq("id", doc.id);

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: null,
      action: "farmer.document.upload",
      subject_type: "farmer_document",
      subject_id: doc.id as string,
      purpose_code: "farmer_onboarding",
      decision: "allow",
      metadata: { doc_kind: docKind, extraction_error: extractionError, suggested: suggestions.length },
    });

    return {
      id: doc.id as string,
      suggestions,
      extractionError,
    };
  });

export const setProfilePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { storagePath: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.storagePath.startsWith(`${userId}/`)) throw new Error("invalid_storage_path");

    const { data: existing } = await supabase
      .from("farmer_profiles")
      .select("id")
      .eq("farmer_user_id", userId)
      .maybeSingle();

    const { error } = existing
      ? await supabase
          .from("farmer_profiles")
          .update({ photo_path: data.storagePath } as never)
          .eq("farmer_user_id", userId)
      : await supabase
          .from("farmer_profiles")
          .insert({ farmer_user_id: userId, photo_path: data.storagePath } as never);
    if (error) throw new Error("photo_write_failed");
    return { ok: true as const };
  });
