import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isSandboxStaticOtp } from "@/lib/mobile/mobileApi";

const SANDBOX_PILOT_USER_ID = "72e5aa52-98ec-4ecc-86c9-576d2c622f2a";
const SANDBOX_TOKEN_PREFIX = "agrighar-sbx-v1";
const SANDBOX_TOKEN_TTL_SECONDS = 12 * 60 * 60;

type MobileClient = SupabaseClient<Database>;

type SandboxPilot = {
  admin: MobileClient;
  user: User;
};

type SandboxTokenPayload = {
  sub: string;
  scope: "mobile:farmer-profile:synthetic";
  iat: number;
  exp: number;
  jti: string;
};

function mobileEnvironment() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("mobile_service_unconfigured");
  return { url, key };
}

function mobileAdminEnvironment() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SECRET_KEY"];
  if (!url || !key) throw new Error("mobile_sandbox_auth_unconfigured");
  return { url, key };
}

function isOpaqueSupabaseKey(value: string) {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function supabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    if (isOpaqueSupabaseKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export function createMobilePublicClient() {
  const { url, key } = mobileEnvironment();
  return createClient<Database>(url, key, {
    global: { fetch: supabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createMobileAdminClient() {
  const { url, key } = mobileAdminEnvironment();
  return createClient<Database>(url, key, {
    global: { fetch: supabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function sandboxPilotForPhone(phone?: string): Promise<SandboxPilot | null> {
  const admin = createMobileAdminClient();
  const [{ data: authData, error: authError }, { data: farmer, error: farmerError }, roles] =
    await Promise.all([
      admin.auth.admin.getUserById(SANDBOX_PILOT_USER_ID),
      admin
        .from("farmer_profiles")
        .select("farmer_user_id, is_synthetic")
        .eq("farmer_user_id", SANDBOX_PILOT_USER_ID)
        .eq("is_synthetic", true)
        .maybeSingle(),
      admin.from("user_roles").select("id").eq("user_id", SANDBOX_PILOT_USER_ID).limit(1),
    ]);

  if (authError || farmerError || roles.error) throw new Error("mobile_sandbox_auth_lookup_failed");
  const user = authData.user;
  if (!user || !farmer || (roles.data ?? []).length > 0) return null;
  if (phone && user.phone !== phone) return null;
  return { admin, user };
}

async function insertSandboxAudit(
  admin: MobileClient,
  action: string,
  decision: "allow" | "deny",
  metadata: Record<string, string | boolean>,
) {
  const { error } = await admin.from("audit_events").insert({
    action,
    actor_user_id:
      action === "auth.sandbox_static_otp.verified" && decision === "allow"
        ? SANDBOX_PILOT_USER_ID
        : null,
    decision,
    purpose_code: "mobile_pilot_auth",
    subject_id: SANDBOX_PILOT_USER_ID,
    subject_type: "auth_user",
    metadata: { ...metadata, is_synthetic: true, static_otp: true },
  });
  if (error) throw new Error("mobile_sandbox_audit_failed");
}

export async function createSandboxStaticOtpChallenge(phone: string) {
  const pilot = await sandboxPilotForPhone(phone);
  if (!pilot) return null;
  const challengeId = crypto.randomUUID();
  await insertSandboxAudit(pilot.admin, "auth.sandbox_static_otp.requested", "allow", {
    challenge_id: challengeId,
    phone_suffix: phone.slice(-4),
  });
  return challengeId;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function stringToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToString(value: string) {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function sandboxSigningKey() {
  const { key } = mobileAdminEnvironment();
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${SANDBOX_TOKEN_PREFIX}:${key}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function createSandboxAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload: SandboxTokenPayload = {
    sub: SANDBOX_PILOT_USER_ID,
    scope: "mobile:farmer-profile:synthetic",
    iat: now,
    exp: now + SANDBOX_TOKEN_TTL_SECONDS,
    jti: crypto.randomUUID(),
  };
  const encodedPayload = stringToBase64Url(JSON.stringify(payload));
  const signingInput = `${SANDBOX_TOKEN_PREFIX}.${encodedPayload}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await sandboxSigningKey(),
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function verifySandboxAccessToken(token: string): Promise<SandboxPilot | null> {
  const [prefix, encodedPayload, encodedSignature, extra] = token.split(".");
  if (prefix !== SANDBOX_TOKEN_PREFIX || !encodedPayload || !encodedSignature || extra) return null;
  try {
    const signature = Uint8Array.from(
      atob(
        encodedSignature
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(Math.ceil(encodedSignature.length / 4) * 4, "="),
      ),
      (character) => character.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      await sandboxSigningKey(),
      signature,
      new TextEncoder().encode(`${prefix}.${encodedPayload}`),
    );
    if (!valid) return null;
    const payload = JSON.parse(base64UrlToString(encodedPayload)) as SandboxTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.sub !== SANDBOX_PILOT_USER_ID ||
      payload.scope !== "mobile:farmer-profile:synthetic" ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= now
    ) {
      return null;
    }
    return sandboxPilotForPhone();
  } catch {
    return null;
  }
}

export async function verifySandboxStaticOtp(input: {
  challengeId: string;
  phone: string;
  otp: string;
}): Promise<
  | { handled: false }
  | { handled: true; session: null }
  | { handled: true; session: { accessToken: string; expiresAt: string; userId: string } }
> {
  const pilot = await sandboxPilotForPhone(input.phone);
  if (!pilot) return { handled: false };
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: challenge, error } = await pilot.admin
    .from("audit_events")
    .select("id")
    .eq("action", "auth.sandbox_static_otp.requested")
    .eq("subject_id", SANDBOX_PILOT_USER_ID)
    .contains("metadata", { challenge_id: input.challengeId })
    .gte("created_at", cutoff)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("mobile_sandbox_challenge_lookup_failed");
  if (!challenge) return { handled: false };
  if (!isSandboxStaticOtp(input.otp)) {
    await insertSandboxAudit(pilot.admin, "auth.sandbox_static_otp.verified", "deny", {
      challenge_id: input.challengeId,
      reason: "invalid_code",
    });
    return { handled: true, session: null };
  }

  const accessToken = await createSandboxAccessToken();
  const expiresAt = new Date(Date.now() + SANDBOX_TOKEN_TTL_SECONDS * 1000).toISOString();
  await insertSandboxAudit(pilot.admin, "auth.sandbox_static_otp.verified", "allow", {
    challenge_id: input.challengeId,
  });
  return {
    handled: true,
    session: { accessToken, expiresAt, userId: SANDBOX_PILOT_USER_ID },
  };
}

export async function requireMobileUser(request: Request): Promise<{
  supabase: SupabaseClient<Database>;
  user: User;
  userId: string;
}> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new Error("mobile_unauthorized");
  const token = authorization.slice("Bearer ".length).trim();
  if (token.split(".").length !== 3) throw new Error("mobile_unauthorized");

  const { url, key } = mobileEnvironment();
  const supabase = createClient<Database>(url, key, {
    global: {
      fetch: supabaseFetch(key),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("mobile_unauthorized");
  return { supabase, user: data.user, userId: data.user.id };
}

export async function requireMobileProfileUser(request: Request): Promise<{
  supabase: MobileClient;
  user: User;
  userId: string;
  isSandboxStatic: boolean;
}> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new Error("mobile_unauthorized");
  const token = authorization.slice("Bearer ".length).trim();
  if (token.startsWith(`${SANDBOX_TOKEN_PREFIX}.`)) {
    const pilot = await verifySandboxAccessToken(token);
    if (!pilot) throw new Error("mobile_unauthorized");
    return {
      supabase: pilot.admin,
      user: pilot.user,
      userId: pilot.user.id,
      isSandboxStatic: true,
    };
  }
  return { ...(await requireMobileUser(request)), isSandboxStatic: false };
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const body = await request.text();
  if (!body || body.length > 8192) return null;
  try {
    const value = JSON.parse(body) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function mobileJson(payload: unknown, status = 200, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(payload), { status, headers });
}

export function mobileError(code: string, status: number, correlationId = crypto.randomUUID()) {
  return mobileJson({ code, messageKey: `mobile.error.${code}`, correlationId }, status);
}
