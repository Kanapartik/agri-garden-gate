import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canManageRoster } from "@/lib/atap/district";
import { newFarmerCode, nextQrMemberRef, parseFarmerQr } from "@/lib/atap/farmerQr";

/** Farmer: returns (creating on first use) their own QR code. */
export const getMyFarmerQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rotate?: boolean }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit } = await import("@/lib/atap/admin.server");
    const { data: row } = await supabase
      .from("farmer_qr_codes" as never)
      .select("code, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    const existing = row as { code: string; updated_at: string } | null;
    if (existing && !data.rotate) return existing;
    const code = newFarmerCode();
    const { data: saved, error } = await supabase
      .from("farmer_qr_codes" as never)
      .upsert({ user_id: userId, code } as never, { onConflict: "user_id" })
      .select("code, updated_at")
      .single();
    if (error) throw new Error("qr_write_failed");
    if (existing) {
      await audit(supabase, {
        actor_user_id: userId,
        action: "farmer.qr.rotate",
        subject_type: "user",
        subject_id: userId,
        decision: "allow",
        metadata: {},
      });
    }
    return saved as unknown as { code: string; updated_at: string };
  });

/** FPO staff: add the farmer behind a scanned QR to the roster (approval_pending). */
export const addMemberByQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; scanned: string; villageCode?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");
    const deny = async (reason: string) => {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "fpo.members.add_by_qr",
        subject_type: "tenant",
        subject_id: data.tenantId,
        decision: "deny",
        metadata: { reason },
      });
      throw new Error(reason);
    };

    const actor = await resolveDistrictActor(supabase, userId);
    if (!canManageRoster(actor, data.tenantId)) await deny("not_authorized");
    const code = parseFarmerQr(data.scanned);
    if (!code) await deny("invalid_code");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: qr } = await supabaseAdmin
      .from("farmer_qr_codes" as never)
      .select("user_id")
      .eq("code", code!)
      .maybeSingle();
    const farmerId = (qr as { user_id: string } | null)?.user_id;
    if (!farmerId) await deny("unknown_code");

    const { data: members } = await supabase
      .from("fpo_members")
      .select("member_ref, farmer_user_id")
      .eq("tenant_id", data.tenantId);
    if ((members ?? []).some((m) => m.farmer_user_id === farmerId)) await deny("already_member");

    const { data: fp } = await supabaseAdmin
      .from("farmer_profiles")
      .select("full_name, village_code")
      .eq("farmer_user_id", farmerId!)
      .maybeSingle();
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", farmerId!)
      .maybeSingle();
    const displayName = fp?.full_name || prof?.full_name || "Farmer (via QR)";
    const memberRef = nextQrMemberRef((members ?? []).map((m) => m.member_ref));

    const { data: inserted, error } = await supabase
      .from("fpo_members")
      .insert({
        tenant_id: data.tenantId,
        member_ref: memberRef,
        display_name: displayName,
        village_code: data.villageCode?.slice(0, 40) || fp?.village_code || null,
        farmer_user_id: farmerId,
        status: "approval_pending",
        added_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error("member_write_failed");

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.members.add_by_qr",
      subject_type: "fpo_member",
      subject_id: inserted.id,
      decision: "allow",
      metadata: { member_ref: memberRef },
    });
    return { memberRef, displayName };
  });
