/**
 * FPO Management & Operations workspace — Phase 2 server functions.
 *
 * Membership, FPO-local classification (tags/segments), purpose-scoped farmer
 * consent, and the Farmer 360 read path. Roster authority never implies farmer
 * data access: every Farmer 360 field group is re-checked against an active
 * consent row here, in the handler, and each read is audited.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  activePurposes,
  canActivateMembership,
  canAddMembers,
  canClassifyMembers,
  canRecordConsent,
  canTransitionMembership,
  membershipNumber,
  nextSequence,
  registrySummary,
  stripNeverShared,
  tabAllowed,
  validateTag,
  visibleTabs,
  type Farmer360Tab,
  type MemberRow,
  type MembershipState,
  type RegistrySummary,
  type SegmentFilters,
} from "@/lib/atap/fpoMembers";
import type { AppRole } from "@/lib/atap/policy";

/* ------------------------------------------------------------------ types */

export interface TagRow {
  id: string;
  code: string;
  label: string;
  description: string | null;
  color: string | null;
  memberCount: number;
}

export interface SegmentRow {
  id: string;
  name: string;
  description: string | null;
  filters: SegmentFilters;
}

export interface MemberConsentRow {
  id: string;
  farmer_user_id: string;
  purpose_code: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  evidence: string | null;
}

export interface MemberRegistry {
  tenantId: string;
  roles: AppRole[];
  canAdd: boolean;
  canClassify: boolean;
  canConsent: boolean;
  members: MemberRow[];
  tags: TagRow[];
  segments: SegmentRow[];
  consents: MemberConsentRow[];
  summary: RegistrySummary;
  facets: { crops: string[]; clusters: string[]; memberTypes: string[] };
}

export interface FarmerCandidate {
  farmer_user_id: string;
  full_name: string | null;
  village_code: string | null;
  total_extent_acres: number | null;
  alreadyMember: boolean;
}

export interface Farmer360Profile {
  full_name: string | null;
  gender: string | null;
  social_category: string | null;
  ownership_type: string | null;
  total_extent_acres: number | null;
  irrigation_source: string | null;
  village_code: string | null;
  updated_at: string | null;
}

export interface FarmSummary {
  id: string;
  label: string;
  plot_ref: string;
  area_acres: number | null;
  primary_crop: string | null;
  village_code: string | null;
  sync_state: string;
  updated_at: string;
}

export interface Farmer360 {
  memberId: string;
  purposes: string[];
  tabs: Farmer360Tab[];
  membership: MemberRow | null;
  profile: Farmer360Profile | null;
  farms: FarmSummary[];
  crops: Array<{ crop: string; acres: number; plots: number }>;
  schemes: Array<{
    id: string;
    status: string;
    scheme_id: string;
    decided_at: string | null;
    created_at: string;
  }>;
  market: Array<{ commodity: string; expectedAcres: number }>;
}

/* ------------------------------------------------------------- internals */

async function actorFor(supabase: any, userId: string) {
  const { resolveDistrictActor } = await import("@/lib/atap/district.server");
  return resolveDistrictActor(supabase, userId);
}

async function tenantScope(supabase: any, userId: string, tenantId: string) {
  const actor = await actorFor(supabase, userId);
  const permitted = actor.isPlatformAdmin || actor.isAuditor || actor.tenantIds.includes(tenantId);
  if (!permitted) throw new Error("You do not have access to this organization");
  const roles = actor.tenantRoles
    .filter((r: { tenant_id: string | null }) => r.tenant_id === tenantId)
    .map((r: { role: AppRole }) => r.role);
  return { actor, roles: roles as AppRole[] };
}

export interface MemberFull extends MemberRow {
  tenant_id: string;
  joined_on: string | null;
  exited_on: string | null;
}

async function memberTenant(supabase: any, memberId: string): Promise<MemberFull> {
  const { data } = await supabase.from("fpo_members").select("*").eq("id", memberId).maybeSingle();
  if (!data) throw new Error("Member not found");
  return data as MemberFull;
}

/* -------------------------------------------------------------- registry */

export const getMemberRegistry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<MemberRegistry> => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);

    const [
      { data: members },
      { data: tags },
      { data: assignments },
      { data: segments },
      { data: consents },
    ] = await Promise.all([
      supabase
        .from("fpo_members")
        .select(
          "id, member_ref, membership_number, display_name, status, member_type, village_code, village_cluster, crops, acreage, farmer_user_id, field_officer_user_id, contact_hint, joined_on, exited_on, source, notes",
        )
        .eq("tenant_id", data.tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("fpo_member_tags")
        .select("id, code, label, description, color")
        .eq("tenant_id", data.tenantId)
        .order("label"),
      supabase
        .from("fpo_member_tag_assignments")
        .select("member_id, tag_id")
        .eq("tenant_id", data.tenantId),
      supabase
        .from("fpo_member_segments")
        .select("id, name, description, filters")
        .eq("tenant_id", data.tenantId)
        .order("name"),
      supabase
        .from("fpo_farmer_consents")
        .select("id, farmer_user_id, purpose_code, granted_at, expires_at, revoked_at, evidence")
        .eq("tenant_id", data.tenantId),
    ]);

    const tagRows = (tags ?? []) as Array<{
      id: string;
      code: string;
      label: string;
      description: string | null;
      color: string | null;
    }>;
    const assignRows = (assignments ?? []) as Array<{ member_id: string; tag_id: string }>;
    const consentRows = (consents ?? []) as MemberConsentRow[];
    const codeById = new Map(tagRows.map((t) => [t.id, t.code]));

    const memberRows = ((members ?? []) as MemberRow[]).map((m) => {
      const tagCodes = assignRows
        .filter((a) => a.member_id === m.id)
        .flatMap((a) => (codeById.get(a.tag_id) ? [codeById.get(a.tag_id)!] : []));
      const purposes = m.farmer_user_id
        ? activePurposes(consentRows.filter((c) => c.farmer_user_id === m.farmer_user_id))
        : [];
      return { ...m, tagCodes, consentPurposes: purposes };
    });

    return {
      tenantId: data.tenantId,
      roles,
      canAdd: canAddMembers(roles, actor.isPlatformAdmin),
      canClassify: canClassifyMembers(roles, actor.isPlatformAdmin),
      canConsent: canRecordConsent(roles, actor.isPlatformAdmin),
      members: memberRows,
      tags: tagRows.map((t) => ({
        ...t,
        memberCount: assignRows.filter((a) => a.tag_id === t.id).length,
      })),
      segments: (
        (segments ?? []) as Array<{
          id: string;
          name: string;
          description: string | null;
          filters: unknown;
        }>
      ).map((s) => ({ ...s, filters: (s.filters ?? {}) as SegmentFilters })),
      consents: consentRows,
      summary: registrySummary(memberRows),
      facets: {
        crops: Array.from(new Set(memberRows.flatMap((m) => m.crops ?? []))).sort(),
        clusters: Array.from(
          new Set(memberRows.flatMap((m) => (m.village_cluster ? [m.village_cluster] : []))),
        ).sort(),
        memberTypes: Array.from(
          new Set(memberRows.flatMap((m) => (m.member_type ? [m.member_type] : []))),
        ).sort(),
      },
    };
  });

/* ---------------------------------------------------------- member write */

export const saveMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      memberId?: string;
      display_name: string;
      member_ref?: string;
      member_type?: string | null;
      village_code?: string | null;
      village_cluster?: string | null;
      crops?: string[];
      acreage?: number | null;
      contact_hint?: string | null;
      field_officer_user_id?: string | null;
      farmer_user_id?: string | null;
      source?: string | null;
      notes?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canAddMembers(roles, actor.isPlatformAdmin)) {
      throw new Error("Only FPO admins, onboarding officers or field officers can manage members");
    }
    if (!data.display_name.trim()) throw new Error("Member name is required");

    const { audit } = await import("@/lib/atap/admin.server");
    const patch = {
      display_name: data.display_name.trim(),
      member_type: data.member_type ?? null,
      village_code: data.village_code ?? null,
      village_cluster: data.village_cluster ?? null,
      crops: data.crops ?? [],
      acreage: data.acreage ?? null,
      contact_hint: data.contact_hint ?? null,
      field_officer_user_id: data.field_officer_user_id ?? null,
      source: data.source ?? "workspace",
      notes: data.notes ?? null,
    };

    if (data.memberId) {
      const existing = await memberTenant(supabase, data.memberId);
      if (existing.tenant_id !== data.tenantId)
        throw new Error("Member belongs to another organization");
      const { error } = await supabase.from("fpo_members").update(patch).eq("id", data.memberId);
      if (error) throw new Error(error.message);
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "fpo.member.update",
        subject_type: "fpo_members",
        subject_id: data.memberId,
        decision: "allow",
        metadata: {},
      });
      return { id: data.memberId };
    }

    const { data: existingNumbers } = await supabase
      .from("fpo_members")
      .select("membership_number, member_ref")
      .eq("tenant_id", data.tenantId);
    const rows = (existingNumbers ?? []) as Array<{
      membership_number: string | null;
      member_ref: string;
    }>;
    const { data: profile } = await supabase
      .from("fpo_profiles")
      .select("fpo_code")
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    const seq = nextSequence(rows.map((r) => r.membership_number));
    const number = membershipNumber(
      (profile as { fpo_code?: string } | null)?.fpo_code ?? "FPO",
      seq,
    );
    const ref = data.member_ref?.trim() || `M-${String(seq).padStart(4, "0")}`;
    if (rows.some((r) => r.member_ref === ref))
      throw new Error("That member reference already exists");

    const { data: inserted, error } = await supabase
      .from("fpo_members")
      .insert({
        tenant_id: data.tenantId,
        member_ref: ref,
        membership_number: number,
        status: data.farmer_user_id ? "approval_pending" : "invited",
        farmer_user_id: data.farmer_user_id ?? null,
        added_by: userId,
        ...patch,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.member.create",
      subject_type: "fpo_members",
      subject_id: (inserted as { id: string }).id,
      decision: "allow",
      metadata: { membership_number: number, linked: Boolean(data.farmer_user_id) },
    });
    return { id: (inserted as { id: string }).id, membershipNumber: number };
  });

export const setMembershipStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId: string; status: MembershipState }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const member = await memberTenant(supabase, data.memberId);
    const { actor, roles } = await tenantScope(supabase, userId, member.tenant_id);
    if (!canAddMembers(roles, actor.isPlatformAdmin)) throw new Error("Not permitted");

    if (data.status === "active") {
      const check = canActivateMembership({
        status: member.status,
        farmer_user_id: member.farmer_user_id ?? null,
      });
      if (!check.ok) {
        throw new Error(
          check.reason === "farmer_identity_not_linked"
            ? "Link this member to a farmer identity before activating the membership"
            : "That membership status change is not allowed",
        );
      }
    } else if (!canTransitionMembership(member.status, data.status)) {
      throw new Error("That membership status change is not allowed");
    }

    if (
      (data.status === "exited" || data.status === "removed") &&
      !canClassifyMembers(roles, actor.isPlatformAdmin)
    ) {
      throw new Error("Only an FPO admin can exit or remove a member");
    }

    const patch: { status: MembershipState; joined_on?: string; exited_on?: string } = {
      status: data.status,
    };
    if (data.status === "active" && !member.joined_on) {
      patch.joined_on = new Date().toISOString().slice(0, 10);
    }
    if (data.status === "exited") patch.exited_on = new Date().toISOString().slice(0, 10);

    const { error } = await supabase.from("fpo_members").update(patch).eq("id", data.memberId);
    if (error) throw new Error(error.message);

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: member.tenant_id,
      action: "fpo.member.status",
      subject_type: "fpo_members",
      subject_id: data.memberId,
      decision: "allow",
      metadata: { from: member.status, to: data.status },
    });
    return { ok: true };
  });

/* ------------------------------------------------------- farmer linkage */

/**
 * Candidate lookup is deliberately narrow: FPO admins only, an explicit search
 * term, a hard result cap, no contact details returned, and every search
 * audited. It exists to link an *existing* identity, not to browse farmers.
 */
export const searchFarmerCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; query: string }) => input)
  .handler(async ({ data, context }): Promise<FarmerCandidate[]> => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canAddMembers(roles, actor.isPlatformAdmin)) throw new Error("Not permitted");
    const term = data.query.trim();
    if (term.length < 3) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("farmer_profiles")
      .select("farmer_user_id, full_name, village_code, total_extent_acres")
      .or(
        `full_name.ilike.%${term.replace(/[%,]/g, "")}%,village_code.ilike.%${term.replace(/[%,]/g, "")}%`,
      )
      .limit(10);

    const { data: existing } = await supabase
      .from("fpo_members")
      .select("farmer_user_id")
      .eq("tenant_id", data.tenantId);
    const taken = new Set(
      ((existing ?? []) as Array<{ farmer_user_id: string | null }>).flatMap((e) =>
        e.farmer_user_id ? [e.farmer_user_id] : [],
      ),
    );

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.farmer.search",
      subject_type: "farmer_profiles",
      decision: "allow",
      metadata: { results: (rows ?? []).length },
    });

    return (
      (rows ?? []) as Array<{
        farmer_user_id: string;
        full_name: string | null;
        village_code: string | null;
        total_extent_acres: number | null;
      }>
    ).map((r) => ({ ...r, alreadyMember: taken.has(r.farmer_user_id) }));
  });

export const linkMemberFarmer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId: string; farmerUserId: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const member = await memberTenant(supabase, data.memberId);
    const { actor, roles } = await tenantScope(supabase, userId, member.tenant_id);
    if (!canAddMembers(roles, actor.isPlatformAdmin)) throw new Error("Not permitted");

    if (data.farmerUserId) {
      const { data: clash } = await supabase
        .from("fpo_members")
        .select("id")
        .eq("tenant_id", member.tenant_id)
        .eq("farmer_user_id", data.farmerUserId)
        .neq("id", data.memberId)
        .maybeSingle();
      if (clash) throw new Error("That farmer is already linked to another membership row");
    }

    const patch: { farmer_user_id: string | null; status?: MembershipState } = {
      farmer_user_id: data.farmerUserId,
    };
    if (!data.farmerUserId && member.status === "active") patch.status = "approval_pending";

    const { error } = await supabase.from("fpo_members").update(patch).eq("id", data.memberId);
    if (error) throw new Error(error.message);

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: member.tenant_id,
      action: data.farmerUserId ? "fpo.member.link" : "fpo.member.unlink",
      subject_type: "fpo_members",
      subject_id: data.memberId,
      decision: "allow",
      metadata: {},
    });
    return { ok: true };
  });

/* ------------------------------------------------------- tags & segments */

export const saveTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      label: string;
      description?: string | null;
      color?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canClassifyMembers(roles, actor.isPlatformAdmin)) throw new Error("Not permitted");
    const check = validateTag(data.label);
    if (!check.ok) throw new Error("Tag label is too short");

    const { data: row, error } = await supabase
      .from("fpo_member_tags")
      .upsert(
        {
          tenant_id: data.tenantId,
          code: check.code!,
          label: data.label.trim(),
          description: data.description ?? null,
          color: data.color ?? null,
          created_by: userId,
        },
        { onConflict: "tenant_id,code" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id, code: check.code! };
  });

export const assignTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { tenantId: string; tagId: string; memberIds: string[]; mode: "add" | "remove" }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canClassifyMembers(roles, actor.isPlatformAdmin)) throw new Error("Not permitted");
    if (data.memberIds.length === 0) return { changed: 0 };

    if (data.mode === "remove") {
      const { error } = await supabase
        .from("fpo_member_tag_assignments")
        .delete()
        .eq("tenant_id", data.tenantId)
        .eq("tag_id", data.tagId)
        .in("member_id", data.memberIds);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("fpo_member_tag_assignments").upsert(
        data.memberIds.map((memberId) => ({
          tenant_id: data.tenantId,
          tag_id: data.tagId,
          member_id: memberId,
          assigned_by: userId,
        })),
        { onConflict: "tag_id,member_id" },
      );
      if (error) throw new Error(error.message);
    }

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: `fpo.member.tag.${data.mode}`,
      subject_type: "fpo_member_tag_assignments",
      subject_id: data.tagId,
      decision: "allow",
      metadata: { members: data.memberIds.length },
    });
    return { changed: data.memberIds.length };
  });

export const saveSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      segmentId?: string;
      name: string;
      description?: string | null;
      filters: SegmentFilters;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canClassifyMembers(roles, actor.isPlatformAdmin)) throw new Error("Not permitted");
    if (!data.name.trim()) throw new Error("Segment name is required");

    const payload = {
      tenant_id: data.tenantId,
      name: data.name.trim(),
      description: data.description ?? null,
      filters: data.filters as never,
      is_smart: true,
      created_by: userId,
    };
    const query = data.segmentId
      ? supabase
          .from("fpo_member_segments")
          .update(payload)
          .eq("id", data.segmentId)
          .select("id")
          .single()
      : supabase.from("fpo_member_segments").insert(payload).select("id").single();
    const { data: row, error } = await query;
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; segmentId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canClassifyMembers(roles, actor.isPlatformAdmin)) throw new Error("Not permitted");
    const { error } = await supabase
      .from("fpo_member_segments")
      .delete()
      .eq("id", data.segmentId)
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------------------------------------------- consent */

export const recordMemberConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      memberId: string;
      purposeCode: string;
      evidence: string;
      expiresAt?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const member = await memberTenant(supabase, data.memberId);
    const { actor, roles } = await tenantScope(supabase, userId, member.tenant_id);
    if (!canRecordConsent(roles, actor.isPlatformAdmin)) throw new Error("Not permitted");
    if (!member.farmer_user_id) throw new Error("Link a farmer identity before recording consent");
    if (!data.evidence.trim()) {
      throw new Error("Record how the farmer's authorization was captured before granting access");
    }

    const { data: row, error } = await supabase
      .from("fpo_farmer_consents")
      .insert({
        tenant_id: member.tenant_id,
        farmer_user_id: member.farmer_user_id,
        purpose_code: data.purposeCode,
        evidence: data.evidence.trim(),
        expires_at: data.expiresAt ?? null,
        granted_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: member.tenant_id,
      action: "fpo.consent.grant",
      subject_type: "fpo_farmer_consents",
      subject_id: (row as { id: string }).id,
      decision: "allow",
      metadata: { purpose: data.purposeCode, member_id: data.memberId },
    });
    return { id: (row as { id: string }).id };
  });

export const revokeMemberConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { consentId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: consent } = await supabase
      .from("fpo_farmer_consents")
      .select("id, tenant_id, farmer_user_id, purpose_code")
      .eq("id", data.consentId)
      .maybeSingle();
    if (!consent) throw new Error("Consent not found");
    const row = consent as {
      id: string;
      tenant_id: string;
      farmer_user_id: string;
      purpose_code: string;
    };

    // The farmer may always revoke their own consent; otherwise FPO admin only.
    if (row.farmer_user_id !== userId) {
      const { actor, roles } = await tenantScope(supabase, userId, row.tenant_id);
      if (!canRecordConsent(roles, actor.isPlatformAdmin)) throw new Error("Not permitted");
    }

    const { error } = await supabase
      .from("fpo_farmer_consents")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.consentId);
    if (error) throw new Error(error.message);

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: row.tenant_id,
      action: "fpo.consent.revoke",
      subject_type: "fpo_farmer_consents",
      subject_id: row.id,
      decision: "allow",
      metadata: { purpose: row.purpose_code, by_farmer: row.farmer_user_id === userId },
    });
    return { ok: true };
  });

/* ------------------------------------------------------------ Farmer 360 */

export const getFarmer360 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId: string }) => input)
  .handler(async ({ data, context }): Promise<Farmer360> => {
    const { supabase, userId } = context;
    const member = await memberTenant(supabase, data.memberId);
    await tenantScope(supabase, userId, member.tenant_id);

    const empty: Farmer360 = {
      memberId: data.memberId,
      purposes: [],
      tabs: ["membership"],
      membership: member,
      profile: null,
      farms: [],
      crops: [],
      schemes: [],
      market: [],
    };
    if (!member.farmer_user_id) return empty;

    const { data: consentRows } = await supabase
      .from("fpo_farmer_consents")
      .select("purpose_code, revoked_at, expires_at")
      .eq("tenant_id", member.tenant_id)
      .eq("farmer_user_id", member.farmer_user_id);
    const purposes = activePurposes(
      (consentRows ?? []) as Array<{
        purpose_code: string;
        revoked_at: string | null;
        expires_at: string | null;
      }>,
    );
    const tabs = visibleTabs(purposes);

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: member.tenant_id,
      action: "fpo.farmer360.read",
      subject_type: "fpo_members",
      subject_id: data.memberId,
      decision: purposes.length > 0 ? "allow" : "deny",
      metadata: { purposes, tabs },
    });

    if (purposes.length === 0) return { ...empty, purposes, tabs };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result: Farmer360 = { ...empty, purposes, tabs };

    if (tabAllowed("profile", purposes)) {
      const { data: profile } = await supabaseAdmin
        .from("farmer_profiles")
        .select("*")
        .eq("farmer_user_id", member.farmer_user_id)
        .maybeSingle();
      const row = profile as Record<string, unknown> | null;
      result.profile = row ? (stripNeverShared(row) as unknown as Farmer360Profile) : null;
    }

    if (tabAllowed("farms", purposes)) {
      const { data: farms } = await supabaseAdmin
        .from("farm_records")
        .select(
          "id, label, plot_ref, area_acres, primary_crop, village_code, sync_state, updated_at",
        )
        .eq("farmer_user_id", member.farmer_user_id)
        .order("updated_at", { ascending: false });
      result.farms = (farms ?? []) as FarmSummary[];

      const byCrop = new Map<string, { acres: number; plots: number }>();
      for (const f of result.farms) {
        const crop = f.primary_crop ?? "unspecified";
        const prev = byCrop.get(crop) ?? { acres: 0, plots: 0 };
        byCrop.set(crop, { acres: prev.acres + Number(f.area_acres ?? 0), plots: prev.plots + 1 });
      }
      result.crops = Array.from(byCrop.entries()).map(([crop, v]) => ({ crop, ...v }));
      if (tabAllowed("market", purposes)) {
        result.market = result.crops.map((c) => ({ commodity: c.crop, expectedAcres: c.acres }));
      }
    }

    if (tabAllowed("schemes", purposes)) {
      const { data: apps } = await supabaseAdmin
        .from("scheme_applications")
        .select("id, scheme_id, status, decided_at, created_at")
        .eq("applicant_user_id", member.farmer_user_id)
        .order("created_at", { ascending: false });
      result.schemes = (
        (apps ?? []) as Array<{
          id: string;
          scheme_id: string;
          status: string;
          decided_at: string | null;
          created_at: string;
        }>
      ).map((a) => ({
        id: a.id,
        scheme_id: a.scheme_id,
        status: a.status,
        decided_at: a.decided_at,
        created_at: a.created_at,
      }));
    }

    return result;
  });
