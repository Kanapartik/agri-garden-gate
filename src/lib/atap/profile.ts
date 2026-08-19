/**
 * B2C farmer portal profile — pure domain logic.
 *
 * Encodes the slice rules so they are directly unit-testable:
 *  - age is derived from date of birth, never stored as a number
 *  - bank account numbers are masked; only the last four digits persist
 *  - AI extraction produces *suggestions* with provenance and confidence;
 *    nothing reaches the profile until the farmer confirms it
 *  - scheme context is built from confirmed profile + farm values only
 */

import type { FormValues } from "@/lib/atap/onboarding";

export const SOCIAL_CATEGORIES = [
  "general",
  "obc",
  "sc",
  "st",
  "ews",
  "not_disclosed",
] as const;
export type SocialCategory = (typeof SOCIAL_CATEGORIES)[number];

export const OWNERSHIP_TYPES = [
  "owner",
  "leased",
  "share_cropped",
  "mixed",
  "landless",
] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export const DOC_KINDS = ["photo", "bank_passbook", "land_record", "id_proof", "other"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export type FieldProvenance = "farmer_entered" | "ai_extracted" | "farmer_confirmed";

export interface FarmerProfile {
  full_name: string | null;
  photo_path: string | null;
  date_of_birth: string | null;
  gender: string | null;
  social_category: SocialCategory | null;
  ownership_type: OwnershipType | null;
  total_extent_acres: number | null;
  irrigation_source: string | null;
  state_geography_id: string | null;
  district_geography_id: string | null;
  village_code: string | null;
  bank_account_holder: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_ifsc: string | null;
  bank_account_last4: string | null;
  field_provenance: Record<string, FieldProvenance>;
}

/* ------------------------------------------------------------------- age */

/** Age in whole years. Returns null for missing or unparseable dates. */
export function deriveAge(dateOfBirth: string | null | undefined, today = new Date()): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < dob.getUTCDate())) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

/* ------------------------------------------------------------- masking */

export function accountLast4(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export function maskAccount(last4: string | null | undefined): string {
  return last4 ? `••••••${last4}` : "—";
}

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function normalizeIfsc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().toUpperCase().replace(/\s/g, "");
  return IFSC_RE.test(value) ? value : null;
}

/* -------------------------------------------------------- completeness */

export interface CompletenessField {
  field: keyof FarmerProfile | "parcel";
  label: string;
  /** Blocking fields gate scheme eligibility evaluation. */
  required: boolean;
  done: boolean;
}

export interface Completeness {
  fields: CompletenessField[];
  score: number;
  missingRequired: string[];
  schemeReady: boolean;
}

export function profileCompleteness(
  profile: FarmerProfile | null,
  parcelCount: number,
): Completeness {
  const p = profile;
  const fields: CompletenessField[] = [
    { field: "full_name", label: "Name", required: true, done: Boolean(p?.full_name) },
    { field: "photo_path", label: "Photograph", required: false, done: Boolean(p?.photo_path) },
    { field: "date_of_birth", label: "Date of birth", required: true, done: Boolean(p?.date_of_birth) },
    { field: "gender", label: "Gender", required: false, done: Boolean(p?.gender) },
    {
      field: "social_category",
      label: "Social category",
      required: true,
      done: Boolean(p?.social_category),
    },
    {
      field: "ownership_type",
      label: "Land ownership type",
      required: true,
      done: Boolean(p?.ownership_type),
    },
    {
      field: "total_extent_acres",
      label: "Extent of land (acres)",
      required: true,
      done: typeof p?.total_extent_acres === "number" && p.total_extent_acres > 0,
    },
    {
      field: "state_geography_id",
      label: "State",
      required: true,
      done: Boolean(p?.state_geography_id),
    },
    {
      field: "district_geography_id",
      label: "District",
      required: true,
      done: Boolean(p?.district_geography_id),
    },
    {
      field: "bank_account_last4",
      label: "Bank passbook details",
      required: true,
      done: Boolean(p?.bank_account_last4 && p?.bank_ifsc),
    },
    { field: "parcel", label: "Farm parcel captured", required: false, done: parcelCount > 0 },
  ];

  const done = fields.filter((f) => f.done).length;
  const missingRequired = fields.filter((f) => f.required && !f.done).map((f) => f.label);

  return {
    fields,
    score: Math.round((done / fields.length) * 100),
    missingRequired,
    schemeReady: missingRequired.length === 0,
  };
}

/* ------------------------------------------------------ scheme context */

export interface FarmContextLike {
  primary_crop: string | null;
  area_acres: number | null;
  village_code: string | null;
  plot_ref: string | null;
  label: string | null;
}

export interface GeographyLike {
  id: string;
  code: string;
  name: string;
  level: string;
}

/**
 * The single place scheme rule inputs are derived. Rules are configuration, so
 * this only supplies the field values — it never decides eligibility.
 */
export function schemeContextValues(input: {
  profile: FarmerProfile | null;
  farm: FarmContextLike | null;
  geographies: readonly GeographyLike[];
  today?: Date;
}): FormValues {
  const { profile, farm, geographies } = input;
  const codeOf = (id: string | null | undefined) =>
    (id ? geographies.find((g) => g.id === id)?.code : undefined) ?? null;

  const values: FormValues = {};
  const age = deriveAge(profile?.date_of_birth ?? null, input.today ?? new Date());
  if (age !== null) values["applicant_age"] = age;
  if (profile?.full_name) values["applicant_name"] = profile.full_name;
  if (profile?.social_category) values["social_category"] = profile.social_category;
  if (profile?.ownership_type) values["ownership_type"] = profile.ownership_type;

  const extent = farm?.area_acres ?? profile?.total_extent_acres ?? null;
  if (extent !== null && extent !== undefined) values["land_area_acres"] = extent;

  const stateCode = codeOf(profile?.state_geography_id);
  if (stateCode) values["state_code"] = stateCode;
  const districtCode = codeOf(profile?.district_geography_id);
  if (districtCode) values["district_code"] = districtCode;

  const village = farm?.village_code ?? profile?.village_code ?? null;
  if (village) values["village_code"] = village;
  if (farm?.primary_crop) values["primary_crop"] = farm.primary_crop;
  if (farm?.plot_ref) values["plot_ref"] = farm.plot_ref;
  if (farm?.label) values["farm_label"] = farm.label;

  values["bank_linked"] = profile?.bank_account_last4 && profile?.bank_ifsc ? "yes" : "no";
  return values;
}

/* ----------------------------------------------------- AI extraction map */

export interface ExtractionSuggestion {
  field: string;
  label: string;
  value: string | number;
  confidence: number;
}

export interface RawExtraction {
  account_holder_name?: unknown;
  bank_name?: unknown;
  branch?: unknown;
  ifsc?: unknown;
  account_number?: unknown;
  full_name?: unknown;
  date_of_birth?: unknown;
  survey_number?: unknown;
  extent_acres?: unknown;
  village?: unknown;
  district?: unknown;
  ownership_type?: unknown;
  confidence?: unknown;
}

const FIELD_LABEL: Record<string, string> = {
  bank_account_holder: "Account holder name",
  bank_name: "Bank name",
  bank_branch: "Branch",
  bank_ifsc: "IFSC code",
  bank_account_number: "Account number",
  full_name: "Name",
  date_of_birth: "Date of birth",
  land_record_ref: "Survey / passbook number",
  total_extent_acres: "Extent (acres)",
  village_code: "Village",
  district_name: "District",
  ownership_type: "Ownership type",
};

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "unknown") return null;
  return trimmed.slice(0, 120);
}

function num(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalises whatever the vision model returned into confirmable suggestions.
 * Anything unparseable is dropped rather than guessed.
 */
export function mapExtraction(raw: RawExtraction, docKind: DocKind): ExtractionSuggestion[] {
  const baseConfidence = num(raw.confidence) ?? 0.6;
  const clamp = (v: number) => Math.min(0.99, Math.max(0.1, v));
  const out: ExtractionSuggestion[] = [];
  const push = (field: string, value: string | number | null, confidence = baseConfidence) => {
    if (value === null) return;
    out.push({ field, label: FIELD_LABEL[field] ?? field, value, confidence: clamp(confidence) });
  };

  if (docKind === "bank_passbook") {
    push("bank_account_holder", text(raw.account_holder_name));
    push("bank_name", text(raw.bank_name));
    push("bank_branch", text(raw.branch));
    push("bank_ifsc", normalizeIfsc(text(raw.ifsc)), baseConfidence);
    const digits = text(raw.account_number)?.replace(/\D/g, "") ?? null;
    push("bank_account_number", digits && digits.length >= 8 ? digits : null);
  }

  if (docKind === "land_record") {
    push("land_record_ref", text(raw.survey_number));
    push("total_extent_acres", num(raw.extent_acres));
    push("village_code", text(raw.village));
    push("district_name", text(raw.district));
    const ownership = text(raw.ownership_type)?.toLowerCase() ?? null;
    const matched = (OWNERSHIP_TYPES as readonly string[]).includes(ownership ?? "")
      ? (ownership as OwnershipType)
      : null;
    push("ownership_type", matched);
  }

  if (docKind === "id_proof") {
    push("full_name", text(raw.full_name));
    const dob = text(raw.date_of_birth);
    push("date_of_birth", dob && ISO_DATE_RE.test(dob) ? dob : null);
  }

  return out;
}

/**
 * Confirming a suggestion always upgrades provenance to farmer_confirmed —
 * an AI reading is never treated as verified on its own.
 */
export function provenanceAfterConfirm(
  current: Record<string, FieldProvenance>,
  confirmedFields: readonly string[],
  manualFields: readonly string[] = [],
): Record<string, FieldProvenance> {
  const next = { ...current };
  for (const field of confirmedFields) next[field] = "farmer_confirmed";
  for (const field of manualFields) next[field] = "farmer_entered";
  return next;
}
