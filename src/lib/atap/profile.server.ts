/**
 * Server-only helpers for the B2C farmer portal profile slice.
 *
 * Document reading sits behind a single adapter seam so the vision provider can
 * be swapped without touching the farmer journey. The adapter only ever returns
 * *suggestions*; confirmation is a farmer action, and no eligibility or approval
 * decision is ever made here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { DocKind, RawExtraction } from "@/lib/atap/profile";

export type AuthedClient = SupabaseClient<Database>;

export const DOCUMENT_BUCKET = "farmer-documents";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

export type ExtractionOutcome =
  | { ok: true; fields: RawExtraction; model: string }
  | { ok: false; reason: string; retryable: boolean };

const PROMPTS: Record<DocKind, string> = {
  bank_passbook:
    'Read this Indian bank passbook page. Return strict JSON only: {"account_holder_name":string|null,"bank_name":string|null,"branch":string|null,"ifsc":string|null,"account_number":string|null,"confidence":number}. Use null for anything not clearly legible.',
  land_record:
    'Read this Indian land record / pattadar passbook page. Return strict JSON only: {"survey_number":string|null,"extent_acres":number|null,"village":string|null,"district":string|null,"ownership_type":"owner"|"leased"|"share_cropped"|"mixed"|null,"confidence":number}. Use null for anything not clearly legible.',
  id_proof:
    'Read this Indian identity document. Return strict JSON only: {"full_name":string|null,"date_of_birth":"YYYY-MM-DD"|null,"confidence":number}. Do not return any identity number. Use null for anything not clearly legible.',
  photo: "Return strict JSON only: {\"confidence\":0}.",
  other: "Return strict JSON only: {\"confidence\":0}.",
};

function parseJson(content: string): RawExtraction | null {
  const fenced = content.match(/\{[\s\S]*\}/);
  if (!fenced) return null;
  try {
    const parsed: unknown = JSON.parse(fenced[0]);
    return parsed && typeof parsed === "object" ? (parsed as RawExtraction) : null;
  } catch {
    return null;
  }
}

/**
 * Vision extraction adapter. `imageDataUrl` must be a data URL so nothing about
 * the farmer's private document is fetched from a public location.
 */
export async function extractDocumentFields(
  imageDataUrl: string,
  docKind: DocKind,
): Promise<ExtractionOutcome> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, reason: "extraction_unavailable", retryable: false };
  if (docKind === "photo" || docKind === "other") {
    return { ok: true, fields: { confidence: 0 }, model: "none" };
  }

  let response: Response;
  try {
    response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPTS[docKind] },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });
  } catch {
    return { ok: false, reason: "extraction_network_error", retryable: true };
  }

  if (!response.ok) {
    const status = response.status;
    const retryable = status === 429 || status >= 500;
    const reason =
      status === 402
        ? "extraction_credits_exhausted"
        : status === 403
          ? "extraction_blocked_by_policy"
          : status === 429
            ? "extraction_rate_limited"
            : retryable
              ? "extraction_provider_unavailable"
              : "extraction_request_rejected";
    return { ok: false, reason, retryable };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const fields = parseJson(content);
  if (!fields) return { ok: false, reason: "extraction_unreadable", retryable: false };
  return { ok: true, fields, model: MODEL };
}

/** Farmer documents live under a per-user folder enforced by storage policy. */
export function documentPath(userId: string, docKind: DocKind, extension: string) {
  const safeExt = extension.replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
  return `${userId}/${docKind}-${Date.now()}.${safeExt}`;
}

export async function farmerGeographies(supabase: AuthedClient) {
  const { data } = await supabase
    .from("geographies")
    .select("id, code, name, level, parent_id")
    .in("level", ["state", "district"]);
  return (data ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    level: string;
    parent_id: string | null;
  }>;
}
