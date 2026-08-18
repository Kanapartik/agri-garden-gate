/**
 * B9 — talent & skills server functions (evidence-gated on D-16).
 *
 * Every handler re-checks the D-16 gate, the feature flag and the caller's
 * authority. Candidate rows never leave this module for an employer: employers
 * only ever receive `buildReferralSummary` output for referrals the candidate
 * accepted. Every mutation writes an audit row.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildReferralSummary,
  checkCandidateProfile,
  checkCourse,
  checkEmployerSubmit,
  checkEntitlement,
  checkJobListing,
  checkTrainingPartnerSubmit,
  decideReferral as decideReferralPlan,
  evaluateTalentGate,
  planCertificationIssue,
  planCompletion,
  planEmployerApproval,
  planEnrollment,
  planEntityDecision,
  planGateDecision,
  planReferral,
  planVisibilityChange,
  rankCandidates,
  summariseTalent,
  CANDIDATE_SHAREABLE_FIELDS,
  EMPLOYER_DATA_SCOPES,
  NO_PLACEMENT_GUARANTEE_NOTICE,
  TALENT_ENTITLEMENT_KINDS,
  type CandidateProfile,
  type CertificationView,
  type EnrollmentStatus,
  type EvidenceGate,
  type GateStatus,
  type JobListingStatus,
  type ReferralStatus,
  type TalentDashboard,
  type TalentEmployerKind,
  type TalentEntityState,
  type TalentVisibility,
} from "@/lib/atap/talent";

/* ------------------------------------------------------------------ types */

export interface PartnerRow {
  id: string;
  name: string;
  contact_email: string;
  accreditation_ref: string;
  certification_issuer_name: string;
  state: TalentEntityState;
  decision_note: string;
  created_by: string | null;
  created_at: string;
}

export interface CourseRow {
  id: string;
  partner_id: string;
  code: string;
  title: string;
  description: string;
  skills: string[];
  hours: number;
  fee_amount: number;
  currency: string;
  certification_issuer_name: string;
  is_published: boolean;
}

export interface EnrollmentRow {
  id: string;
  course_id: string;
  candidate_id: string;
  status: EnrollmentStatus;
  fee_paid: boolean;
  enrolled_at: string;
  completed_at: string | null;
}

export interface CertificationRow extends CertificationView {
  enrollment_id: string;
  candidate_id: string;
  issuer_partner_id: string;
  issued_at: string;
}

export interface EmployerRow {
  id: string;
  kind: TalentEmployerKind;
  name: string;
  contact_email: string;
  agreement_ref: string;
  data_scope: string[];
  data_scope_approved: boolean;
  state: TalentEntityState;
  decision_note: string;
  created_by: string | null;
  created_at: string;
}

export interface JobRow {
  id: string;
  employer_id: string;
  title: string;
  description: string;
  skills: string[];
  positions: number;
  compensation_min: number | null;
  compensation_max: number | null;
  status: JobListingStatus;
  is_sponsored: boolean;
  sponsored_label: string;
  no_placement_guarantee: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ReferralRow {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ReferralStatus;
  shared_fields: string[];
  match_reason: string;
  candidate_decision_at: string | null;
  created_at: string;
}

export interface EntitlementRow {
  id: string;
  subject_kind: string;
  subject_id: string;
  plan_code: string;
  status: string;
  fee_amount: number;
  currency: string;
  grants_ranking_advantage: boolean;
  starts_at: string;
  ends_at: string | null;
}

export interface TalentWorkspace {
  userId: string;
  gate: EvidenceGate | null;
  gateNotes: string;
  activation: { activated: boolean; errors: string[] };
  flags: Record<string, boolean>;
  capabilities: {
    decideGate: boolean;
    review: boolean;
    candidate: boolean;
    trainingPartner: boolean;
    employer: boolean;
    exchange: boolean;
  };
  notices: { noPlacementGuarantee: string; shareableFields: string[]; dataScopes: string[] };
  myProfile: CandidateProfile | null;
  partners: PartnerRow[];
  courses: CourseRow[];
  myEnrollments: EnrollmentRow[];
  myCertifications: CertificationRow[];
  employers: EmployerRow[];
  jobs: JobRow[];
  myReferrals: ReferralRow[];
  dashboard: TalentDashboard | null;
}

/* -------------------------------------------------------------- workspace */

export const getTalentWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TalentWorkspace> => {
    const { supabase, userId } = context;
    const { resolveTalentActor, canReviewTalentEntity, canDecideGate, flagEnabled, loadTalentGate } =
      await import("@/lib/atap/talent.server");

    const actor = await resolveTalentActor(supabase, userId);
    const gateRow = await supabase
      .from("talent_evidence_gates")
      .select("code, status, demand_validated, policy_validated, commercial_validated, notes")
      .eq("code", "D-16")
      .maybeSingle();
    const gate = (gateRow.data as unknown as (EvidenceGate & { notes: string }) | null) ?? null;

    const flagKeys = [
      "talent.domain",
      "talent.candidate_profiles",
      "talent.training_partners",
      "talent.employers",
      "talent.exchange_integration",
      "talent.matching",
      "talent.commercial_entitlements",
    ];
    const flagValues = await Promise.all(flagKeys.map((k) => flagEnabled(supabase, k)));
    const flags = Object.fromEntries(flagKeys.map((k, i) => [k, flagValues[i] ?? false]));

    const activation = evaluateTalentGate({
      gate: await loadTalentGate(supabase),
      domainFlagEnabled: flags["talent.domain"] ?? false,
    });

    const capabilities = {
      decideGate: canDecideGate(actor),
      review: canReviewTalentEntity(actor),
      candidate: actor.isCandidate || actor.isPlatformAdmin,
      trainingPartner: actor.isTrainingPartnerAdmin || actor.isPlatformAdmin,
      employer: actor.isEmployerRecruiter || actor.isPlatformAdmin,
      exchange: actor.isEmploymentExchangeAdmin || actor.isPlatformAdmin,
    };

    const notices = {
      noPlacementGuarantee: NO_PLACEMENT_GUARANTEE_NOTICE,
      shareableFields: [...CANDIDATE_SHAREABLE_FIELDS],
      dataScopes: [...EMPLOYER_DATA_SCOPES],
    };

    const empty: TalentWorkspace = {
      userId,
      gate,
      gateNotes: gate?.notes ?? "",
      activation,
      flags,
      capabilities,
      notices,
      myProfile: null,
      partners: [],
      courses: [],
      myEnrollments: [],
      myCertifications: [],
      employers: [],
      jobs: [],
      myReferrals: [],
      dashboard: null,
    };

    // Until D-16 is approved the domain exposes only its own gate status.
    if (!activation.activated) return empty;

    const [profile, partners, courses, enrollments, certifications, employers, jobs, referrals] =
      await Promise.all([
        supabase.from("talent_candidate_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("talent_training_partners").select("*").order("created_at"),
        supabase.from("talent_courses").select("*").order("created_at"),
        supabase.from("talent_enrollments").select("*").order("enrolled_at"),
        supabase.from("talent_certifications").select("*").order("issued_at"),
        supabase.from("talent_employers").select("*").order("created_at"),
        supabase.from("talent_job_listings").select("*").order("created_at", { ascending: false }),
        supabase.from("talent_referrals").select("*").order("created_at", { ascending: false }),
      ]);

    const myProfile = (profile.data as unknown as CandidateProfile | null) ?? null;
    const partnerRows = (partners.data ?? []) as unknown as PartnerRow[];
    const courseRows = (courses.data ?? []) as unknown as CourseRow[];
    const enrollmentRows = (enrollments.data ?? []) as unknown as EnrollmentRow[];
    const certRows = (certifications.data ?? []) as unknown as CertificationRow[];
    const employerRows = (employers.data ?? []) as unknown as EmployerRow[];
    const jobRows = (jobs.data ?? []) as unknown as JobRow[];
    const referralRows = (referrals.data ?? []) as unknown as ReferralRow[];

    return {
      ...empty,
      myProfile,
      partners: partnerRows,
      courses: courseRows,
      myEnrollments: enrollmentRows,
      myCertifications: certRows,
      employers: employerRows,
      jobs: jobRows,
      myReferrals: referralRows,
      dashboard: summariseTalent({
        gate,
        candidates: myProfile ? [myProfile] : [],
        partners: partnerRows,
        courses: courseRows,
        enrollments: enrollmentRows,
        certifications: certRows,
        employers: employerRows,
        jobs: jobRows,
        referrals: referralRows,
      }),
    };
  });

/* ------------------------------------------------------------- D-16 gate */

export const decideTalentGate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      decision: GateStatus;
      demandValidated: boolean;
      policyValidated: boolean;
      commercialValidated: boolean;
      notes: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveTalentActor, canDecideGate } = await import("@/lib/atap/talent.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const actor = await resolveTalentActor(supabase, userId);
    const plan = planGateDecision({
      decision: data.decision,
      demandValidated: data.demandValidated,
      policyValidated: data.policyValidated,
      commercialValidated: data.commercialValidated,
      reviewerIsAuthorized: canDecideGate(actor),
    });
    if (!plan.ok) throw new Error(plan.ok === false ? plan.errors.join(",") : "invalid");

    const { error } = await supabase
      .from("talent_evidence_gates")
      .update({
        status: data.decision,
        demand_validated: data.demandValidated,
        policy_validated: data.policyValidated,
        commercial_validated: data.commercialValidated,
        notes: data.notes,
        decided_by: userId,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("code", "D-16");
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.evidence_gate.decision",
      subject_type: "talent_evidence_gate",
      subject_id: "D-16",
      decision: data.decision,
      metadata: {
        demand: data.demandValidated,
        policy: data.policyValidated,
        commercial: data.commercialValidated,
        humanDecision: true,
      },
    });
    return { ok: true };
  });

/* -------------------------------------------------------- candidate side */

export const upsertCandidateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { fullName: string; headline: string; skills: string[]; seeking: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain } = await import("@/lib/atap/talent.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.candidate_profiles");

    const check = checkCandidateProfile(data);
    if (!check.ok) throw new Error(check.errors.join(","));

    const { data: row, error } = await supabase
      .from("talent_candidate_profiles")
      .upsert(
        {
          user_id: userId,
          full_name: data.fullName.trim(),
          headline: data.headline.trim(),
          skills: data.skills.map((s) => s.trim()).filter(Boolean),
          seeking: data.seeking,
        } as never,
        { onConflict: "user_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.candidate_profile.upsert",
      subject_type: "talent_candidate_profile",
      subject_id: (row as { id: string }).id,
      decision: "recorded",
      metadata: { skills: data.skills.length },
    });
    return { ok: true, id: (row as { id: string }).id };
  });

export const setCandidateVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requested: TalentVisibility; consentGiven: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain, myCandidateProfileId } = await import("@/lib/atap/talent.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.candidate_profiles");

    const profileId = await myCandidateProfileId(supabase, userId);
    if (!profileId) throw new Error("profile_missing");

    const plan = planVisibilityChange({
      requested: data.requested,
      consentGiven: data.consentGiven,
      now: new Date().toISOString(),
    });
    if (!plan.ok) throw new Error(plan.errors.join(","));

    const { error } = await supabase
      .from("talent_candidate_profiles")
      .update({
        visibility: plan.visibility,
        visibility_consent_at: plan.visibilityConsentAt,
      } as never)
      .eq("id", profileId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.candidate_visibility.change",
      subject_type: "talent_candidate_profile",
      subject_id: profileId,
      purpose_code: "talent_visibility",
      decision: plan.visibility,
      metadata: { consentRecorded: plan.visibilityConsentAt !== null },
    });
    return { ok: true, visibility: plan.visibility };
  });

/* ------------------------------------------------------ training partners */

export const submitTrainingPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      contactEmail: string;
      certificationIssuerName: string;
      accreditationRef: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain } = await import("@/lib/atap/talent.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.training_partners");

    const check = checkTrainingPartnerSubmit(data);
    if (!check.ok) throw new Error(check.errors.join(","));

    const { data: row, error } = await supabase
      .from("talent_training_partners")
      .insert({
        name: data.name.trim(),
        contact_email: data.contactEmail.trim(),
        certification_issuer_name: data.certificationIssuerName.trim(),
        accreditation_ref: data.accreditationRef.trim(),
        state: "submitted",
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.training_partner.submit",
      subject_type: "talent_training_partner",
      subject_id: (row as { id: string }).id,
      decision: "submitted",
      metadata: { issuer: data.certificationIssuerName },
    });
    return { ok: true, id: (row as { id: string }).id };
  });

export const decideTrainingPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      partnerId: string;
      decision: "approved" | "rejected" | "suspended";
      note: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain, resolveTalentActor, canReviewTalentEntity } = await import(
      "@/lib/atap/talent.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.training_partners");

    const actor = await resolveTalentActor(supabase, userId);
    const { data: existing } = await supabase
      .from("talent_training_partners")
      .select("state")
      .eq("id", data.partnerId)
      .maybeSingle();
    if (!existing) throw new Error("partner_not_found");

    const plan = planEntityDecision({
      currentState: (existing as { state: TalentEntityState }).state,
      decision: data.decision,
      reviewerIsAuthorized: canReviewTalentEntity(actor),
    });
    if (!plan.ok) throw new Error(plan.errors.join(","));

    const { error } = await supabase
      .from("talent_training_partners")
      .update({ state: plan.nextState, decision_note: data.note } as never)
      .eq("id", data.partnerId);
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.training_partner.decision",
      subject_type: "talent_training_partner",
      subject_id: data.partnerId,
      decision: plan.nextState,
      metadata: { humanDecision: true, note: data.note },
    });
    return { ok: true, state: plan.nextState };
  });

export const upsertCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      partnerId: string;
      code: string;
      title: string;
      description: string;
      skills: string[];
      hours: number;
      feeAmount: number;
      publish: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain, flagEnabled } = await import("@/lib/atap/talent.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.training_partners");

    const { data: partner } = await supabase
      .from("talent_training_partners")
      .select("id, state, certification_issuer_name, created_by")
      .eq("id", data.partnerId)
      .maybeSingle();
    if (!partner) throw new Error("partner_not_found");
    const p = partner as {
      state: TalentEntityState;
      certification_issuer_name: string;
      created_by: string | null;
    };
    if (p.created_by !== userId) throw new Error("not_authorized");

    const commercial = await flagEnabled(supabase, "talent.commercial_entitlements");
    const check = checkCourse({
      draft: {
        code: data.code,
        title: data.title,
        hours: data.hours,
        feeAmount: data.feeAmount,
        certificationIssuerName: p.certification_issuer_name,
      },
      partnerState: p.state,
      commercialEntitlementsEnabled: commercial,
    });
    if (!check.ok) throw new Error(check.errors.join(","));

    const { data: row, error } = await supabase
      .from("talent_courses")
      .upsert(
        {
          partner_id: data.partnerId,
          code: data.code.trim(),
          title: data.title.trim(),
          description: data.description.trim(),
          skills: data.skills.map((s) => s.trim()).filter(Boolean),
          hours: data.hours,
          fee_amount: data.feeAmount,
          certification_issuer_name: p.certification_issuer_name,
          is_published: data.publish,
          created_by: userId,
        } as never,
        { onConflict: "partner_id,code" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.course.upsert",
      subject_type: "talent_course",
      subject_id: (row as { id: string }).id,
      decision: data.publish ? "published" : "draft",
      metadata: { fee: data.feeAmount, issuer: p.certification_issuer_name },
    });
    return { ok: true, id: (row as { id: string }).id };
  });

/* --------------------------------------------- enrollment & certification */

export const enrollInCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { courseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain, myCandidateProfileId } = await import("@/lib/atap/talent.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.training_partners");

    const candidateId = await myCandidateProfileId(supabase, userId);
    if (!candidateId) throw new Error("profile_missing");

    const [{ data: course }, { data: existing }] = await Promise.all([
      supabase
        .from("talent_courses")
        .select("id, is_published, partner_id")
        .eq("id", data.courseId)
        .maybeSingle(),
      supabase
        .from("talent_enrollments")
        .select("id")
        .eq("course_id", data.courseId)
        .eq("candidate_id", candidateId)
        .maybeSingle(),
    ]);
    if (!course) throw new Error("course_not_found");
    const { data: partner } = await supabase
      .from("talent_training_partners")
      .select("state")
      .eq("id", (course as { partner_id: string }).partner_id)
      .maybeSingle();

    const plan = planEnrollment({
      coursePublished: (course as { is_published: boolean }).is_published,
      partnerState: ((partner as { state?: TalentEntityState } | null)?.state ??
        "draft") as TalentEntityState,
      alreadyEnrolled: Boolean(existing),
    });
    if (!plan.ok) throw new Error(plan.errors.join(","));

    const { data: row, error } = await supabase
      .from("talent_enrollments")
      .insert({ course_id: data.courseId, candidate_id: candidateId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.enrollment.create",
      subject_type: "talent_enrollment",
      subject_id: (row as { id: string }).id,
      decision: "enrolled",
      metadata: { courseId: data.courseId },
    });
    return { ok: true, id: (row as { id: string }).id };
  });

export const completeEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enrollmentId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain } = await import("@/lib/atap/talent.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.training_partners");

    const { data: enrollment } = await supabase
      .from("talent_enrollments")
      .select("id, status, course_id")
      .eq("id", data.enrollmentId)
      .maybeSingle();
    if (!enrollment) throw new Error("enrollment_not_found");
    const e = enrollment as { status: EnrollmentStatus; course_id: string };

    const { data: course } = await supabase
      .from("talent_courses")
      .select("created_by")
      .eq("id", e.course_id)
      .maybeSingle();

    const plan = planCompletion({
      status: e.status,
      actorIsIssuingPartner: (course as { created_by?: string } | null)?.created_by === userId,
    });
    if (!plan.ok) throw new Error(plan.errors.join(","));

    const { error } = await supabase
      .from("talent_enrollments")
      .update({ status: "completed", completed_at: new Date().toISOString() } as never)
      .eq("id", data.enrollmentId);
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.enrollment.complete",
      subject_type: "talent_enrollment",
      subject_id: data.enrollmentId,
      decision: "completed",
      metadata: {},
    });
    return { ok: true };
  });

export const issueCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enrollmentId: string; credentialRef: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain } = await import("@/lib/atap/talent.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.training_partners");

    const { data: enrollment } = await supabase
      .from("talent_enrollments")
      .select("id, status, course_id, candidate_id")
      .eq("id", data.enrollmentId)
      .maybeSingle();
    if (!enrollment) throw new Error("enrollment_not_found");
    const e = enrollment as { status: EnrollmentStatus; course_id: string; candidate_id: string };

    const { data: course } = await supabase
      .from("talent_courses")
      .select("code, hours, partner_id, certification_issuer_name, created_by")
      .eq("id", e.course_id)
      .maybeSingle();
    if (!course) throw new Error("course_not_found");
    const c = course as {
      code: string;
      hours: number;
      partner_id: string;
      certification_issuer_name: string;
      created_by: string | null;
    };

    const provenance = {
      issuerName: c.certification_issuer_name,
      issuerPartnerId: c.partner_id,
      credentialRef: data.credentialRef.trim(),
      courseCode: c.code,
      hours: c.hours,
      verifiedBy: null,
    };
    const plan = planCertificationIssue({
      enrollmentStatus: e.status,
      actorIsIssuingPartner: c.created_by === userId,
      provenance,
    });
    if (!plan.ok) throw new Error(plan.errors.join(","));

    const { data: row, error } = await supabase
      .from("talent_certifications")
      .insert({
        enrollment_id: data.enrollmentId,
        candidate_id: e.candidate_id,
        issuer_partner_id: c.partner_id,
        issuer_name: c.certification_issuer_name,
        credential_ref: provenance.credentialRef,
        provenance: provenance as unknown as Record<string, unknown>,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.certification.issue",
      subject_type: "talent_certification",
      subject_id: (row as { id: string }).id,
      decision: "issued",
      metadata: { issuer: c.certification_issuer_name, credentialRef: provenance.credentialRef },
    });
    return { ok: true, id: (row as { id: string }).id };
  });

export const verifyCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { certificationId: string; decision: "verified" | "failed" | "revoked" }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain, resolveTalentActor, canReviewTalentEntity } = await import(
      "@/lib/atap/talent.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.training_partners");

    const actor = await resolveTalentActor(supabase, userId);
    const { data: cert } = await supabase
      .from("talent_certifications")
      .select("id, issuer_partner_id")
      .eq("id", data.certificationId)
      .maybeSingle();
    if (!cert) throw new Error("certification_not_found");

    const { data: partner } = await supabase
      .from("talent_training_partners")
      .select("created_by")
      .eq("id", (cert as { issuer_partner_id: string }).issuer_partner_id)
      .maybeSingle();
    const isIssuer = (partner as { created_by?: string } | null)?.created_by === userId;
    if (!isIssuer && !canReviewTalentEntity(actor)) throw new Error("not_authorized");

    const { error } = await supabase
      .from("talent_certifications")
      .update({ verification_status: data.decision, verified_by: userId } as never)
      .eq("id", data.certificationId);
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.certification.verification",
      subject_type: "talent_certification",
      subject_id: data.certificationId,
      decision: data.decision,
      metadata: { humanDecision: true },
    });
    return { ok: true };
  });

/* --------------------------------------------- employers & requisitions */

export const submitEmployer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      kind: TalentEmployerKind;
      name: string;
      contactEmail: string;
      agreementRef: string;
      dataScope: string[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain, flagEnabled } = await import("@/lib/atap/talent.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.employers");

    const exchangeEnabled = await flagEnabled(supabase, "talent.exchange_integration");
    const check = checkEmployerSubmit({
      draft: data,
      exchangeIntegrationEnabled: exchangeEnabled,
    });
    if (!check.ok) throw new Error(check.errors.join(","));

    const { data: row, error } = await supabase
      .from("talent_employers")
      .insert({
        kind: data.kind,
        name: data.name.trim(),
        contact_email: data.contactEmail.trim(),
        agreement_ref: data.agreementRef.trim(),
        data_scope: data.dataScope,
        state: "submitted",
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.employer.submit",
      subject_type: "talent_employer",
      subject_id: (row as { id: string }).id,
      decision: "submitted",
      metadata: { kind: data.kind, dataScope: data.dataScope },
    });
    return { ok: true, id: (row as { id: string }).id };
  });

export const decideEmployer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      employerId: string;
      decision: "approved" | "rejected" | "suspended";
      approveDataScope: boolean;
      note: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain, resolveTalentActor, canReviewTalentEntity } = await import(
      "@/lib/atap/talent.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.employers");

    const actor = await resolveTalentActor(supabase, userId);
    const { data: existing } = await supabase
      .from("talent_employers")
      .select("state, kind, agreement_ref, data_scope, data_scope_approved")
      .eq("id", data.employerId)
      .maybeSingle();
    if (!existing) throw new Error("employer_not_found");
    const e = existing as {
      state: TalentEntityState;
      kind: TalentEmployerKind;
      agreement_ref: string;
      data_scope: string[];
      data_scope_approved: boolean;
    };

    const plan = planEmployerApproval({
      kind: e.kind,
      currentState: e.state,
      decision: data.decision,
      reviewerIsAuthorized: canReviewTalentEntity(actor),
      agreementRef: e.agreement_ref,
      dataScope: e.data_scope ?? [],
      dataScopeApproved: data.approveDataScope || e.data_scope_approved,
    });
    if (!plan.ok) throw new Error(plan.errors.join(","));

    const { error } = await supabase
      .from("talent_employers")
      .update({
        state: plan.nextState,
        decision_note: data.note,
        data_scope_approved: data.approveDataScope || e.data_scope_approved,
      } as never)
      .eq("id", data.employerId);
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.employer.decision",
      subject_type: "talent_employer",
      subject_id: data.employerId,
      decision: plan.nextState,
      metadata: {
        humanDecision: true,
        kind: e.kind,
        dataScopeApproved: data.approveDataScope || e.data_scope_approved,
      },
    });
    return { ok: true, state: plan.nextState };
  });

export const upsertJobListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      employerId: string;
      title: string;
      description: string;
      skills: string[];
      positions: number;
      compensationMin: number | null;
      compensationMax: number | null;
      isSponsored: boolean;
      sponsoredLabel: string;
      status: JobListingStatus;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain } = await import("@/lib/atap/talent.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.employers");

    const { data: employer } = await supabase
      .from("talent_employers")
      .select("state, created_by")
      .eq("id", data.employerId)
      .maybeSingle();
    if (!employer) throw new Error("employer_not_found");
    const emp = employer as { state: TalentEntityState; created_by: string | null };
    if (emp.created_by !== userId) throw new Error("not_authorized");

    const check = checkJobListing({
      draft: {
        title: data.title,
        skills: data.skills,
        positions: data.positions,
        isSponsored: data.isSponsored,
        sponsoredLabel: data.sponsoredLabel,
        compensationMin: data.compensationMin,
        compensationMax: data.compensationMax,
      },
      employerState: emp.state,
    });
    if (!check.ok) throw new Error(check.errors.join(","));

    const { data: row, error } = await supabase
      .from("talent_job_listings")
      .insert({
        employer_id: data.employerId,
        title: data.title.trim(),
        description: data.description.trim(),
        skills: data.skills.map((s) => s.trim()).filter(Boolean),
        positions: data.positions,
        compensation_min: data.compensationMin,
        compensation_max: data.compensationMax,
        is_sponsored: data.isSponsored,
        sponsored_label: data.isSponsored ? data.sponsoredLabel.trim() : "",
        status: data.status,
        no_placement_guarantee: true,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.job.create",
      subject_type: "talent_job_listing",
      subject_id: (row as { id: string }).id,
      decision: data.status,
      metadata: { sponsored: data.isSponsored, noPlacementGuarantee: true },
    });
    return { ok: true, id: (row as { id: string }).id, notice: NO_PLACEMENT_GUARANTEE_NOTICE };
  });

/* ------------------------------------------------- matching & referrals */

export interface MatchCandidateRow {
  candidateId: string;
  skillOverlap: number;
  verifiedCertifications: number;
  score: number;
}

/**
 * Operator-only, merit-only shortlist. Returns opaque candidate IDs and match
 * scores — never candidate fields. Employers cannot call this.
 */
export const matchCandidatesForJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string }) => input)
  .handler(async ({ data, context }): Promise<{ rows: MatchCandidateRow[] }> => {
    const { supabase, userId } = context;
    const { requireTalentDomain, resolveTalentActor, canReviewTalentEntity } = await import(
      "@/lib/atap/talent.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.matching");

    const actor = await resolveTalentActor(supabase, userId);
    if (!canReviewTalentEntity(actor)) throw new Error("not_authorized");

    const { data: job } = await supabase
      .from("talent_job_listings")
      .select("skills, status")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) throw new Error("job_not_found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: candidates }, { data: certs }] = await Promise.all([
      supabaseAdmin
        .from("talent_candidate_profiles")
        .select("id, user_id, full_name, headline, skills, visibility, visibility_consent_at, seeking")
        .eq("visibility", "employers_optin"),
      supabaseAdmin
        .from("talent_certifications")
        .select("id, candidate_id, issuer_name, credential_ref, verification_status, provenance"),
    ]);

    const certRows = (certs ?? []) as unknown as Array<CertificationView & { candidate_id: string }>;
    const rows = rankCandidates({
      jobSkills: ((job as { skills: string[] }).skills ?? []) as string[],
      candidates: ((candidates ?? []) as unknown as CandidateProfile[]).map((c) => ({
        ...c,
        certifications: certRows.filter((x) => x.candidate_id === c.id),
      })),
    });

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.match.shortlist",
      subject_type: "talent_job_listing",
      subject_id: data.jobId,
      purpose_code: "talent_matching",
      decision: "allow",
      metadata: { shortlisted: rows.length, rankingInputs: ["skill_overlap", "verified_certs"] },
    });
    return { rows };
  });

export const proposeReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string; candidateId: string; matchReason: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain, resolveTalentActor, canReviewTalentEntity } = await import(
      "@/lib/atap/talent.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.matching");

    const actor = await resolveTalentActor(supabase, userId);
    if (!canReviewTalentEntity(actor)) throw new Error("not_authorized");

    const { data: job } = await supabase
      .from("talent_job_listings")
      .select("status, employer_id")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) throw new Error("job_not_found");
    const j = job as { status: JobListingStatus; employer_id: string };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: employer }, { data: candidate }, { data: existing }] = await Promise.all([
      supabase.from("talent_employers").select("state").eq("id", j.employer_id).maybeSingle(),
      supabaseAdmin
        .from("talent_candidate_profiles")
        .select("id, user_id, full_name, headline, skills, visibility, visibility_consent_at, seeking")
        .eq("id", data.candidateId)
        .maybeSingle(),
      supabase
        .from("talent_referrals")
        .select("id")
        .eq("job_id", data.jobId)
        .eq("candidate_id", data.candidateId)
        .maybeSingle(),
    ]);
    if (!candidate) throw new Error("candidate_not_found");

    const plan = planReferral({
      jobStatus: j.status,
      employerState: ((employer as { state?: TalentEntityState } | null)?.state ??
        "draft") as TalentEntityState,
      candidate: candidate as unknown as CandidateProfile,
      matchingEnabled: true,
      alreadyReferred: Boolean(existing),
    });
    if (!plan.ok) throw new Error(plan.errors.join(","));

    const { data: row, error } = await supabase
      .from("talent_referrals")
      .insert({
        job_id: data.jobId,
        candidate_id: data.candidateId,
        status: plan.status,
        match_reason: data.matchReason,
        requested_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.referral.propose",
      subject_type: "talent_referral",
      subject_id: (row as { id: string }).id,
      purpose_code: "talent_matching",
      decision: plan.status,
      metadata: { jobId: data.jobId, awaitingCandidateConsent: true },
    });
    return { ok: true, id: (row as { id: string }).id };
  });

export const decideReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      referralId: string;
      decision: "accept" | "decline" | "withdraw";
      sharedFields: string[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain, myCandidateProfileId } = await import("@/lib/atap/talent.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.matching");

    const myProfileId = await myCandidateProfileId(supabase, userId);
    const { data: referral } = await supabase
      .from("talent_referrals")
      .select("id, status, candidate_id, job_id")
      .eq("id", data.referralId)
      .maybeSingle();
    if (!referral) throw new Error("referral_not_found");
    const r = referral as { status: ReferralStatus; candidate_id: string; job_id: string };

    const plan = decideReferralPlan({
      current: r.status,
      decision: data.decision,
      actorIsCandidate: myProfileId !== null && myProfileId === r.candidate_id,
      sharedFields: data.sharedFields,
    });
    if (!plan.ok) throw new Error(plan.errors.join(","));

    const { error } = await supabase
      .from("talent_referrals")
      .update({
        status: plan.status,
        shared_fields: plan.sharedFields,
        candidate_decision_at: new Date().toISOString(),
      } as never)
      .eq("id", data.referralId);
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.referral.candidate_decision",
      subject_type: "talent_referral",
      subject_id: data.referralId,
      purpose_code: "talent_matching",
      decision: plan.status,
      metadata: { sharedFields: plan.sharedFields },
    });
    return { ok: true, status: plan.status };
  });

/**
 * The employer-facing read. Returns redacted summaries unless the candidate
 * accepted that specific referral; hidden profiles are never returned.
 */
export const getEmployerReferralView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain } = await import("@/lib/atap/talent.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.matching");

    const { data: job } = await supabase
      .from("talent_job_listings")
      .select("id, created_by")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job || (job as { created_by: string | null }).created_by !== userId) {
      throw new Error("not_authorized");
    }

    const { data: referrals } = await supabase
      .from("talent_referrals")
      .select("id, candidate_id, status, shared_fields, match_reason")
      .eq("job_id", data.jobId);
    const rows = (referrals ?? []) as unknown as Array<{
      id: string;
      candidate_id: string;
      status: ReferralStatus;
      shared_fields: string[];
      match_reason: string;
    }>;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const summaries = await Promise.all(
      rows.map(async (row) => {
        const { data: profile } = await supabaseAdmin
          .from("talent_candidate_profiles")
          .select(
            "id, user_id, full_name, headline, skills, visibility, visibility_consent_at, seeking",
          )
          .eq("id", row.candidate_id)
          .maybeSingle();
        const summary = buildReferralSummary({
          profile: profile as unknown as CandidateProfile,
          status: row.status,
          sharedFields: row.shared_fields ?? [],
        });
        return { referralId: row.id, matchReason: row.match_reason, ...summary };
      }),
    );

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.referral.employer_read",
      subject_type: "talent_job_listing",
      subject_id: data.jobId,
      purpose_code: "talent_matching",
      decision: "allow",
      metadata: {
        total: summaries.length,
        disclosed: summaries.filter((s) => s.fields !== null).length,
      },
    });
    return { rows: summaries, notice: NO_PLACEMENT_GUARANTEE_NOTICE };
  });

/* --------------------------------------------------------- entitlements */

export const grantTalentEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      subjectKind: (typeof TALENT_ENTITLEMENT_KINDS)[number];
      subjectId: string;
      planCode: string;
      feeAmount: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireTalentDomain, resolveTalentActor, canDecideGate, flagEnabled } = await import(
      "@/lib/atap/talent.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await requireTalentDomain(supabase, "talent.commercial_entitlements");

    const actor = await resolveTalentActor(supabase, userId);
    const commercial = await flagEnabled(supabase, "talent.commercial_entitlements");
    const check = checkEntitlement({
      subjectKind: data.subjectKind,
      feeAmount: data.feeAmount,
      grantsRankingAdvantage: false,
      commercialFlagEnabled: commercial,
      approverIsAuthorized: canDecideGate(actor),
    });
    if (!check.ok) throw new Error(check.errors.join(","));

    const { data: row, error } = await supabase
      .from("talent_entitlements")
      .insert({
        subject_kind: data.subjectKind,
        subject_id: data.subjectId,
        plan_code: data.planCode,
        fee_amount: data.feeAmount,
        grants_ranking_advantage: false,
        approved_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "talent.entitlement.grant",
      subject_type: "talent_entitlement",
      subject_id: (row as { id: string }).id,
      decision: "granted",
      metadata: { subjectKind: data.subjectKind, rankingAdvantage: false },
    });
    return { ok: true, id: (row as { id: string }).id };
  });
