import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function mobileEnvironment() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("mobile_service_unconfigured");
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
