/**
 * FPO Management & Operations workspace — Phase 1 server functions.
 *
 * Authority is resolved from `user_roles` on every call. Section visibility in
 * the UI is presentation only; these handlers are the security boundary.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canManageProfile,
  canTransitionDocument,
  canViewFinance,
  dashboardMetrics,
  maskAccount,
  missingRequiredDocs,
  onboardingSteps,
  profileCompleteness,
  firstIncompleteStep,
  type FpoDocStatus,
  type FpoOnboardingStep,
  type FpoProfileState,
  type MetricCard,
  type StepState,
} from "@/lib/atap/fpo";
import type { AppRole } from "@/lib/atap/policy";

/* ------------------------------------------------------------------ types */

export interface FpoProfileRow {
  id: string;
  tenant_id: string;
  fpo_code: string;
  legal_name: string;
  display_name: string;
  registration_number: string | null;
  incorporation_date: string | null;
  org_type: string | null;
  cin: string | null;
  pan: string | null;
  gst: string | null;
  promoting_org: string | null;
  fpo_category: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  registered_address: string | null;
  state_code: string | null;
  district_code: string | null;
  mandal: string | null;
  village: string | null;
  pin_code: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  operational_districts: string[];
  villages_served: string[];
  registered_farmers: number;
  active_farmers: number;
  total_acres: number;
  primary_crops: string[];
  secondary_crops: string[];
  input_categories: string[];
  produce_categories: string[];
  annual_produce_tonnes: number | null;
  storage_facilities: string[];
  processing_facilities: string[];
  equipment: string[];
  warehouse_relationships: string[];
  logistics_relationships: string[];
  onboarding_step: string;
  state: FpoProfileState;
  verified_at: string | null;
  updated_at: string;
}

export interface LeadershipRow {
  id: string;
  tenant_id: string;
  role_title: string;
  person_name: string;
  user_id: string | null;
  is_signatory: boolean;
  phone: string | null;
  email: string | null;
}

export interface FpoDocumentRow {
  id: string;
  tenant_id: string;
  doc_type: string;
  title: string;
  status: FpoDocStatus;
  issued_on: string | null;
  expires_at: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/** Bank details are returned already masked; raw account numbers are never stored. */
export interface BankView {
  id: string;
  bank_name: string;
  branch: string | null;
  account_type: string | null;
  account_masked: string;
  ifsc: string | null;
  signatories: string[];
}

export interface FpoTenantOption {
  id: string;
  name: string;
  tenant_type: string;
  roles: AppRole[];
}

export interface FpoOverview {
  userId: string;
  tenants: FpoTenantOption[];
  activeTenantId: string | null;
  roles: AppRole[];
  canManage: boolean;
  canViewFinance: boolean;
  profile: FpoProfileRow | null;
  leadership: LeadershipRow[];
  documents: FpoDocumentRow[];
  bank: BankView[];
  memberCounts: { total: number; active: number; invited: number; suspended: number };
  metrics: MetricCard[];
  steps: StepState[];
  completeness: number;
  currentStep: FpoOnboardingStep;
  missingDocuments: string[];
}

/* --------------------------------------------------------------- overview */

export const getFpoOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId?: string }) => input ?? {})
  .handler(async ({ data, context }): Promise<FpoOverview> => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const actor = await resolveDistrictActor(supabase, userId);

    const { data: tenantRows } = await supabase
      .from("tenants")
      .select("id, name, tenant_type")
      .order("name");

    const visible = (tenantRows ?? []).filter(
      (t) =>
        actor.isPlatformAdmin || actor.isAuditor || actor.tenantIds.includes(t.id),
    );
    const fpoTenants = visible.filter((t) => t.tenant_type === "fpo");
    const options: FpoTenantOption[] = (fpoTenants.length > 0 ? fpoTenants : visible).map((t) => ({
      id: t.id,
      name: t.name,
      tenant_type: t.tenant_type,
      roles: actor.tenantRoles.flatMap((r) => (r.tenant_id === t.id ? [r.role] : [])),
    }));

    const activeTenantId =
      options.find((t) => t.id === data.tenantId)?.id ?? options[0]?.id ?? null;

    if (!activeTenantId) {
      return {
        userId,
        tenants: [],
        activeTenantId: null,
        roles: [],
        canManage: false,
        canViewFinance: false,
        profile: null,
        leadership: [],
        documents: [],
        bank: [],
        memberCounts: { total: 0, active: 0, invited: 0, suspended: 0 },
        metrics: [],
        steps: onboardingSteps(null, {
          leadership: 0,
          signatories: 0,
          bankAccounts: 0,
          verifiedDocuments: 0,
          documents: 0,
          profileState: "draft",
        }),
        completeness: 0,
        currentStep: "basic_details",
        missingDocuments: [],
      };
    }

    const roles = options.find((t) => t.id === activeTenantId)?.roles ?? [];
    const manage = canManageProfile(roles, actor.isPlatformAdmin);
    const finance = canViewFinance(roles, actor.isPlatformAdmin);

    const [{ data: profile }, { data: leadership }, { data: documents }, { data: members }] =
      await Promise.all([
        supabase.from("fpo_profiles").select("*").eq("tenant_id", activeTenantId).maybeSingle(),
        supabase
          .from("fpo_leadership")
          .select("id, tenant_id, role_title, person_name, user_id, is_signatory, phone, email")
          .eq("tenant_id", activeTenantId)
          .order("created_at"),
        supabase
          .from("fpo_documents")
          .select(
            "id, tenant_id, doc_type, title, status, issued_on, expires_at, review_note, reviewed_at, created_at",
          )
          .eq("tenant_id", activeTenantId)
          .order("created_at", { ascending: false }),
        supabase.from("fpo_members").select("status").eq("tenant_id", activeTenantId),
      ]);

    let bank: BankView[] = [];
    if (finance) {
      const { data: rows } = await supabase
        .from("fpo_bank_accounts")
        .select("id, bank_name, branch, account_type, account_last4, ifsc, signatories")
        .eq("tenant_id", activeTenantId);
      bank = (rows ?? []).map((r) => ({
        id: r.id,
        bank_name: r.bank_name,
        branch: r.branch,
        account_type: r.account_type,
        account_masked: maskAccount(r.account_last4),
        ifsc: r.ifsc,
        signatories: r.signatories ?? [],
      }));
      const { audit } = await import("@/lib/atap/admin.server");
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: activeTenantId,
        action: "fpo.finance.read",
        subject_type: "fpo_bank_accounts",
        decision: "allow",
        metadata: { accounts: bank.length },
      });
    }

    const memberRows = (members ?? []) as Array<{ status: string }>;
    const docRows = (documents ?? []) as FpoDocumentRow[];
    const prof = (profile ?? null) as FpoProfileRow | null;

    const steps = onboardingSteps(prof, {
      leadership: (leadership ?? []).length,
      signatories: (leadership ?? []).filter((l) => l.is_signatory).length,
      bankAccounts: bank.length,
      verifiedDocuments: docRows.filter((d) => d.status === "verified").length,
      documents: docRows.length,
      profileState: prof?.state ?? "draft",
    });

    return {
      userId,
      tenants: options,
      activeTenantId,
      roles,
      canManage: manage,
      canViewFinance: finance,
      profile: prof,
      leadership: (leadership ?? []) as LeadershipRow[],
      documents: docRows,
      bank,
      memberCounts: {
        total: memberRows.length,
        active: memberRows.filter((m) => m.status === "active").length,
        invited: memberRows.filter((m) => m.status === "invited").length,
        suspended: memberRows.filter((m) => m.status === "suspended").length,
      },
      metrics: dashboardMetrics({
        profile: prof,
        members: memberRows,
        docs: docRows,
        // Later phases replace these with real aggregates.
        eligibleSchemes: 0,
        applicationsInProgress: 0,
        procurementOpportunities: 0,
        produceAvailable: 0,
        pendingReceivables: 0,
        unreadNotifications: 0,
      }),
      steps,
      completeness: profileCompleteness(steps),
      currentStep: firstIncompleteStep(steps),
      missingDocuments: missingRequiredDocs(docRows),
    };
  });

/* ---------------------------------------------------------------- profile */

export interface ProfilePatch {
  tenantId: string;
  values: Record<string, string | number | string[] | null>;
}

export const saveFpoProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProfilePatch) => {
    if (!input?.tenantId) throw new Error("tenantId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");
    const actor = await resolveDistrictActor(supabase, userId);
    const roles = actor.tenantRoles.flatMap((r) => (r.tenant_id === data.tenantId ? [r.role] : []));

    if (!canManageProfile(roles, actor.isPlatformAdmin)) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "fpo.profile.save",
        decision: "deny",
        metadata: { reason: "not_tenant_admin" },
      });
      throw new Error("Only an admin of this FPO can edit the organization profile");
    }

    const { data: existing } = await supabase
      .from("fpo_profiles")
      .select("id")
      .eq("tenant_id", data.tenantId)
      .maybeSingle();

    const patch = { ...data.values } as Record<string, unknown>;
    delete patch["tenant_id"];
    delete patch["id"];
    delete patch["state"];
    delete patch["verified_at"];

    if (existing) {
      const { error } = await supabase
        .from("fpo_profiles")
        .update(patch as never)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, slug")
        .eq("id", data.tenantId)
        .maybeSingle();
      const { error } = await supabase.from("fpo_profiles").insert({
        tenant_id: data.tenantId,
        fpo_code: `FPO-${(tenant?.slug ?? "org").toUpperCase().slice(0, 10)}`,
        legal_name: (patch["legal_name"] as string) ?? tenant?.name ?? "Unnamed FPO",
        display_name: (patch["display_name"] as string) ?? tenant?.name ?? "Unnamed FPO",
        created_by: userId,
        ...patch,
      } as never);
      if (error) throw new Error(error.message);
    }

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.profile.save",
      subject_type: "fpo_profiles",
      decision: "allow",
      metadata: { fields: Object.keys(patch) },
    });
    return { ok: true };
  });

/* ------------------------------------------------------------- leadership */

export const saveLeader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      id?: string;
      roleTitle: string;
      personName: string;
      isSignatory?: boolean;
      phone?: string;
      email?: string;
    }) => {
      if (!input?.tenantId || !input.roleTitle || !input.personName) {
        throw new Error("Role title and person name are required");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");
    const actor = await resolveDistrictActor(supabase, userId);
    const roles = actor.tenantRoles.flatMap((r) => (r.tenant_id === data.tenantId ? [r.role] : []));
    if (!canManageProfile(roles, actor.isPlatformAdmin)) {
      throw new Error("Only an admin of this FPO can manage leadership records");
    }

    const row = {
      tenant_id: data.tenantId,
      role_title: data.roleTitle,
      person_name: data.personName,
      is_signatory: Boolean(data.isSignatory),
      phone: data.phone ?? null,
      email: data.email ?? null,
    };
    const { error } = data.id
      ? await supabase.from("fpo_leadership").update(row as never).eq("id", data.id)
      : await supabase.from("fpo_leadership").insert(row as never);
    if (error) throw new Error(error.message);

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: data.id ? "fpo.leadership.update" : "fpo.leadership.add",
      subject_type: "fpo_leadership",
      decision: "allow",
      metadata: { role_title: data.roleTitle, signatory: Boolean(data.isSignatory) },
    });
    return { ok: true };
  });

export const removeLeader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");
    const actor = await resolveDistrictActor(supabase, userId);
    const roles = actor.tenantRoles.flatMap((r) => (r.tenant_id === data.tenantId ? [r.role] : []));
    if (!canManageProfile(roles, actor.isPlatformAdmin)) {
      throw new Error("Only an admin of this FPO can manage leadership records");
    }
    const { error } = await supabase.from("fpo_leadership").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.leadership.remove",
      subject_type: "fpo_leadership",
      subject_id: data.id,
      decision: "allow",
    });
    return { ok: true };
  });

/* ------------------------------------------------------------------- bank */

export const saveBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      bankName: string;
      branch?: string;
      accountType?: string;
      accountNumber?: string;
      ifsc?: string;
      signatories?: string[];
    }) => {
      if (!input?.tenantId || !input.bankName) throw new Error("Bank name is required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");
    const actor = await resolveDistrictActor(supabase, userId);
    const roles = actor.tenantRoles.flatMap((r) => (r.tenant_id === data.tenantId ? [r.role] : []));
    if (!canViewFinance(roles, actor.isPlatformAdmin)) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "fpo.finance.write",
        decision: "deny",
        metadata: { reason: "not_finance_authorized" },
      });
      throw new Error("Bank details can only be changed by an authorized FPO admin");
    }

    // Only the last four digits are persisted — the full number never lands in the database.
    const last4 = (data.accountNumber ?? "").replace(/\D/g, "").slice(-4) || null;
    const { error } = await supabase.from("fpo_bank_accounts").insert({
      tenant_id: data.tenantId,
      bank_name: data.bankName,
      branch: data.branch ?? null,
      account_type: data.accountType ?? null,
      account_last4: last4,
      ifsc: data.ifsc ?? null,
      signatories: data.signatories ?? [],
      created_by: userId,
    } as never);
    if (error) throw new Error(error.message);

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.finance.write",
      subject_type: "fpo_bank_accounts",
      decision: "allow",
      metadata: { bank: data.bankName },
    });
    return { ok: true };
  });

/* -------------------------------------------------------------- documents */

export const addFpoDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      docType: string;
      title: string;
      issuedOn?: string;
      expiresAt?: string;
    }) => {
      if (!input?.tenantId || !input.docType || !input.title) {
        throw new Error("Document type and title are required");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");
    const actor = await resolveDistrictActor(supabase, userId);
    const roles = actor.tenantRoles.flatMap((r) => (r.tenant_id === data.tenantId ? [r.role] : []));
    if (!canManageProfile(roles, actor.isPlatformAdmin)) {
      throw new Error("Only an admin of this FPO can add organization documents");
    }
    const { error } = await supabase.from("fpo_documents").insert({
      tenant_id: data.tenantId,
      doc_type: data.docType,
      title: data.title,
      issued_on: data.issuedOn || null,
      expires_at: data.expiresAt || null,
      uploaded_by: userId,
      status: "uploaded",
    } as never);
    if (error) throw new Error(error.message);
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.document.add",
      subject_type: "fpo_documents",
      decision: "allow",
      metadata: { doc_type: data.docType },
    });
    return { ok: true };
  });

export const setFpoDocumentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; id: string; status: FpoDocStatus; note?: string }) => {
    if (!input?.id || !input.status) throw new Error("Document and status are required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");
    const actor = await resolveDistrictActor(supabase, userId);
    const roles = actor.tenantRoles.flatMap((r) => (r.tenant_id === data.tenantId ? [r.role] : []));
    if (!canManageProfile(roles, actor.isPlatformAdmin)) {
      throw new Error("Only an admin of this FPO can move a document through review");
    }

    const { data: doc } = await supabase
      .from("fpo_documents")
      .select("id, status, doc_type")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");

    if (!canTransitionDocument(doc.status as FpoDocStatus, data.status)) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "fpo.document.status",
        subject_type: "fpo_documents",
        subject_id: data.id,
        decision: "deny",
        metadata: { from: doc.status, to: data.status },
      });
      throw new Error(`A ${doc.status} document cannot move to ${data.status}`);
    }

    const { error } = await supabase
      .from("fpo_documents")
      .update({
        status: data.status,
        review_note: data.note ?? null,
        reviewer_user_id: userId,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.document.status",
      subject_type: "fpo_documents",
      subject_id: data.id,
      decision: "allow",
      metadata: { from: doc.status, to: data.status },
    });
    return { ok: true };
  });

/* ------------------------------------------------------------- activation */

export const setFpoProfileState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; state: FpoProfileState }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");
    const actor = await resolveDistrictActor(supabase, userId);

    // Verification and activation are platform decisions, not self-service.
    const platformDecision = data.state === "verified" || data.state === "active" || data.state === "suspended";
    const roles = actor.tenantRoles.flatMap((r) => (r.tenant_id === data.tenantId ? [r.role] : []));
    const allowed = platformDecision
      ? actor.isPlatformAdmin
      : canManageProfile(roles, actor.isPlatformAdmin);

    if (!allowed) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "fpo.profile.state",
        decision: "deny",
        metadata: { requested: data.state },
      });
      throw new Error(
        platformDecision
          ? "Verification and activation are decided by a platform administrator"
          : "Only an admin of this FPO can submit the profile",
      );
    }

    const { error } = await supabase
      .from("fpo_profiles")
      .update({
        state: data.state,
        verified_at: data.state === "verified" || data.state === "active" ? new Date().toISOString() : null,
      } as never)
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.profile.state",
      subject_type: "fpo_profiles",
      decision: "allow",
      metadata: { state: data.state },
    });
    return { ok: true };
  });
